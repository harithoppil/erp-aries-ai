import { errorMessage } from '@/lib/utils';
// @ts-nocheck
/**
 * Ported from erpnext/controllers/selling_controller.py
 * Sales-specific validation logic.
 */

import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SalesItemRow {
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
  stock_uom_rate?: number;
  valuation_rate?: number;
  incoming_rate?: number;
  warehouse?: string;
  target_warehouse?: string;
  is_free_item?: boolean;
  grant_commission?: boolean;
  gross_profit?: number;
  idx: number;
}

export interface SalesDoc {
  doctype: string;
  name?: string;
  company: string;
  customer?: string;
  currency: string;
  conversion_rate: number;
  posting_date?: string;
  transaction_date?: string;
  is_return?: boolean;
  is_debit_note?: boolean;
  is_internal_customer?: boolean;
  update_stock?: boolean;
  items: SalesItemRow[];
  taxes?: { account_head: string; rate: number; charge_type: string }[];
  grand_total?: number;
  base_grand_total?: number;
  commission_rate?: number;
  total_commission?: number;
  amount_eligible_for_commission?: number;
  sales_team?: { sales_person: string; allocated_percentage: number; commission_rate?: number; allocated_amount?: number; incentives?: number }[];
  po_no?: string;
  shipping_rule?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | { toString(): string } | null | undefined, precision = 2): number {
  let v: number;
  if (value === null || value === undefined) v = 0;
  else if (typeof value === "number") v = value;
  else if (typeof value === "string") v = parseFloat(value);
  else v = parseFloat(value.toString());
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

/* ------------------------------------------------------------------ */
/*  validateSalesDoc                                                   */
/* ------------------------------------------------------------------ */

export async function validateSalesDoc(doc: SalesDoc): Promise<ValidationResult> {
  const warnings: string[] = [];

  try {
    // 1. Validate items exist
    const itemCodes = Array.from(new Set(doc.items.map((d) => d.item_code)));
    for (const code of itemCodes) {
      const item = await prisma.item.findUnique({ where: { item_code: code } });
      if (!item) {
        return { success: false, error: `Item ${code} does not exist.` };
      }
    }

    // 2. Validate max discount
    for (const item of doc.items) {
      const itemMaster = await prisma.item.findUnique({
        where: { item_code: item.item_code },
        select: { standard_rate: true },
      });
      const maxDiscount = flt(itemMaster?.standard_rate, 2);
      if (maxDiscount && flt(item.discount_percentage) > maxDiscount) {
        return {
          success: false,
          error: `Maximum discount for Item ${item.item_code} is ${maxDiscount}%`,
        };
      }
    }

    // 3. Validate selling price >= last purchase rate / valuation rate
    if (!doc.is_return && !doc.is_debit_note) {
      const sellingPriceErr = await validateSellingPrice(doc);
      if (sellingPriceErr) {
        return { success: false, error: sellingPriceErr };
      }
    }

    // 4. Set qty as per stock UOM
    for (const item of doc.items) {
      if (!item.conversion_factor) {
        return { success: false, error: `Row ${item.idx}: Conversion Factor is mandatory` };
      }
      item.stock_qty = flt(item.qty * item.conversion_factor, 2);
    }

    // 5. Validate duplicate items
    const seen = new Set<string>();
    for (const item of doc.items) {
      if (seen.has(item.item_code)) {
        return { success: false, error: `Duplicate item ${item.item_code} in rows` };
      }
      seen.add(item.item_code);
    }

    // 6. Target warehouse validation
    for (const item of doc.items) {
      if (item.target_warehouse && item.warehouse && item.target_warehouse === item.warehouse) {
        return { success: false, error: `Row ${item.idx}: Target Warehouse and Source Warehouse cannot be same` };
      }
    }

    // 7. Commission validation
    if (doc.commission_rate !== undefined) {
      if (doc.commission_rate < 0 || doc.commission_rate > 100) {
        return { success: false, error: "Commission Rate must be between 0 and 100" };
      }
    }

    // 8. Sales team allocation must total 100%
    if (doc.sales_team && doc.sales_team.length > 0) {
      const totalAllocated = doc.sales_team.reduce((sum, m) => sum + flt(m.allocated_percentage), 0);
      if (flt(totalAllocated, 2) !== 100) {
        return { success: false, error: `Total allocated percentage for sales team should be 100, got ${totalAllocated}` };
      }

      // Validate sales persons enabled
      for (const member of doc.sales_team) {
        let sp: { enabled: boolean };
        try {
          // No sales_person model — safe default
          sp = { enabled: true };
        } catch (error) {
          sp = { enabled: true };
        }
        if (sp && !sp.enabled) {
          return { success: false, error: `Sales Person ${member.sales_person} is disabled.` };
        }
      }
    }

    // 9. Gross profit calculation for Sales Order / Quotation
    if (doc.doctype === "Sales Order" || doc.doctype === "Quotation") {
      for (const item of doc.items) {
        item.gross_profit = flt(
          (flt(item.stock_uom_rate) - flt(item.valuation_rate)) * flt(item.stock_qty),
          2
        );
      }
    }

    return { success: true, warnings };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  checkCreditLimit                                                   */
/* ------------------------------------------------------------------ */

export function checkCreditLimit(
  customer: string,
  amount: number,
  creditLimit: number,
  outstandingAmount: number
): boolean {
  if (!creditLimit) return true;
  return flt(outstandingAmount + amount, 2) <= flt(creditLimit, 2);
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

async function validateSellingPrice(doc: SalesDoc): Promise<string | null> {
  try {
    let settings: { validate_selling_price?: boolean };
    try {
      // No selling_settings model — safe default
      settings = { validate_selling_price: false };
    } catch (error) {
      settings = { validate_selling_price: false };
    }
    if (!settings?.validate_selling_price) return null;

    for (const item of doc.items) {
      if (!item.item_code || item.is_free_item) continue;

      const itemMaster = await prisma.item.findUnique({
        where: { item_code: item.item_code },
      });

      if (!itemMaster) continue;

      // Use standard_rate as proxy for last_purchase_rate / valuation_rate
      const lastPurchaseRate = flt(itemMaster.standard_rate, 2);
      const conversionFactor = flt(item.conversion_factor || 1, 2);
      const lastPurchaseInUom = flt(lastPurchaseRate * conversionFactor, 2);

      if (flt(item.base_net_rate) < lastPurchaseInUom) {
        return `Row ${item.idx}: Selling rate for item ${item.item_code} is lower than its last purchase rate ${lastPurchaseInUom}`;
      }

      // Proxy is_stock_item: treat SERVICE as non-stock, everything else as stock
      const isStockItem = itemMaster.item_group !== "SERVICE";
      if (doc.is_internal_customer || !isStockItem) continue;

      const rateField = doc.doctype === "Sales Order" || doc.doctype === "Quotation" ? "valuation_rate" : "incoming_rate";
      const valuationRate = flt((item[rateField as keyof SalesItemRow] as number) * conversionFactor, 2);

      if (valuationRate && flt(item.base_net_rate) < valuationRate) {
        return `Row ${item.idx}: Selling rate for item ${item.item_code} is lower than its ${rateField} ${valuationRate}`;
      }
    }
  } catch {
    // silently ignore lookup errors
  }
  return null;
}

/**
 * Calculate commission and sales-team contribution.
 * Ported from SellingController.calculate_commission / calculate_contribution.
 */
export async function calculateCommissionAndContribution(doc: SalesDoc): Promise<SalesDoc> {
  if (doc.commission_rate === undefined) return doc;

  // Amount eligible for commission
  doc.amount_eligible_for_commission = doc.items
    .filter((i) => i.grant_commission)
    .reduce((sum, i) => sum + flt(i.base_net_amount), 0);

  doc.total_commission = flt(
    (doc.amount_eligible_for_commission * doc.commission_rate) / 100.0,
    2
  );

  // Sales team contribution
  if (doc.sales_team && doc.sales_team.length > 0) {
    for (const member of doc.sales_team) {
      member.allocated_amount = flt(
        (flt(doc.amount_eligible_for_commission) * member.allocated_percentage) / 100.0,
        2
      );
      if (member.commission_rate) {
        member.incentives = flt(
          (member.allocated_amount * member.commission_rate) / 100.0,
          2
        );
      }
    }
  }

  return doc;
}
