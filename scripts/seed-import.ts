#!/usr/bin/env tsx
/**
 * Seed data IMPORTER — reads JSON from seed-output/ and inserts into PostgreSQL.
 * Uses Prisma createMany() — typed, safe, schema-aware. No raw SQL.
 * Auto-validates column names against Prisma schema.
 * Filters out any LLM-generated columns that don't exist in the actual table.
 *
 * Usage:
 *   npx tsx scripts/seed-import.ts              # import all
 *   npx tsx scripts/seed-import.ts --dry-run    # validate only, no DB write
 *   npx tsx scripts/seed-import.ts Setup Stock # import specific modules
 *   npx tsx scripts/seed-import.ts --dir seed-output-batch-1 Setup  # custom dir
 */

import "dotenv/config";
import { PrismaClient } from "../prisma/client";
//import * as fs from "fs";
//import * as path from "path";
import fs from 'node:fs'
import path from "node:path";
const prisma = new PrismaClient();

// ── CONSTANTS ───────────────────────────────────────────────────────────────
const DEFAULT_DIR = "seed-output";

// ── PRIORITY ORDER (must match generation order) ───────────────────────────
const PRIORITY_ORDER = [
  { prio: "critical", modules: ["Setup", "Accounts", "Stock", "Selling", "Buying"] },
  { prio: "high", modules: ["Manufacturing", "Regional", "Quality Management", "Subcontracting"] },
  { prio: "medium", modules: ["CRM", "Projects", "Assets", "Human Resource", "Support", "Maintenance"] },
  { prio: "dormant", modules: ["Telephony", "Utilities", "EDI", "Bulk Transaction", "Portal", "Communication", "Unknown"] },
];

// ── SELF-REF PARENT FIELDS ─────────────────────────────────────────────────
const PARENT_FIELDS: Record<string, string> = {
  Account: "parent_account",
  ItemGroup: "parent_item_group",
  CostCenter: "parent_cost_center",
  Warehouse: "parent_warehouse",
  Territory: "parent_territory",
  Department: "parent_department",
  Task: "parent_task",
  BOM: "parent_bom",
};

// ── TYPE DEFINITIONS ────────────────────────────────────────────────────────
interface ModelInfo {
  name: string;           // PascalCase e.g. "Account"
  accessor: string;       // Prisma key e.g. "account"
  allFields: Set<string>; // all valid column names from schema
  dateFields: Set<string>;
  decimalFields: Set<string>;
}

interface ModuleReport {
  name: string;
  models: number;
  inserted: number;
  skipped: number;
  errors: number;
}

// ── BUILD MODEL INFO + ACCESSOR MAP FROM PRISMA + SCHEMA ─────────────────
function buildModelInfo(prisma: PrismaClient): Map<string, ModelInfo> {
  const schemaText = fs.readFileSync("prisma/schema.prisma", "utf-8");

  // 1. Collect all Prisma accessor keys (camelCase) that have createMany
  const prismaKeys = Object.keys(prisma).filter(
    (k) => !k.startsWith("_") && !k.startsWith("$") && typeof prisma[k] === "object" && "createMany" in (prisma as any)[k]
  );
  // Build: lowercase accessor → accessor key (for matching)
  const accessorByName = new Map<string, string>();
  for (const key of prismaKeys) {
    accessorByName.set((prisma as any)[key].name, key);
  }

  // 2. Parse schema for PascalCase model names + fields
  const map = new Map<string, ModelInfo>();
  const regex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(schemaText)) !== null) {
    if (!m[0].includes('@@schema("erpnext_port")')) continue;
    const modelName = m[1]; // PascalCase

    // Find the Prisma accessor: model "Account" → prisma.account (first-letter lowercase)
    const accessor = accessorByName.get(modelName) ??
      accessorByName.get(modelName.charAt(0).toLowerCase() + modelName.slice(1)) ??
      modelName.charAt(0).toLowerCase() + modelName.slice(1);

    const allFields = new Set<string>();
    const dateFields = new Set<string>();
    const decimalFields = new Set<string>();
    const lines = m[2].split("\n").map((l) => l.trim());
    for (const line of lines) {
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const parts = line.split(/\s+/);
      const rawFieldName = parts[0];
      const fieldName = rawFieldName.replace(/\?$/, "");
      const fieldType = parts[1] ?? "";
      allFields.add(fieldName);
      if (fieldType.includes("DateTime") || fieldType.includes("Timestamptz")) {
        dateFields.add(fieldName);
      }
      if (fieldType.includes("Decimal")) {
        decimalFields.add(fieldName);
      }
    }

    map.set(modelName, { name: modelName, accessor, allFields, dateFields, decimalFields });
  }
  return map;
}

