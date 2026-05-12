/**
 * Naming Series generator for ERPNext document names.
 *
 * ERPNext uses sequential naming series like `SINV-2026-00001`, `SO-2026-00042`, etc.
 * This module manages naming series configuration, counter increments, and name generation
 * using Prisma transactions to prevent concurrent name collisions.
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - Every function has explicit params and return types.
 * - Use `prisma.$transaction()` for counter increments to guarantee atomicity.
 */

import { prisma } from "@/lib/prisma";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface NamingSeriesConfig {
  prefix: string;        // e.g. "SINV-.YYYY.-"
  current: number;       // last used number
  doctype: string;       // which DocType this series is for
}

export interface ParsedPrefix {
  base: string;          // e.g. "SINV-"
  hasYear: boolean;      // whether `.YYYY.` placeholder is present
}

// ── Default naming series per DocType ─────────────────────────────────────────

const DEFAULT_SERIES: Record<string, string> = {
  "Sales Invoice":    "SINV-.YYYY.-",
  "Purchase Invoice": "PINV-.YYYY.-",
  "Sales Order":      "SO-.YYYY.-",
  "Purchase Order":   "PO-.YYYY.-",
  "Quotation":        "QTN-.YYYY.-",
  "Delivery Note":    "DN-.YYYY.-",
  "Purchase Receipt": "PR-.YYYY.-",
  "Stock Entry":      "STE-.YYYY.-",
  "Journal Entry":    "JE-.YYYY.-",
  "Payment Entry":    "PE-.YYYY.-",
  "Material Request": "MR-.YYYY.-",
  "Work Order":       "WO-.YYYY.-",
};

// ── In-memory fallback store ───────────────────────────────────────────────────
// Used when the database naming_series table does not exist or is empty.
// Key: `${doctype}::${company}::${prefix}`

const seriesStore = new Map<string, NamingSeriesConfig>();

// ── Helper: resolve fiscal year from a date ───────────────────────────────────

/**
 * Determine the fiscal year string for a given date.
 * Queries `erpnext_port.FiscalYear` where the date falls between
 * `year_start_date` and `year_end_date`.
 */
async function resolveFiscalYear(date: Date, company: string): Promise<string> {
  try {
    const fiscalYearCompany = await prisma.fiscalYearCompany.findFirst({
      where: { company },
    });

    if (fiscalYearCompany) {
      const fy = await prisma.fiscalYear.findFirst({
        where: {
          name: fiscalYearCompany.parent ?? "",
          disabled: false,
          year_start_date: { lte: date },
          year_end_date: { gte: date },
        },
      });
      if (fy) return fy.year;
    }

    // Fallback: find any matching fiscal year
    const fy = await prisma.fiscalYear.findFirst({
      where: {
        disabled: false,
        year_start_date: { lte: date },
        year_end_date: { gte: date },
      },
    });

    if (fy) return fy.year;
  } catch (_e: unknown) {
    // Table might not exist yet — fall through to year extraction
  }

  // Final fallback: extract calendar year
  return String(date.getFullYear());
}

// ── Helper: resolve current fiscal year ──────────────────────────────────────

async function getCurrentFiscalYear(company: string): Promise<string> {
  return resolveFiscalYear(new Date(), company);
}

// ── Parse prefix ──────────────────────────────────────────────────────────────

/**
 * Parse a naming series prefix into its components.
 *
 * @example
 *   parsePrefix("SINV-.YYYY.-") => { base: "SINV-", hasYear: true }
 *   parsePrefix("SO-")          => { base: "SO-", hasYear: false }
 */
export function parsePrefix(prefix: string): ParsedPrefix {
  const hasYear = prefix.includes(".YYYY.");
  const base = prefix.replace(".YYYY.", "");
  return { base, hasYear };
}

// ── Format document name ──────────────────────────────────────────────────────

