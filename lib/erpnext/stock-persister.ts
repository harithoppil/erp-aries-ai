/**
 * Stock Ledger Persister — Inserts and reverses stock ledger entries inside
 * a transaction. Also updates bin quantities (actual stock per item+warehouse).
 *
 * Takes StockLedgerEntry[] from controller output and persists them into the
 * `erpnext_port.StockLedgerEntry` table, then adjusts the `erpnext_port.Bin`
 * table for running qty totals.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - All functions receive a Prisma transaction client (`tx`) as the first
 *   parameter — they NEVER start their own transaction.
 * - Uses `getDelegateByAccessor` from prisma-delegate for dynamic model access.
 */

import { getDelegateByAccessor, type PrismaDelegate } from "./prisma-delegate";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Simplified stock ledger entry from controller output */
export interface StockLedgerEntryInput {
  itemCode: string;
  warehouse: string;
  actualQty: number;
  valuationRate: number;
  stockValueType: string;
  voucherType: string;
  voucherNo: string;
  voucherDetailNo: string;
  postingDate: Date;
  postingTime: string;
  company: string;
  fiscalYear: string;
  serialNo?: string;
  batchNo?: string;
  project?: string;
}

/** Internal representation mapped to the StockLedgerEntry Prisma model */
interface StockLedgerEntryRow {
  name: string;
  creation: Date;
  modified: Date;
  modified_by: string;
  owner: string;
  docstatus: number;
  idx: number;
  item_code: string;
  serial_no?: string;
  batch_no?: string;
  warehouse: string;
  posting_date: Date;
  posting_time: string;
  voucher_type: string;
  voucher_no: string;
  voucher_detail_no: string;
  actual_qty: number;
  incoming_rate?: number;
  outgoing_rate?: number;
  stock_uom?: string;
  valuation_rate: number;
  company: string;
  fiscal_year: string;
  is_cancelled: boolean;
  to_rename: boolean;
  project?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let sleCounter = 0;

/**
 * Generate a unique name for a Stock Ledger Entry row.
 */
function generateSLEName(voucherNo: string): string {
  sleCounter += 1;
  const hash = Math.random().toString(36).substring(2, 12);
  return `${voucherNo}-SLE-${hash}-${sleCounter}`;
}

/**
 * Resolve the stockLedgerEntry delegate from the transaction client.
 */
function getSLEDelegate(tx: Record<string, unknown>): PrismaDelegate | null {
  return getDelegateByAccessor(tx, "stockLedgerEntry");
}

/**
 * Resolve the bin delegate from the transaction client.
 * The `bins` model is in the `public` schema.
 */
function getBinDelegate(tx: Record<string, unknown>): PrismaDelegate | null {
  return getDelegateByAccessor(tx, "bins");
}

/* ------------------------------------------------------------------ */
/*  Persist Stock Ledger Entries                                       */
/* ------------------------------------------------------------------ */

/**
 * Persist stock ledger entries into the database inside an existing transaction.
 *
 * Maps the simplified StockLedgerEntryInput from controller output to the full
 * StockLedgerEntry Prisma model and inserts them in bulk.
 *
 * @param tx      - Prisma transaction client
 * @param entries - Array of stock ledger entry inputs from the controller
 * @returns Number of entries inserted
 */
export async function persistStockLedgerEntries(
  tx: Record<string, unknown>,
  entries: StockLedgerEntryInput[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const delegate = getSLEDelegate(tx);
  if (!delegate) {
    throw new Error("StockLedgerEntry model not found in Prisma schema");
  }

  const now = new Date();
  const rows: StockLedgerEntryRow[] = entries.map((entry, idx) => ({
    name: generateSLEName(entry.voucherNo),
    creation: now,
    modified: now,
    modified_by: "Administrator",
    owner: "Administrator",
    docstatus: 1,
    idx: idx + 1,
    item_code: entry.itemCode,
    serial_no: entry.serialNo,
    batch_no: entry.batchNo,
    warehouse: entry.warehouse,
    posting_date: entry.postingDate,
    posting_time: entry.postingTime,
    voucher_type: entry.voucherType,
    voucher_no: entry.voucherNo,
    voucher_detail_no: entry.voucherDetailNo,
    actual_qty: entry.actualQty,
    incoming_rate: entry.actualQty > 0 ? entry.valuationRate : undefined,
    outgoing_rate: entry.actualQty < 0 ? entry.valuationRate : undefined,
    stock_uom: "Nos",
    valuation_rate: entry.valuationRate,
    company: entry.company,
    fiscal_year: entry.fiscalYear,
    is_cancelled: false,
    to_rename: true,
    project: entry.project,
  }));

  await delegate.createMany({
    data: rows as unknown[],
    skipDuplicates: true,
  });

  // After inserting SLEs, update bins
  await updateBins(tx, entries);

  return rows.length;
}

/* ------------------------------------------------------------------ */
/*  Reverse Stock Ledger Entries                                        */
/* ------------------------------------------------------------------ */

/**
 * Reverse stock ledger entries for a voucher by:
 * 1. Marking the original entries as cancelled
 * 2. Creating mirror entries with negated qty
 * 3. Updating bin quantities
 *
 * @param tx           - Prisma transaction client
 * @param voucherType  - The voucher type (e.g. "Sales Invoice")
 * @param voucherNo    - The voucher name/number
 * @returns Number of reversal entries created
 */
export async function reverseStockLedgerEntries(
  tx: Record<string, unknown>,
  voucherType: string,
  voucherNo: string,
): Promise<number> {
  const delegate = getSLEDelegate(tx);
  if (!delegate) {
    throw new Error("StockLedgerEntry model not found in Prisma schema");
  }

  // Find all original (non-cancelled) SLEs for this voucher
  const existing = await delegate.findMany({
    where: {
      voucher_type: voucherType,
      voucher_no: voucherNo,
      is_cancelled: false,
    } as unknown,
  }) as unknown[];

  if (!Array.isArray(existing) || existing.length === 0) return 0;

  // Mark original entries as cancelled
  await delegate.updateMany({
    where: {
      voucher_type: voucherType,
      voucher_no: voucherNo,
      is_cancelled: false,
    } as unknown,
    data: {
      is_cancelled: true,
      docstatus: 2,
    } as unknown,
  });

  // Create reversal (mirror) entries — negate the qty
  const now = new Date();
  const reversalEntries: StockLedgerEntryInput[] = [];

  const reversalRows: StockLedgerEntryRow[] = (existing as Record<string, unknown>[]).map(
    (entry, idx) => {
      const originalQty = Number(entry.actual_qty ?? 0);
      const negatedQty = -originalQty;

      // Collect for bin update
      reversalEntries.push({
        itemCode: entry.item_code as string ?? "",
        warehouse: entry.warehouse as string ?? "",
        actualQty: negatedQty,
        valuationRate: Number(entry.valuation_rate ?? 0),
        stockValueType: "Stock Value",
        voucherType,
        voucherNo,
        voucherDetailNo: entry.voucher_detail_no as string ?? "",
        postingDate: now,
        postingTime: now.toTimeString().substring(0, 8),
        company: entry.company as string ?? "",
        fiscalYear: entry.fiscal_year as string ?? "",
        project: entry.project as string | undefined,
      });

      return {
        name: generateSLEName(`${voucherNo}-reverse`),
        creation: now,
        modified: now,
        modified_by: "Administrator",
        owner: "Administrator",
        docstatus: 1,
        idx: idx + 1,
        item_code: entry.item_code as string ?? "",
        serial_no: entry.serial_no as string | undefined,
        batch_no: entry.batch_no as string | undefined,
        warehouse: entry.warehouse as string ?? "",
        posting_date: now,
        posting_time: now.toTimeString().substring(0, 8),
        voucher_type: voucherType,
        voucher_no: voucherNo,
        voucher_detail_no: entry.voucher_detail_no as string ?? "",
        actual_qty: negatedQty,
        incoming_rate: negatedQty > 0 ? Number(entry.valuation_rate ?? 0) : undefined,
        outgoing_rate: negatedQty < 0 ? Number(entry.valuation_rate ?? 0) : undefined,
        stock_uom: entry.stock_uom as string | undefined ?? "Nos",
        valuation_rate: Number(entry.valuation_rate ?? 0),
        company: entry.company as string ?? "",
        fiscal_year: entry.fiscal_year as string ?? "",
        is_cancelled: false,
        to_rename: true,
        project: entry.project as string | undefined,
      };
    },
  );

  await delegate.createMany({
    data: reversalRows as unknown[],
    skipDuplicates: true,
  });

  // Update bins for the reversal quantities
  await updateBins(tx, reversalEntries);

  return reversalRows.length;
}

/* ------------------------------------------------------------------ */
/*  Update Bins                                                        */
/* ------------------------------------------------------------------ */

/**
 * Update bin quantities for each item+warehouse combination.
 *
 * For each unique item+warehouse pair in the entries:
 * - If a bin row exists, adjust `quantity` by the sum of `actualQty`
 * - If no bin row exists, create one
 *
 * The `bins` model is in the `public` schema with UUID PKs.
 * Since we don't have the item/warehouse UUIDs here, we do a
 * lookup by the `items` and `warehouses` records.
 *
 * @param tx      - Prisma transaction client
 * @param entries - Array of stock ledger entry inputs
 * @returns Number of bin rows updated or created
 */
export async function updateBins(
  tx: Record<string, unknown>,
  entries: StockLedgerEntryInput[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const binDelegate = getBinDelegate(tx);
  if (!binDelegate) {
    // Bin model may not be available in the erpnext_port schema.
    // This is non-fatal — the SLEs themselves are the source of truth.
    return 0;
  }

  // Aggregate qty by item+warehouse
  const deltaMap = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.itemCode}::${entry.warehouse}`;
    const current = deltaMap.get(key) ?? 0;
    deltaMap.set(key, current + entry.actualQty);
  }

  let updated = 0;

  for (const [key, delta] of deltaMap) {
    if (delta === 0) continue;

    const [itemCode, warehouseName] = key.split("::");

    // Look up item UUID and warehouse UUID from their respective tables
    const itemDelegate = getDelegateByAccessor(tx, "item");
    const warehouseDelegate = getDelegateByAccessor(tx, "warehouse");

    if (!itemDelegate || !warehouseDelegate) continue;

    // Find item by item_code (name field in erpnext_port)
    const item = await itemDelegate.findFirst({
      where: { name: itemCode } as unknown,
    }) as Record<string, unknown> | null;

    // Find warehouse by name
    const warehouse = await warehouseDelegate.findFirst({
      where: { name: warehouseName } as unknown,
    }) as Record<string, unknown> | null;

    if (!item || !warehouse) continue;

    const itemId = item.id ?? item.name;
    const warehouseId = warehouse.id ?? warehouse.name;

    // Try to find existing bin
    const existingBin = await binDelegate.findFirst({
      where: {
        item_id: itemId,
        warehouse_id: warehouseId,
      } as unknown,
    }) as Record<string, unknown> | null;

    if (existingBin) {
      const currentQty = Number(existingBin.quantity ?? 0);
      const currentRate = Number(existingBin.valuation_rate ?? 0);
      const newQty = currentQty + delta;
      const newStockValue = newQty * currentRate;

      await binDelegate.update({
        where: { id: existingBin.id } as unknown,
        data: {
          quantity: newQty,
          stock_value: newStockValue,
          updated_at: new Date(),
        } as unknown,
      });
    } else {
      // Create new bin row
      // We need a UUID — generate one
      const binId = crypto.randomUUID();
      const valuationRate = entries.find(
        (e) => e.itemCode === itemCode && e.warehouse === warehouseName,
      )?.valuationRate ?? 0;
      const stockValue = delta * valuationRate;

      await binDelegate.create({
        data: {
          id: binId,
          item_id: itemId,
          warehouse_id: warehouseId,
          quantity: delta,
          valuation_rate: valuationRate,
          stock_value: stockValue,
          updated_at: new Date(),
        } as unknown,
      });
    }

    updated += 1;
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Get SLEs for a voucher                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch existing stock ledger entries for a voucher.
 * Useful for validation and diagnostics.
 *
 * @param tx           - Prisma transaction client (or the main prisma instance)
 * @param voucherType  - The voucher type
 * @param voucherNo    - The voucher name
 * @returns Array of stock ledger entry records
 */
export async function getStockLedgerEntriesForVoucher(
  tx: Record<string, unknown>,
  voucherType: string,
  voucherNo: string,
): Promise<unknown[]> {
  const delegate = getSLEDelegate(tx);
  if (!delegate) return [];

  const entries = await delegate.findMany({
    where: {
      voucher_type: voucherType,
      voucher_no: voucherNo,
      is_cancelled: false,
    } as unknown,
  });

  return Array.isArray(entries) ? entries : [];
}