// ── LOAD JSON FILES ───────────────────────────────────────────────────────
function loadJsonFiles(outputDir: string, filterModules?: string[]): { module: string; data: Record<string, any[]> }[] {
  const outDir = path.resolve(outputDir);
  if (!fs.existsSync(outDir)) {
    console.error(`❌ Output directory not found: ${outDir}`);
    process.exit(1);
  }

  const results: { module: string; data: Record<string, any[]> }[] = [];

  // Try _summary.json first for the file map
  const summaryPath = path.join(outDir, "_summary.json");
  let fileMap: Record<string, string> | null = null;

  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      fileMap = summary.files;
    } catch {
      // ignore, fall back to scanning
    }
  }

  const files = fileMap
    ? Object.entries(fileMap).map(([mod, filename]) => ({
        module: mod,
        path: path.join(outDir, filename),
      }))
    : fs.readdirSync(outDir)
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => ({
          module: f.replace(/\.json$/, "").replace(/_/g, " "),
          path: path.join(outDir, f),
        }));

  for (const { module, path: filePath } of files) {
    if (filterModules && !filterModules.includes(module)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      // Strip _meta envelope
      const { _meta, ...data } = raw;
      results.push({ module, data });
    } catch (e) {
      console.error(`❌ Failed to load ${filePath}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return results;
}

// ── PARENT-FIRST SORTER ───────────────────────────────────────────────────
function sortParentFirst(rows: any[], parentField: string): any[] {
  const byName = new Map(rows.map((r) => [r.name, r]));
  const isChild = (r: any) => r[parentField] && byName.has(r[parentField]);
  return rows.filter((r) => !isChild(r)).concat(rows.filter((r) => isChild(r)));
}

// ── INSERT ROWS VIA PRISMA createMany ────────────────────────────────────
async function insertRows(
  modelName: string,
  accessor: string,
  rows: any[],
  validFields: Set<string>,
  dateFields: Set<string>,
  decimalFields: Set<string>
): Promise<{ inserted: number; skipped: number; errors: number }> {
  // Filter each row to only valid columns, convert types for Prisma
  const filteredRows = rows.map((row) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!validFields.has(k)) continue; // skip LLM-hallucinated columns
      if (v === undefined || v === null) continue; // skip nulls/undefined
      // Prisma expects Date objects for DateTime fields
      if (dateFields.has(k) && typeof v === "string") {
        const d = new Date(v);
        clean[k] = isNaN(d.getTime()) ? v : d;
      } else {
        clean[k] = v;
      }
    }
    return clean;
  });

  if (filteredRows.length === 0) return { inserted: 0, skipped: rows.length, errors: 0 };

  try {
    const result = await (prisma as any)[accessor].createMany({
      data: filteredRows,
      skipDuplicates: true,
    });
    return { inserted: result.count, skipped: rows.length - result.count, errors: 0 };
  } catch (e: any) {
    const msg = e.message ?? "";
    // FK violation — log and continue
    if (msg.includes("foreign key") || msg.includes("violates")) {
      console.log(`    ⚠️ ${modelName}: FK error — ${msg.slice(0, 120)}`);
      return { inserted: 0, skipped: 0, errors: rows.length };
    }
    // Other errors — try row-by-row to isolate bad rows
    console.log(`    ⚠️ ${modelName}: batch failed (${msg.slice(0, 80)}), trying row-by-row...`);
    let inserted = 0;
    let errors = 0;
    for (const row of filteredRows) {
      try {
        const r = await (prisma as any)[accessor].createMany({ data: [row], skipDuplicates: true });
        inserted += r.count;
      } catch {
        errors++;
      }
    }
    return { inserted, skipped: 0, errors };
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dirArg = args.find((a) => a.startsWith("--dir="));
  const outputDir = dirArg ? dirArg.split("=")[1] : DEFAULT_DIR;
  const filterModules = args.filter((a) => !a.startsWith("--"));

  console.log(`=== SEED DATA IMPORTER (Prisma createMany) ===`);
  console.log(`Reading from: ${path.resolve(outputDir)}`);
  if (dryRun) console.log(`⚠️ DRY RUN — no DB writes\n`);

  const modelInfoMap = buildModelInfo(prisma);
  console.log(`Schema models loaded: ${modelInfoMap.size}`);

  // Verify accessors work
  let accessorOk = 0;
  for (const [, info] of modelInfoMap) {
    if ((prisma as any)[info.accessor]?.createMany) accessorOk++;
  }
  console.log(`Prisma accessors verified: ${accessorOk}/${modelInfoMap.size}`);

  const loaded = loadJsonFiles(outputDir, filterModules.length > 0 ? filterModules : undefined);
  if (loaded.length === 0) {
    console.error("❌ No JSON files found to import.");
    process.exit(1);
  }

  // Sort loaded modules by priority
  const priorityRank = new Map<string, number>();
  let rank = 0;
  for (const tier of PRIORITY_ORDER) {
    for (const mod of tier.modules) priorityRank.set(mod, rank++);
  }
  loaded.sort((a, b) => (priorityRank.get(a.module) ?? 999) - (priorityRank.get(b.module) ?? 999));

  console.log(`Modules to import: ${loaded.length}\n`);

  const report: ModuleReport[] = [];
  const start = Date.now();

  for (const { module, data } of loaded) {
    const modelCount = Object.keys(data).length;
    const rowCount = Object.values(data).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0);

    console.log(`${module} (${modelCount} models, ${rowCount} rows)...`);

    let modInserted = 0;
    let modSkipped = 0;
    let modErrors = 0;

    for (const [modelName, rows] of Object.entries(data)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const info = modelInfoMap.get(modelName);
      if (!info) {
        console.log(`    ⚠️ ${modelName}: not in Prisma schema, skipping ${rows.length} rows`);
        modSkipped += rows.length;
        continue;
      }

      // Check for LLM-hallucinated columns
      const rowKeys = new Set<string>();
      for (const row of rows) {
        for (const k of Object.keys(row)) rowKeys.add(k);
      }
      const unknownCols = [...rowKeys].filter((k) => !info.allFields.has(k));
      if (unknownCols.length > 0) {
        console.log(`    🧹 ${modelName}: filtering ${unknownCols.length} unknown columns: ${unknownCols.join(", ")}`);
      }

      const parentField = PARENT_FIELDS[modelName];
      const rowsToInsert = parentField ? sortParentFirst(rows, parentField) : rows;

      if (dryRun) {
        const validRowCount = rowsToInsert.filter((r: any) => r.name).length;
        modInserted += validRowCount;
        console.log(`    [DRY] ${modelName} → prisma.${info.accessor}.createMany(): ${validRowCount} rows`);
      } else {
        const s = await insertRows(modelName, info.accessor, rowsToInsert, info.allFields, info.dateFields, info.decimalFields);
        modInserted += s.inserted;
        modSkipped += s.skipped;
        modErrors += s.errors;
      }
    }

    report.push({ name: module, models: modelCount, inserted: modInserted, skipped: modSkipped, errors: modErrors });

    if (!dryRun) {
      console.log(`  ✅ ${modInserted} inserted | ${modSkipped} skipped | ${modErrors} errors`);
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);

  // ── FINAL REPORT ─────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`              IMPORT REPORT`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.table(
    report.map((r) => ({
      Module: r.name,
      Models: r.models,
      Inserted: r.inserted,
      Skipped: r.skipped,
      Errors: r.errors,
    }))
  );

  const totalInserted = report.reduce((s, r) => s + r.inserted, 0);
  const totalSkipped = report.reduce((s, r) => s + r.skipped, 0);
  const totalErrors = report.reduce((s, r) => s + r.errors, 0);

  console.log(`\n=== DONE in ${duration}s ===`);
  console.log(`Modules imported: ${report.length}`);
  console.log(`Total rows inserted: ${totalInserted}`);
  console.log(`Total skipped (dup): ${totalSkipped}`);
  console.log(`Total errors:        ${totalErrors}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