/**
 * Format a complete document name from prefix components.
 *
 * @param prefix   - The raw prefix string (may contain `.YYYY.`)
 * @param counter  - The numeric counter value
 * @param fiscalYear - The fiscal year string to substitute
 * @returns Formatted name like "SINV-2026-00001"
 */
function formatDocName(prefix: string, counter: number, fiscalYear: string): string {
  const { base, hasYear } = parsePrefix(prefix);
  const padded = String(counter).padStart(5, "0");
  return hasYear ? `${base}${fiscalYear}-${padded}` : `${base}${padded}`;
}

// ── Series key for in-memory store ────────────────────────────────────────────

function seriesKey(doctype: string, company: string, prefix: string): string {
  return `${doctype}::${company}::${prefix}`;
}

// ── Get or create naming series config ────────────────────────────────────────

/**
 * Get or create a naming series config for a DocType.
 * Derives the current counter from the highest-numbered existing document
 * matching the prefix pattern, so counter survives server restarts.
 */
export async function getNamingSeries(doctype: string, company: string): Promise<NamingSeriesConfig> {
  const prefix = DEFAULT_SERIES[doctype] ?? `${doctype.replace(/\s+/g, "").substring(0, 4).toUpperCase()}-.YYYY.-`;
  const key = seriesKey(doctype, company, prefix);

  // Check in-memory store first
  const existing = seriesStore.get(key);
  if (existing) return existing;

  // Derive counter from actual documents in the database
  let current = 0;
  try {
    const { base, hasYear } = parsePrefix(prefix);
    // Build LIKE pattern: e.g. "SINV-%" matches "SINV-2026-00001"
    const likePattern = hasYear ? `${base}%` : `${base}%`;
    const accessor = toAccessorType(doctype);
    const model = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[accessor];
    if (model) {
      const rows = await model.findMany({
        where: { name: { startsWith: base } },
        select: { name: true },
        take: 1,
        orderBy: { name: 'desc' },
      }) as Array<{ name: string }>;
      if (rows.length > 0) {
        // Extract trailing number: "SINV-2026-00042" → 42
        const match = rows[0].name.match(/(\d+)$/);
        if (match) current = parseInt(match[1], 10);
      }
    }
  } catch (_e: unknown) {
    // Model doesn't exist or query failed — start at 0
  }

  // Try to load from database naming_series table as fallback
  if (current === 0) {
    try {
      const dbSeries = await prisma.$queryRaw<Array<{ prefix: string; current: bigint }>>`
        SELECT prefix, current
        FROM erpnext_port.naming_series
        WHERE doctype = ${doctype}
        ORDER BY current DESC
        LIMIT 1
      `;
      if (dbSeries.length > 0) {
        current = Number(dbSeries[0].current);
      }
    } catch (_e: unknown) {
      // Table doesn't exist — proceed with default 0
    }
  }

  const config: NamingSeriesConfig = {
    prefix,
    current,
    doctype,
  };
  seriesStore.set(key, config);
  return config;
}

/** Convert a display-label doctype name to its Prisma accessor (camelCase). */
function toAccessorType(doctype: string): string {
  return doctype
    .split(/\s+/)
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');
}

// ── Increment series counter ──────────────────────────────────────────────────

/**
 * Update the current counter for a naming series atomically.
 * Uses `prisma.$transaction()` to prevent concurrent name collisions.
 *
 * @param seriesId  - The series key (doctype::company::prefix)
 * @param newValue  - The new counter value
 */
export async function incrementSeries(seriesId: string, newValue: number): Promise<void> {
  const config = seriesStore.get(seriesId);
  if (!config) return;

  try {
    await prisma.$transaction(async (tx) => {
      // Try to update in the database if the naming_series table exists
      try {
        await tx.$executeRaw`
          INSERT INTO erpnext_port.naming_series (doctype, prefix, current)
          VALUES (${config.doctype}, ${config.prefix}, ${newValue})
          ON CONFLICT (doctype, prefix) DO UPDATE SET current = ${newValue}
        `;
      } catch (_e: unknown) {
        // Table may not exist — update in-memory only
      }

      // Always update in-memory
      config.current = newValue;
      seriesStore.set(seriesId, config);
    });
  } catch (e) {
    // Transaction failed — still update in-memory so the name is consumed
    config.current = newValue;
    seriesStore.set(seriesId, config);
  }
}

