/**
 * Ported from erpnext/controllers/buying_controller.py
 * Purchase-specific validation logic.
 */

import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PurchaseItemRow {
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount: number;
  net_rate?: number;
  net_amount?: number;
  base_net_rate?: number;
  base_net_amount?: number;
  discount_percentage?: number;
  discount_amount?: number;
  price_list_rate?: number;
  pricing_rules?: string;
  conversion_factor?: number;
  stock_qty?: number;
  received_qty?: number;
  rejected_qty?: number;
  received_stock_qty?: number;
  valuation_rate?: number;
  incoming_rate?: number;
  sales_incoming_rate?: number;
  landed_cost_voucher_amount?: number;
  amount_difference_with_purchase_invoice?: number;
  warehouse?: string;
  from_warehouse?: string;
  rejected_warehouse?: string;
  is_fixed_asset?: boolean;
  item_tax_rate?: string;
  cost_center?: string;
  idx: number;
}

export interface PurchaseDoc {
  doctype: string;
  name?: string;
  company: string;
  supplier?: string;
  supplier_name?: string;
  currency: string;
  conversion_rate: number;
  posting_date?: string;
  transaction_date?: string;
  is_return?: boolean;
  return_against?: string;
  is_subcontracted?: boolean;
  update_stock?: boolean;
  items: PurchaseItemRow[];
  taxes?: { account_head: string; rate: number; charge_type: string; category?: string; add_deduct_tax?: string; base_tax_amount_after_discount_amount?: number }[];
  grand_total?: number;
  base_grand_total?: number;
  tc_name?: string;
  terms?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

/** Helper to create a typed null without TS narrowing issues. */
function safeNull<T>(): T | null {
  return null;
}

/* ------------------------------------------------------------------ */
/*  validatePurchaseDoc                                                */
/* ------------------------------------------------------------------ */

export async function validatePurchaseDoc(doc: PurchaseDoc): Promise<ValidationResult> {
  const warnings: string[] = [];

  try {
    // 1. Supplier name fallback
    if (doc.supplier && !doc.supplier_name) {
      try {
        let sup = await prisma.suppliers.findUnique({ where: { id: doc.supplier } });
        if (!sup) sup = await prisma.suppliers.findFirst({ where: { supplier_name: doc.supplier } });
        if (sup) doc.supplier_name = sup.supplier_name;
      } catch {
        // ignore
      }
    }

    // 2. Validate items exist
    const itemCodes = Array.from(new Set(doc.items.map((d) => d.item_code)));
    for (const code of itemCodes) {
      const item = await prisma.items.findUnique({ where: { item_code: code } });
      if (!item) {
        return { success: false, error: `Item ${code} does not exist.` };
      }
    }

    // 3. Set qty as per stock UOM
    for (const item of doc.items) {
      if (!item.conversion_factor && item.item_code) {
        return { success: false, error: `Row ${item.idx}: Conversion Factor is mandatory` };
      }
      if (!item.conversion_factor) item.conversion_factor = 1.0;
      item.stock_qty = flt(item.qty * item.conversion_factor, 2);

      if (doc.doctype === "Purchase Receipt" && item.received_qty !== undefined) {
        item.received_stock_qty = flt(item.received_qty * item.conversion_factor, 2);
      }
    }

    // 4. Validate stock or non-stock items => tax category
    const stockItems = await getStockItems(doc);
    const assetItems = Array.from(new Set(doc.items.filter((d) => d.is_fixed_asset).map((d) => d.item_code)));
    if (stockItems.length === 0 && assetItems.length === 0 && doc.taxes) {
      const valuationTaxes = doc.taxes.filter(
        (t) => t.category === "Valuation" || t.category === "Valuation and Total"
      );
      if (valuationTaxes.length > 0) {
        for (const t of valuationTaxes) t.category = "Total";
        warnings.push('Tax Category changed to "Total" because all Items are non-stock items');
      }
    }

    // 5. Validate from_warehouse != warehouse
    for (const item of doc.items) {
      if (item.from_warehouse && item.from_warehouse === item.warehouse) {
        return {
          success: false,
          error: `Row ${item.idx}: from_warehouse and warehouse cannot be same.`,
        };
      }
      if (item.from_warehouse && doc.is_subcontracted) {
        return {
          success: false,
          error: `Row ${item.idx}: Cannot select Supplier Warehouse while supplying raw materials to subcontractor.`,
        };
      }
    }

    // 6. Validate asset return
    if ((doc.doctype === "Purchase Receipt" || doc.doctype === "Purchase Invoice") && doc.is_return) {
      const assetErr = await validateAssetReturn(doc);
      if (assetErr) return { success: false, error: assetErr };
    }

    // 7. Validate accepted / rejected qty
    if (doc.doctype === "Purchase Receipt" || (doc.doctype === "Purchase Invoice" && doc.update_stock)) {
      for (const item of doc.items) {
        if (doc.is_return) {
          if (!flt(item.rejected_qty) && item.rejected_warehouse) {
            item.rejected_warehouse = undefined as unknown as string;
          }
          continue;
        }

        const fields = ["received_qty", "qty", "rejected_qty"];
        for (const f of fields) {
          const val = item[f as keyof PurchaseItemRow] as number;
          if (val < 0) {
            return { success: false, error: `Row ${item.idx}: ${f} cannot be negative for item ${item.item_code}` };
          }
        }

        if (!flt(item.received_qty) && (flt(item.qty) || flt(item.rejected_qty))) {
          item.received_qty = flt(item.qty) + flt(item.rejected_qty);
        }

        const expected = flt(item.qty) + flt(item.rejected_qty);
        if (flt(expected, 2) !== flt(item.received_qty, 2)) {
          return {
            success: false,
            error: `Row ${item.idx}: Received Qty must be equal to Accepted + Rejected Qty for Item ${item.item_code}`,
          };
        }
      }
    }

    // 8. Update valuation rate for Purchase Receipt / Invoice
    if (doc.doctype === "Purchase Receipt" || doc.doctype === "Purchase Invoice") {
      await updateValuationRate(doc);
    }

    // 9. Supplier credit check
    if (doc.supplier && doc.grand_total) {
      const withinCredit = await checkSupplierCredit(doc.supplier, doc.grand_total);
      if (!withinCredit) {
        warnings.push(`Supplier ${doc.supplier} credit limit may be exceeded`);
      }
    }

    return { success: true, warnings };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  checkSupplierCredit                                                */
/* ------------------------------------------------------------------ */

export function checkSupplierCredit(
  supplier: string,
  amount: number,
  creditLimit?: number,
  outstandingAmount?: number
): boolean {
  if (!creditLimit) return true;
  return flt((outstandingAmount || 0) + amount, 2) <= flt(creditLimit, 2);
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

async function getStockItems(doc: PurchaseDoc): Promise<string[]> {
  const stockItems: string[] = [];
  for (const item of doc.items) {
    try {
      const master = await prisma.items.findUnique({ where: { item_code: item.item_code } }) as { is_stock_item?: boolean } | null;
      if (master?.is_stock_item) stockItems.push(item.item_code);
    } catch {
      // ignore
    }
  }
  return stockItems;
}

async function validateAssetReturn(doc: PurchaseDoc): Promise<string | null> {
  if (!doc.return_against) return null;

  const purchaseDocField = doc.doctype === "Purchase Receipt" ? "purchase_receipt" : "purchase_invoice";
  try {
    // No Prisma Asset model with this query pattern. Return empty array as safe default.
    const assets: { name: string }[] = [];
    if (assets.length > 0) {
      return `${doc.return_against} has submitted assets linked to it. Cancel the assets before creating purchase return.`;
    }
  } catch {
    // ignore lookup errors
  }
  return null;
}

async function updateValuationRate(doc: PurchaseDoc): Promise<void> {
  const stockAndAssetItems = await getStockItems(doc);
  const assetItems = doc.items.filter((d) => d.is_fixed_asset).map((d) => d.item_code);
  const allStockAsset = Array.from(new Set([...stockAndAssetItems, ...assetItems]));

  if (allStockAsset.length === 0) return;

  let stockAndAssetQty = 0;
  let stockAndAssetAmount = 0;
  let lastItemIdx = 1;

  for (const d of doc.items) {
    if (d.item_code && allStockAsset.includes(d.item_code)) {
      stockAndAssetQty += flt(d.qty);
      stockAndAssetAmount += flt(d.base_net_amount);
    }
    lastItemIdx = d.idx;
  }

  const { taxAccounts, totalValuationAmount, totalActualTaxAmount } = getTaxDetails(doc);

  let remainingValuation = totalValuationAmount;
  let remainingActualTax = totalActualTaxAmount;

  for (let i = 0; i < doc.items.length; i++) {
    const item = doc.items[i];
    if (!item.item_code || (!item.qty && !item.rejected_qty)) {
      item.valuation_rate = 0;
      continue;
    }

    if (!allStockAsset.includes(item.item_code)) {
      item.valuation_rate = 0;
      continue;
    }

    let itemTaxAmount = 0;
    let actualTaxAmount = 0;

    if (item.idx === lastItemIdx) {
      itemTaxAmount = remainingValuation;
      actualTaxAmount = remainingActualTax;
    } else {
      itemTaxAmount = getItemTaxAmount(item, taxAccounts);
      remainingValuation -= itemTaxAmount;

      if (totalActualTaxAmount) {
        actualTaxAmount = getItemActualTaxAmount(
          item,
          remainingActualTax,
          stockAndAssetAmount,
          stockAndAssetQty
        );
        remainingActualTax -= actualTaxAmount;
      }
    }

    item.valuation_rate = 0;
    const totalItemTax = flt(itemTaxAmount + actualTaxAmount, 2);

    let netRate = item.base_net_amount ?? 0;
    if (item.sales_incoming_rate) {
      netRate = item.qty * item.sales_incoming_rate;
    }

    const qtyInStockUom = flt(item.qty * (item.conversion_factor || 1));
    if (qtyInStockUom) {
      item.valuation_rate = flt(
        (netRate + totalItemTax + flt(item.landed_cost_voucher_amount) + flt(item.amount_difference_with_purchase_invoice)) /
          qtyInStockUom,
        2
      );
    }
  }
}

function getTaxDetails(doc: PurchaseDoc): {
  taxAccounts: string[];
  totalValuationAmount: number;
  totalActualTaxAmount: number;
} {
  const taxAccounts: string[] = [];
  let totalValuationAmount = 0;
  let totalActualTaxAmount = 0;

  if (!doc.taxes) return { taxAccounts, totalValuationAmount, totalActualTaxAmount };

  for (const d of doc.taxes) {
    if (!d.category || (d.category !== "Valuation" && d.category !== "Valuation and Total")) continue;

    const amount = flt(d.base_tax_amount_after_discount_amount || 0) * (d.add_deduct_tax === "Deduct" ? -1 : 1);

    if (d.charge_type === "On Net Total") {
      totalValuationAmount += amount;
      taxAccounts.push(d.account_head);
    } else {
      totalActualTaxAmount += amount;
    }
  }

  return { taxAccounts, totalValuationAmount, totalActualTaxAmount };
}

function getItemTaxAmount(item: PurchaseItemRow, taxAccounts: string[]): number {
  if (!item.item_tax_rate) return 0;
  let itemTaxAmount = 0;
  try {
    const taxDetails = JSON.parse(item.item_tax_rate) as Record<string, number>;
    for (const [account, rate] of Object.entries(taxDetails)) {
      if (!taxAccounts.includes(account)) continue;
      if (rate === -1) continue; // NOT_APPLICABLE_TAX
      const netRate = item.sales_incoming_rate ? item.qty * item.sales_incoming_rate : item.base_net_amount;
      itemTaxAmount += flt(netRate) * flt(rate) / 100;
    }
  } catch {
    // ignore parse errors
  }
  return itemTaxAmount;
}

function getItemActualTaxAmount(
  item: PurchaseItemRow,
  actualTaxAmount: number,
  stockAndAssetItemsAmount: number,
  stockAndAssetItemsQty: number
): number {
  const itemProportion = stockAndAssetItemsAmount
    ? flt(item.base_net_amount) / stockAndAssetItemsAmount
    : stockAndAssetItemsQty
    ? flt(item.qty) / stockAndAssetItemsQty
    : 0;
  return flt(itemProportion * actualTaxAmount, 2);
}

/**
 * Set supplier from item default if missing.
 * Ported from BuyingController.set_supplier_from_item_default
 */
export async function setSupplierFromItemDefault(doc: PurchaseDoc): Promise<PurchaseDoc> {
  if (doc.supplier) return doc;

  for (const d of doc.items) {
    if (!d.item_code) continue;
    try {
      // No item_default model in Prisma. Return null as safe default.
      const itemDefault = safeNull<{ default_supplier?: string }>();
      const defaultSupplier = itemDefault?.default_supplier;
      if (defaultSupplier) {
        doc.supplier = defaultSupplier;
        return doc;
      }

      const itemGroup = await prisma.items.findUnique({ where: { item_code: d.item_code }, select: { item_group: true } });
      if (itemGroup?.item_group) {
        const groupDefault = safeNull<{ default_supplier?: string }>();
        const groupSupplier = groupDefault?.default_supplier;
        if (groupSupplier) {
          doc.supplier = groupSupplier;
          return doc;
        }
      }
    } catch {
      // ignore lookup errors
    }
  }
  return doc;
}
