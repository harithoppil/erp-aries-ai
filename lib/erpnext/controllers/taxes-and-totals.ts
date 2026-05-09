/**
 * Ported from erpnext/controllers/taxes_and_totals.py
 * Tax calculation engine for Sales / Purchase transactions.
 */

// Pure TypeScript logic — no Frappe runtime dependency

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TransactionItem {
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount: number;
  net_rate: number;
  net_amount: number;
  base_rate: number;
  base_amount: number;
  base_net_rate: number;
  base_net_amount: number;
  discount_percentage?: number;
  discount_amount?: number;
  price_list_rate?: number;
  pricing_rules?: string;
  item_tax_template?: string;
  item_tax_rate?: string; // JSON string {account_head: rate}
  conversion_factor?: number;
  stock_qty?: number;
  total_weight?: number;
  rejected_qty?: number;
  grant_commission?: boolean;
}

export interface TaxRow {
  idx: number;
  charge_type:
    | "Actual"
    | "On Net Total"
    | "On Previous Row Amount"
    | "On Previous Row Total"
    | "On Item Quantity";
  account_head: string;
  rate: number;
  tax_amount?: number;
  tax_amount_after_discount_amount?: number;
  net_amount?: number;
  total?: number;
  row_id?: number;
  included_in_print_rate?: boolean;
  category?: "Total" | "Valuation" | "Valuation and Total";
  add_deduct_tax?: "Add" | "Deduct";
  dont_recompute_tax?: boolean;
  // transient computation fields
  tax_fraction_for_current_item?: number;
  grand_total_fraction_for_current_item?: number;
  tax_amount_for_current_item?: number;
  grand_total_for_current_item?: number;
}

export interface TransactionDoc {
  doctype: string;
  name?: string;
  company: string;
  currency: string;
  conversion_rate: number;
  items: TransactionItem[];
  taxes: TaxRow[];
  discount_amount?: number;
  apply_discount_on?: "Net Total" | "Grand Total";
  additional_discount_percentage?: number;
  is_cash_or_non_trade_discount?: boolean;
  base_discount_amount?: number;
  shipping_rule?: string;
  total_qty?: number;
  total?: number;
  base_total?: number;
  net_total?: number;
  base_net_total?: number;
  grand_total?: number;
  base_grand_total?: number;
  total_taxes_and_charges?: number;
  rounded_total?: number;
  base_rounded_total?: number;
  rounding_adjustment?: number;
  base_rounding_adjustment?: number;
}