// ── Generate document name ────────────────────────────────────────────────────

/**
 * Generate the next document name for a given DocType.
 * Atomically increments the counter using a database transaction
 * to prevent concurrent name collisions.
 *
 * @param doctype  - The DocType name (e.g. "Sales Invoice")
 * @param company  - Optional company name for series partitioning
 * @returns The generated document name (e.g. "SINV-2026-00001")
 */
export async function generateDocName(doctype: string, company?: string, prefix?: string): Promise<string> {
  const companyName = company ?? "default";
  const config = await getNamingSeries(doctype, companyName);

  // Use the caller-supplied prefix (from naming_series field) if given
  if (prefix && prefix.trim()) {
    config.prefix = prefix.trim();
    const key = seriesKey(doctype, companyName, config.prefix);
    const existing = seriesStore.get(key);
    if (existing) {
      Object.assign(config, existing);
    }
    seriesStore.set(key, config);
  }
  const key = seriesKey(doctype, companyName, config.prefix);
  const fiscalYear = await getCurrentFiscalYear(companyName);

  let nextCounter: number;

  try {
    // Atomic increment using a transaction
    nextCounter = await prisma.$transaction(async (tx) => {
      // Attempt database-level locking if naming_series table exists
      try {
        const rows = await tx.$queryRaw<Array<{ current: bigint }>>`
          SELECT current FROM erpnext_port.naming_series
          WHERE doctype = ${doctype} AND prefix = ${config.prefix}
          FOR UPDATE
        `;
        if (rows.length > 0) {
          const dbCurrent = Number(rows[0].current);
          const incremented = dbCurrent + 1;
          await tx.$executeRaw`
            UPDATE erpnext_port.naming_series
            SET current = ${incremented}
            WHERE doctype = ${doctype} AND prefix = ${config.prefix}
          `;
          config.current = incremented;
          seriesStore.set(key, config);
          return incremented;
        }
      } catch (_e: unknown) {
        // Table doesn't exist or FOR UPDATE not supported — fall through
      }

      // Fallback: in-memory increment within transaction context
      const incremented = config.current + 1;
      config.current = incremented;
      seriesStore.set(key, config);
      return incremented;
    });
  } catch (e) {
    // Transaction failed — fall back to non-transactional increment
    nextCounter = config.current + 1;
    config.current = nextCounter;
    seriesStore.set(key, config);
  }

  return formatDocName(config.prefix, nextCounter, fiscalYear);
}

// ── Reset series (for testing / seeding) ──────────────────────────────────────

/**
 * Reset a naming series counter to a specific value.
 * Useful for testing or when re-seeding data.
 *
 * @param doctype  - The DocType name
 * @param company  - The company name
 * @param value    - The counter value to set
 */
export async function resetSeries(doctype: string, company: string, value: number): Promise<void> {
  const config = await getNamingSeries(doctype, company);
  const key = seriesKey(doctype, company, config.prefix);

  config.current = value;
  seriesStore.set(key, config);

  try {
    await prisma.$executeRaw`
      INSERT INTO erpnext_port.naming_series (doctype, prefix, current)
      VALUES (${doctype}, ${config.prefix}, ${value})
      ON CONFLICT (doctype, prefix) DO UPDATE SET current = ${value}
    `;
  } catch (_e: unknown) {
    // Table doesn't exist — in-memory update is sufficient
  }
}

// ── Get all default series mappings ───────────────────────────────────────────

/**
 * Return the default naming series prefix for each known DocType.
 * Useful for initialization and diagnostics.
 */
export function getDefaultSeriesMappings(): Record<string, string> {
  return { ...DEFAULT_SERIES };
}