export interface TaxResult {
  success: boolean;
  doc?: TransactionDoc;
  error?: string;
  total_qty: number;
  total: number;
  base_total: number;
  net_total: number;
  base_net_total: number;
  grand_total: number;
  base_grand_total: number;
  total_taxes_and_charges: number;
  rounded_total: number;
  base_rounded_total: number;
  taxes: TaxRow[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function loadItemTaxRate(itemTaxRate?: string): Record<string, number> {
  if (!itemTaxRate) return {};
  try {
    return JSON.parse(itemTaxRate) as Record<string, number>;
  } catch {
    return {};
  }
}

function getTaxRate(tax: TaxRow, itemTaxMap: Record<string, number>): number {
  if (tax.account_head in itemTaxMap) {
    const r = itemTaxMap[tax.account_head];
    if (r === -1) return -1; // NOT_APPLICABLE_TAX sentinel
    return flt(r, 2);
  }
  return flt(tax.rate, 2);
}

function getCurrentTaxFraction(
  tax: TaxRow,
  itemTaxMap: Record<string, number>,
  taxes: TaxRow[]
): { fraction: number; perQty: number } {
  let fraction = 0;
  let perQty = 0;

  if (!tax.included_in_print_rate) return { fraction, perQty };

  const taxRate = getTaxRate(tax, itemTaxMap);
  if (taxRate === -1) return { fraction, perQty };

  if (tax.charge_type === "On Net Total") {
    fraction = taxRate / 100;
  } else if (tax.charge_type === "On Previous Row Amount") {
    const prev = taxes[cint(tax.row_id) - 1];
    fraction = (taxRate / 100) * (prev?.tax_fraction_for_current_item ?? 0);
  } else if (tax.charge_type === "On Previous Row Total") {
    const prev = taxes[cint(tax.row_id) - 1];
    fraction = (taxRate / 100) * (prev?.grand_total_fraction_for_current_item ?? 0);
  } else if (tax.charge_type === "On Item Quantity") {
    perQty = flt(taxRate);
  }

  if (tax.add_deduct_tax === "Deduct") {
    fraction *= -1;
    perQty *= -1;
  }

  return { fraction, perQty };
}

function cint(value: number | string | undefined): number {
  return typeof value === "number" ? Math.trunc(value) : parseInt(value ?? "0", 10);
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export function calculateTaxesAndTotals(doc: TransactionDoc): TaxResult {
  try {
    if (!doc.items || doc.items.length === 0) {
      return {
        success: false,
        error: "No items in document",
        total_qty: 0,
        total: 0,
        base_total: 0,
        net_total: 0,
        base_net_total: 0,
        grand_total: 0,
        base_grand_total: 0,
        total_taxes_and_charges: 0,
        rounded_total: 0,
        base_rounded_total: 0,
        taxes: doc.taxes ?? [],
      };
    }

    // Ensure conversion rate
    if (!doc.currency) doc.currency = doc.company;
    if (!doc.conversion_rate) doc.conversion_rate = 1.0;

    // 1. Calculate item values
    calculateItemValues(doc);

    // 2. Determine exclusive rate (reverse tax from inclusive price)
    determineExclusiveRate(doc);

    // 3. Calculate net total
    calculateNetTotal(doc);

    // 4. Calculate taxes
    calculateTaxes(doc);

    // 5. Adjust for inclusive tax rounding
    adjustGrandTotalForInclusiveTax(doc);

    // 6. Calculate totals
    calculateTotals(doc);

    // 7. Apply discount if any
    if (doc.discount_amount && doc.apply_discount_on) {
      applyDiscountAmount(doc);
      // Recalculate taxes after discount
      calculateTaxes(doc);
      adjustGrandTotalForInclusiveTax(doc);
      calculateTotals(doc);
    }

    // 8. Set rounded total
    setRoundedTotal(doc);

    return {
      success: true,
      doc,
      total_qty: flt(doc.total_qty),
      total: flt(doc.total),
      base_total: flt(doc.base_total),
      net_total: flt(doc.net_total),
      base_net_total: flt(doc.base_net_total),
      grand_total: flt(doc.grand_total),
      base_grand_total: flt(doc.base_grand_total),
      total_taxes_and_charges: flt(doc.total_taxes_and_charges),
      rounded_total: flt(doc.rounded_total),
      base_rounded_total: flt(doc.base_rounded_total),
      taxes: doc.taxes,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message ?? String(error),
      total_qty: 0,
      total: 0,
      base_total: 0,
      net_total: 0,
      base_net_total: 0,
      grand_total: 0,
      base_grand_total: 0,
      total_taxes_and_charges: 0,
      rounded_total: 0,
      base_rounded_total: 0,
      taxes: doc.taxes ?? [],
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Step implementations                                               */
/* ------------------------------------------------------------------ */

function calculateItemValues(doc: TransactionDoc): void {
  for (const item of doc.items) {
    // Apply discount percentage to rate
    if (item.discount_percentage === 100) {
      item.rate = 0;
    } else if (item.price_list_rate) {
      if (!item.rate || (item.pricing_rules && (item.discount_percentage ?? 0) > 0)) {
        item.rate = flt(
          item.price_list_rate * (1.0 - (item.discount_percentage ?? 0) / 100.0),
          2
        );
        item.discount_amount = flt(
          item.price_list_rate * ((item.discount_percentage ?? 0) / 100.0),
          2
        );
      } else if (item.discount_amount && item.pricing_rules) {
        item.rate = flt(item.price_list_rate - item.discount_amount, 2);
      }
    }

    item.net_rate = item.rate;
    item.amount = flt(item.rate * item.qty, 2);
    item.net_amount = item.amount;

    // Base currency
    item.base_rate = flt(item.rate * doc.conversion_rate, 2);
    item.base_amount = flt(item.amount * doc.conversion_rate, 2);
    item.base_net_rate = flt(item.net_rate * doc.conversion_rate, 2);
    item.base_net_amount = flt(item.net_amount * doc.conversion_rate, 2);
  }
}

function determineExclusiveRate(doc: TransactionDoc): void {
  const hasInclusive = doc.taxes?.some((t) => t.included_in_print_rate);
  if (!hasInclusive) return;

  for (const item of doc.items) {
    const itemTaxMap = loadItemTaxRate(item.item_tax_rate);
    let cumulatedTaxFraction = 0;
    let totalInclusiveTaxPerQty = 0;

    const taxList = doc.taxes ?? [];
    for (let i = 0; i < taxList.length; i++) {
      const tax = taxList[i]!;
      const { fraction, perQty } = getCurrentTaxFraction(tax, itemTaxMap, taxList);

      tax.tax_fraction_for_current_item = fraction;
      tax.grand_total_fraction_for_current_item =
        i === 0 ? 1 + fraction : ((taxList[i - 1] as TaxRow).grand_total_fraction_for_current_item as number) + fraction;

      cumulatedTaxFraction += fraction;
      totalInclusiveTaxPerQty += perQty * flt(item.qty);
    }

    if (item.qty && (cumulatedTaxFraction || totalInclusiveTaxPerQty)) {
      const amount = flt(item.amount) - totalInclusiveTaxPerQty;
      item.net_amount = flt(amount / (1 + cumulatedTaxFraction), 2);
      item.net_rate = flt(item.net_amount / item.qty, 2);

      item.base_net_rate = flt(item.net_rate * doc.conversion_rate, 2);
      item.base_net_amount = flt(item.net_amount * doc.conversion_rate, 2);
    }
  }
}

function calculateNetTotal(doc: TransactionDoc): void {
  doc.total = 0;
  doc.total_qty = 0;
  doc.base_total = 0;
  doc.net_total = 0;
  doc.base_net_total = 0;

  for (const item of doc.items) {
    doc.total = flt((doc.total ?? 0) + item.amount, 2);
    doc.total_qty = flt((doc.total_qty ?? 0) + item.qty, 2);
    doc.base_total = flt((doc.base_total ?? 0) + item.base_amount, 2);
    doc.net_total = flt((doc.net_total ?? 0) + item.net_amount, 2);
    doc.base_net_total = flt((doc.base_net_total ?? 0) + item.base_net_amount, 2);
  }
}

function calculateTaxes(doc: TransactionDoc): void {
  if (!doc.taxes || doc.taxes.length === 0) return;

  // Reset tax accumulators
  for (const tax of doc.taxes) {
    tax.tax_amount = 0;
    tax.tax_amount_after_discount_amount = 0;
    tax.net_amount = 0;
    tax.tax_amount_for_current_item = 0;
    tax.grand_total_for_current_item = 0;
  }

  // Maintain actual tax dict for distribution
  const actualTaxDict: Record<number, number> = {};
  for (const tax of doc.taxes) {
    if (tax.charge_type === "Actual") {
      actualTaxDict[tax.idx] = flt(tax.tax_amount ?? 0, 2);
    }
  }

  for (let n = 0; n < doc.items.length; n++) {
    const item = doc.items[n];
    const itemTaxMap = loadItemTaxRate(item.item_tax_rate);

    const taxList = doc.taxes ?? [];
    for (let i = 0; i < taxList.length; i++) {
      const tax = taxList[i]!;
      const { currentTaxAmount, currentNetAmount } = getCurrentTaxAndNetAmount(
        item,
        tax,
        itemTaxMap,
        taxList,
        doc.net_total ?? 0
      );

      let adjustedTax = currentTaxAmount;

      // Adjust divisional loss to last item for Actual charge type
      if (tax.charge_type === "Actual") {
        actualTaxDict[tax.idx] = flt(actualTaxDict[tax.idx] - adjustedTax, 2);
        if (n === doc.items.length - 1) {
          adjustedTax = flt(adjustedTax + actualTaxDict[tax.idx], 2);
        }
      }

      if (tax.charge_type !== "Actual") {
        tax.tax_amount = flt((tax.tax_amount ?? 0) + adjustedTax, 2);
        tax.net_amount = flt((tax.net_amount ?? 0) + currentNetAmount, 2);
      }

      tax.tax_amount_for_current_item = adjustedTax;
      tax.tax_amount_after_discount_amount = flt(
        (tax.tax_amount_after_discount_amount ?? 0) + adjustedTax,
        2
      );

      // grand_total_for_current_item
      if (i === 0) {
        tax.grand_total_for_current_item = flt(item.net_amount + adjustedTax, 2);
      } else {
        tax.grand_total_for_current_item = flt(
          ((taxList[i - 1] as TaxRow).grand_total_for_current_item as number) + adjustedTax,
          2
        );
      }
    }
  }

  // Set cumulative totals
  const taxList = doc.taxes ?? [];
  for (let i = 0; i < taxList.length; i++) {
    setCumulativeTotal(i, taxList[i]!, doc.net_total ?? 0, taxList);
  }
}

function getCurrentTaxAndNetAmount(
  item: TransactionItem,
  tax: TaxRow,
  itemTaxMap: Record<string, number>,
  taxes: TaxRow[],
  netTotal: number
): { currentTaxAmount: number; currentNetAmount: number } {
  const taxRate = getTaxRate(tax, itemTaxMap);
  let currentTaxAmount = 0;
  let currentNetAmount = 0;

  if (taxRate === -1) return { currentTaxAmount, currentNetAmount };

  if (tax.charge_type === "Actual") {
    currentNetAmount = item.net_amount;
    currentTaxAmount = netTotal ? flt((item.net_amount * flt(tax.tax_amount ?? 0)) / netTotal, 2) : 0;
  } else if (tax.charge_type === "On Net Total") {
    if (tax.account_head in itemTaxMap) currentNetAmount = item.net_amount;
    currentTaxAmount = flt((taxRate / 100.0) * item.net_amount, 2);
  } else if (tax.charge_type === "On Previous Row Amount") {
    const prev = taxes[cint(tax.row_id) - 1];
    currentNetAmount = prev?.tax_amount_for_current_item ?? 0;
    currentTaxAmount = flt((taxRate / 100.0) * currentNetAmount, 2);
  } else if (tax.charge_type === "On Previous Row Total") {
    const prev = taxes[cint(tax.row_id) - 1];
    currentNetAmount = prev?.grand_total_for_current_item ?? 0;
    currentTaxAmount = flt((taxRate / 100.0) * currentNetAmount, 2);
  } else if (tax.charge_type === "On Item Quantity") {
    currentTaxAmount = flt(taxRate * item.qty, 2);
  }

  return { currentTaxAmount, currentNetAmount };
}

function setCumulativeTotal(rowIdx: number, tax: TaxRow, netTotal: number, taxes: TaxRow[]): void {
  const taxAmount = tax.tax_amount_after_discount_amount ?? 0;

  if (rowIdx === 0) {
    tax.total = flt(netTotal + taxAmount, 2);
  } else {
    tax.total = flt((taxes[rowIdx - 1].total ?? 0) + taxAmount, 2);
  }
}

function adjustGrandTotalForInclusiveTax(doc: TransactionDoc): void {
  if (!doc.taxes?.some((t) => t.included_in_print_rate)) return;

  const taxList = doc.taxes ?? [];
  const lastTax = taxList[taxList.length - 1]!;
  const nonInclusiveTaxAmount = doc.taxes
    .filter((d) => !d.included_in_print_rate)
    .reduce((sum, d) => sum + (d.tax_amount_after_discount_amount ?? 0), 0);

  const diff = flt(
    (doc.total ?? 0) + nonInclusiveTaxAmount - flt(lastTax.total ?? 0, 2),
    2
  );

  if (diff && Math.abs(diff) <= 0.05) {
    doc.grand_total = flt((lastTax.total ?? 0) + diff, 2);
  }
}

function calculateTotals(doc: TransactionDoc): void {
  const taxList = doc.taxes ?? [];
  const grandTotalDiff = doc.grand_total ? flt(doc.grand_total - (taxList[taxList.length - 1]?.total ?? 0), 2) : 0;

  if (taxList.length > 0) {
    doc.grand_total = flt(((taxList[taxList.length - 1] as TaxRow).total as number) + grandTotalDiff, 2);
  } else {
    doc.grand_total = flt(doc.net_total, 2);
  }

  if (doc.taxes && doc.taxes.length > 0) {
    doc.total_taxes_and_charges = flt(
      (doc.grand_total ?? 0) - (doc.net_total ?? 0) - grandTotalDiff,
      2
    );
  } else {
    doc.total_taxes_and_charges = 0;
  }

  doc.base_grand_total = flt((doc.grand_total ?? 0) * doc.conversion_rate, 2);
}

function applyDiscountAmount(doc: TransactionDoc): void {
  if (!doc.discount_amount || !doc.apply_discount_on) return;

  const total = doc.apply_discount_on === "Net Total" ? doc.net_total : doc.grand_total;
  if (!total) return;

  const discount = doc.discount_amount;
  const ratio = discount / total;

  for (const item of doc.items) {
    const itemDiscount = flt((item.net_amount ?? 0) * ratio, 2);
    item.net_amount = flt((item.net_amount ?? 0) - itemDiscount, 2);
    item.base_net_amount = flt(item.net_amount * doc.conversion_rate, 2);
  }

  // Recalculate net total after discount
  doc.net_total = doc.items.reduce((sum, item) => sum + (item.net_amount ?? 0), 0);
  doc.base_net_total = flt((doc.net_total ?? 0) * doc.conversion_rate, 2);
}

function setRoundedTotal(doc: TransactionDoc): void {
  const precision = 2;
  doc.rounded_total = Math.round((doc.grand_total ?? 0) * 10 ** precision) / 10 ** precision;
  doc.base_rounded_total = flt(doc.rounded_total * doc.conversion_rate, 2);
  doc.rounding_adjustment = flt(doc.rounded_total - (doc.grand_total ?? 0), 2);
  doc.base_rounding_adjustment = flt(doc.rounding_adjustment * doc.conversion_rate, 2);
}
