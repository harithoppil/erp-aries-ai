/**
 * Ported from erpnext/stock/get_item_details.py
 * Pure business logic for resolving item details in transactions.
 *
 * RULES:
 * - No DB calls. All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types.
 */

import {
  ItemDoc,
  ItemDefault,
  ItemTax,
} from "./stock-item";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

export const SALES_DOCTYPES: readonly string[] = [
  "Quotation",
  "Sales Order",
  "Delivery Note",
  "Sales Invoice",
  "POS Invoice",
];

export const PURCHASE_DOCTYPES: readonly string[] = [
  "Material Request",
  "Supplier Quotation",
  "Purchase Order",
  "Purchase Receipt",
  "Purchase Invoice",
];

export const NOT_APPLICABLE_TAX = "N/A";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ItemGroupDefault {
  default_warehouse?: string;
  income_account?: string;
  expense_account?: string;
  default_cogs_account?: string;
  buying_cost_center?: string;
  selling_cost_center?: string;
  default_supplier?: string;
  default_inventory_account?: string;
  default_provisional_account?: string;
  default_discount_account?: string;
  taxes?: ItemGroupTax[];
}

export interface BrandDefault {
  default_warehouse?: string;
  income_account?: string;
  expense_account?: string;
  default_cogs_account?: string;
  buying_cost_center?: string;
  selling_cost_center?: string;
  default_supplier?: string;
  default_inventory_account?: string;
  default_provisional_account?: string;
  default_discount_account?: string;
}

export interface ItemGroupTax {
  item_tax_template?: string;
  tax_category?: string;
  minimum_net_rate?: number;
  maximum_net_rate?: number;
  valid_from?: string;
}

export interface ItemDefaultsBundle {
  itemDefaults: ItemDefault;
  itemGroupDefaults: ItemGroupDefault;
  brandDefaults: BrandDefault;
}

export interface ItemDetailsCtx {
  company: string;
  doctype: string;
  item_code?: string;
  warehouse?: string;
  customer?: string;
  supplier?: string;
  currency?: string;
  conversion_rate?: number;
  price_list?: string;
  selling_price_list?: string;
  buying_price_list?: string;
  price_list_currency?: string;
  plc_conversion_rate?: number;
  uom?: string;
  stock_uom?: string;
  qty?: number;
  transaction_date?: string;
  bill_date?: string;
  posting_date?: string;
  is_subcontracted?: boolean | number;
  ignore_pricing_rule?: boolean | number;
  project?: string;
  set_warehouse?: string;
  update_stock?: boolean | number;
  is_pos?: boolean | number;
  tax_category?: string;
  item_tax_template?: string;
  base_net_rate?: number;
  cost_center?: string;
  income_account?: string;
  expense_account?: string;
  discount_account?: string;
  discount_amount?: number;
  default_provisional_account?: string;
  inventory_account?: string;
  manufacturer?: string;
  conversion_factor?: number;
  weight_per_unit?: number;
  weight_uom?: string;
  material_request_type?: string;
  name?: string;
  parenttype?: string;
  child_doctype?: string;
  child_docname?: string;
  against_blanket_order?: boolean | number;
  blanket_order?: string;
  batch_no?: string;
  service_start_date?: string;
  transaction_type?: "selling" | "buying";
  pos_profile?: string;
  quotation_to?: string;
  is_internal_supplier?: boolean;
  is_internal_customer?: boolean;
  ignore_party?: boolean;
  ignore_conversion_rate?: boolean;
  rate?: number;
  price_list_rate?: number;
  barcode?: string;
  serial_no?: string;
  has_serial_no?: boolean;
  has_batch_no?: boolean;
  delivered_by_supplier?: boolean | number;
  is_fixed_asset?: boolean;
  enable_deferred_revenue?: boolean;
  enable_deferred_expense?: boolean;
  no_of_months?: number;
  no_of_months_exp?: number;
  deferred_revenue_account?: string;
  deferred_expense_account?: string;
  schedule_date?: string;
  lead_time_days?: number;
  bom?: string;
  valuation_rate?: number;
}

export interface ItemDetails {
  item_code: string;
  item_name?: string;
  description?: string;
  image?: string;
  warehouse?: string;
  income_account?: string;
  expense_account?: string;
  discount_account?: string;
  provisional_expense_account?: string;
  cost_center?: string;
  has_serial_no?: boolean;
  has_batch_no?: boolean;
  batch_no?: string;
  uom?: string;
  stock_uom?: string;
  min_order_qty?: number | string;
  qty: number;
  stock_qty: number;
  price_list_rate: number;
  base_price_list_rate: number;
  rate: number;
  base_rate: number;
  amount: number;
  base_amount: number;
  net_rate: number;
  net_amount: number;
  discount_percentage: number;
  discount_amount: number;
  update_stock?: number;
  delivered_by_supplier?: boolean | number;
  is_fixed_asset?: boolean;
  last_purchase_rate?: number;
  transaction_date?: string;
  against_blanket_order?: boolean | number;
  bom_no?: string;
  weight_per_unit?: number;
  weight_uom?: string;
  grant_commission?: boolean;
  conversion_factor: number;
  item_tax_template?: string;
  item_tax_rate?: string;
  customer_item_code?: string;
  supplier_part_no?: string;
  manufacturer?: string;
  manufacturer_part_no?: string;
  barcode?: string;
  total_weight?: number;
  valuation_rate?: number;
  gross_profit?: number;
  tax_withholding_category?: string;
  schedule_date?: string;
  lead_time_date?: string;
  bom?: string;
  supplier?: string;
}

export interface GetItemDetailsOptions {
  overwriteWarehouse?: boolean;
  doc?: Partial<ItemDetailsCtx>;
  itemDefaults: ItemDefaultsBundle;
  taxTemplates?: Record<string, ItemTaxTemplateInfo>;
  itemTaxRateMap?: Record<string, number | string>;
  priceListRate?: number;
  binDetails?: Partial<ItemDetails>;
  valuationRate?: number;
  blanketOrderRate?: number;
  blanketOrderName?: string;
}

export interface ItemTaxTemplateInfo {
  disabled?: boolean;
  company?: string;
  taxes: Array<{
    tax_type: string;
    tax_rate: number;
    not_applicable?: boolean;
  }>;
}

export interface BarcodeSerialMaps {
  barcodeMap?: Record<string, string>;
  serialMap?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Master function                                                    */
/* ------------------------------------------------------------------ */

/**
 * Master function that composes item details for a transaction line.
 * Mirrors `get_item_details` from the Python source.
 */
export function getItemDetails(
  ctx: ItemDetailsCtx,
  item: ItemDoc,
  options: GetItemDetailsOptions,
): ItemDetails {
  const processedCtx = preprocessCtx(ctx);
  const {
    itemDefaults,
    overwriteWarehouse = true,
    taxTemplates,
    itemTaxRateMap,
    priceListRate,
    binDetails,
    valuationRate,
    blanketOrderRate,
    doc,
  } = options;

  let out = getBasicDetails(processedCtx, item, itemDefaults, overwriteWarehouse);

  // Tax template
  const taxTemplate = getItemTaxTemplate(
    processedCtx,
    item.taxes ?? [],
    itemGroupTaxesFromDefaults(itemDefaults.itemGroupDefaults),
    taxTemplates,
    out,
  );

  // Tax rate map
  if (itemTaxRateMap) {
    out.item_tax_rate = JSON.stringify(itemTaxRateMap);
  }

  // Price list rate
  if (priceListRate !== undefined) {
    out.price_list_rate = priceListRate;
    const convRate = processedCtx.conversion_rate ?? 1;
    const plcConvRate = processedCtx.plc_conversion_rate ?? 1;
    out.base_price_list_rate = (priceListRate * plcConvRate) / convRate;
  }

  // Valuation rate
  if (valuationRate !== undefined) {
    out.valuation_rate = valuationRate;
  }

  // Bin details
  if (binDetails) {
    out = { ...out, ...binDetails };
  }

  // Blanket order
  if (processedCtx.against_blanket_order && blanketOrderRate !== undefined) {
    out.rate = blanketOrderRate;
    out.amount = out.qty * blanketOrderRate;
  }

  // Subcontracting BOM
  if (processedCtx.is_subcontracted) {
    out.bom = doc?.bom ?? item.default_bom;
  }

  // Material Request rate fallback
  if (processedCtx.doctype === "Material Request") {
    out.rate = processedCtx.rate ?? out.price_list_rate;
    out.amount = out.qty * out.rate;
  }

  // Schedule date from lead time
  if (processedCtx.transaction_date && (doc?.lead_time_days ?? item.lead_time_days)) {
    const days = Number(doc?.lead_time_days ?? item.lead_time_days);
    const date = new Date(processedCtx.transaction_date);
    date.setDate(date.getDate() + days);
    const iso = date.toISOString().split("T")[0];
    out.schedule_date = iso;
    out.lead_time_date = iso;
  }

  // Gross profit
  if (out.valuation_rate !== undefined && out.base_rate !== undefined) {
    out.gross_profit = (out.base_rate - out.valuation_rate) * out.stock_qty;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Ctx preprocessing                                                  */
/* ------------------------------------------------------------------ */

export function preprocessCtx(ctx: ItemDetailsCtx): ItemDetailsCtx {
  const out = { ...ctx };
  if (!out.price_list) {
    out.price_list = out.selling_price_list || out.buying_price_list;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Basic details                                                      */
/* ------------------------------------------------------------------ */

/**
 * Builds the base `ItemDetails` dict with defaults for UOM, warehouse,
 * accounts, cost center, supplier, and quantities.
 * Mirrors `get_basic_details` from the Python source.
 */
export function getBasicDetails(
  ctx: ItemDetailsCtx,
  item: ItemDoc,
  defaults: ItemDefaultsBundle,
  overwriteWarehouse = true,
): ItemDetails {
  const { itemDefaults, itemGroupDefaults, brandDefaults } = defaults;

  // Determine UOM
  let uom = ctx.uom;
  if (!uom) {
    if (SALES_DOCTYPES.includes(ctx.doctype)) {
      uom = item.sales_uom || item.stock_uom;
    } else if (
      PURCHASE_DOCTYPES.includes(ctx.doctype) ||
      (ctx.doctype === "Material Request" && ctx.material_request_type === "Purchase") ||
      ctx.doctype === "Supplier Quotation"
    ) {
      uom = item.purchase_uom || item.stock_uom;
    } else {
      uom = item.stock_uom;
    }
  }

  const stockUom = item.stock_uom;
  const qty = ctx.qty ?? 1;

  // Conversion factor
  let conversionFactor: number;
  if (stockUom === uom) {
    conversionFactor = 1.0;
  } else {
    conversionFactor = ctx.conversion_factor ?? 1.0;
  }

  const stockQty = qty * conversionFactor;

  const warehouse = getItemWarehouse(ctx, item, overwriteWarehouse, defaults);

  const out: ItemDetails = {
    item_code: item.item_code,
    item_name: item.item_name,
    description: (item.description ?? "").trim(),
    image: (item.image ?? "").trim(),
    warehouse,
    income_account: getDefaultIncomeAccount(ctx, itemDefaults, itemGroupDefaults, brandDefaults),
    expense_account: getDefaultExpenseAccount(ctx, itemDefaults, itemGroupDefaults, brandDefaults),
    discount_account: getDefaultDiscountAccount(ctx, itemDefaults, itemGroupDefaults, brandDefaults),
    provisional_expense_account: getDefaultProvisionalAccount(ctx, itemDefaults, itemGroupDefaults, brandDefaults),
    cost_center: getDefaultCostCenter(ctx, itemDefaults, itemGroupDefaults, brandDefaults, ctx.company),
    has_serial_no: item.has_serial_no,
    has_batch_no: item.has_batch_no,
    batch_no: ctx.batch_no,
    uom,
    stock_uom: stockUom,
    min_order_qty: ctx.doctype === "Material Request" ? (item.min_order_qty ?? 0) : "",
    qty,
    stock_qty: stockQty,
    price_list_rate: 0.0,
    base_price_list_rate: 0.0,
    rate: 0.0,
    base_rate: 0.0,
    amount: 0.0,
    base_amount: 0.0,
    net_rate: 0.0,
    net_amount: 0.0,
    discount_percentage: 0.0,
    discount_amount: ctx.discount_amount ?? 0.0,
    update_stock:
      ctx.doctype === "Sales Invoice" || ctx.doctype === "Purchase Invoice"
        ? (ctx.update_stock ? 1 : 0)
        : 0,
    delivered_by_supplier:
      ctx.doctype === "Sales Order" || ctx.doctype === "Sales Invoice"
        ? (item.delivered_by_supplier ? 1 : 0)
        : 0,
    is_fixed_asset: item.is_fixed_asset,
    last_purchase_rate: ctx.doctype === "Purchase Order" ? (item.last_purchase_rate ?? 0) : 0,
    transaction_date: ctx.transaction_date,
    against_blanket_order: ctx.against_blanket_order,
    bom_no: item.default_bom,
    weight_per_unit: ctx.weight_per_unit ?? item.weight_per_unit,
    weight_uom: ctx.weight_uom ?? item.weight_uom,
    grant_commission: item.grant_commission,
    conversion_factor: conversionFactor,
  };

  // Supplier fallback
  const defaultSupplier = getDefaultSupplier(itemDefaults, itemGroupDefaults, brandDefaults);
  if (defaultSupplier) {
    out.supplier = defaultSupplier;
  }

  // Weight total
  if (out.weight_per_unit) {
    out.total_weight = out.weight_per_unit * out.stock_qty;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Item code resolution                                               */
/* ------------------------------------------------------------------ */

/**
 * Resolves an `item_code` from a barcode or serial number.
 * Pure: lookups are provided via `maps`.
 * Mirrors `get_item_code` from the Python source.
 */
export function getItemCode(
  barcode?: string,
  serialNo?: string,
  maps?: BarcodeSerialMaps,
): string | undefined {
  if (barcode && maps?.barcodeMap) {
    const itemCode = maps.barcodeMap[barcode];
    if (!itemCode) {
      throw new Error(`No Item with Barcode ${barcode}`);
    }
    return itemCode;
  }
  if (serialNo && maps?.serialMap) {
    const itemCode = maps.serialMap[serialNo];
    if (!itemCode) {
      throw new Error(`No Item with Serial No ${serialNo}`);
    }
    return itemCode;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Tax template logic                                                 */
/* ------------------------------------------------------------------ */

/**
 * Computes tax-template info for a single item.
 * Mirrors `get_item_tax_info` from the Python source (simplified).
 */
export function getItemTaxInfo(
  ctx: ItemDetailsCtx,
  item: ItemDoc,
  taxTemplates: Record<string, ItemTaxTemplateInfo>,
): Record<string, { item_tax_template?: string; item_tax_rate: string }> {
  const out: Record<string, { item_tax_template?: string; item_tax_rate: string }> = {};

  const templateName = getItemTaxTemplate(
    ctx,
    item.taxes ?? [],
    undefined,
    taxTemplates,
  );

  if (!templateName) {
    return out;
  }

  const template = taxTemplates[templateName];
  if (!template) {
    return out;
  }

  const rateMap: Record<string, number | string> = {};
  for (const t of template.taxes) {
    if (t.not_applicable) {
      rateMap[t.tax_type] = NOT_APPLICABLE_TAX;
    } else {
      rateMap[t.tax_type] = t.tax_rate;
    }
  }

  out[item.item_code] = {
    item_tax_template: templateName,
    item_tax_rate: JSON.stringify(rateMap),
  };

  return out;
}

function itemGroupTaxesFromDefaults(
  itemGroupDefaults?: ItemGroupDefault,
): ItemGroupTax[] | undefined {
  return itemGroupDefaults?.taxes;
}

/**
 * Finds the applicable tax template for an item, checking item-level taxes
 * then item-group taxes.
 * Mirrors `get_item_tax_template` from the Python source.
 */
export function getItemTaxTemplate(
  ctx: ItemDetailsCtx,
  itemTaxes: ItemTax[],
  itemGroupTaxes?: ItemGroupTax[],
  taxTemplates?: Record<string, ItemTaxTemplateInfo>,
  out?: ItemDetails,
): string | undefined {
  let template: string | undefined;

  // Check item-level taxes
  if (itemTaxes.length > 0) {
    template = _getItemTaxTemplate(ctx, itemTaxes, taxTemplates, out);
  }

  // Check item group taxes
  if (!template && itemGroupTaxes && itemGroupTaxes.length > 0) {
    template = _getItemTaxTemplate(ctx, itemGroupTaxes, taxTemplates, out);
  }

  return template;
}

function _getItemTaxTemplate(
  ctx: ItemDetailsCtx,
  taxes: Array<{ item_tax_template?: string; tax_category?: string; minimum_net_rate?: number; maximum_net_rate?: number; valid_from?: string }>,
  taxTemplates?: Record<string, ItemTaxTemplateInfo>,
  out?: ItemDetails,
): string | undefined {
  const company = ctx.company;
  const taxCategory = ctx.tax_category;

  const taxesWithValidity: typeof taxes = [];
  const taxesWithNoValidity: typeof taxes = [];

  for (const tax of taxes) {
    if (!tax.item_tax_template) continue;

    const templateInfo = taxTemplates?.[tax.item_tax_template];
    if (templateInfo) {
      if (templateInfo.disabled || templateInfo.company !== company) {
        continue;
      }
    }

    if (tax.valid_from || tax.maximum_net_rate) {
      const validationDate = ctx.bill_date || ctx.posting_date || ctx.transaction_date;
      if (validationDate && tax.valid_from) {
        const validFrom = new Date(tax.valid_from);
        const valDate = new Date(validationDate);
        if (validFrom <= valDate && isWithinValidRange(ctx, tax)) {
          taxesWithValidity.push(tax);
        }
      } else if (!tax.valid_from && isWithinValidRange(ctx, tax)) {
        taxesWithValidity.push(tax);
      }
    } else {
      taxesWithNoValidity.push(tax);
    }
  }

  const candidateTaxes = taxesWithValidity.length > 0 ? taxesWithValidity : taxesWithNoValidity;

  // If current template is already in the valid set, keep it
  if (ctx.item_tax_template) {
    const currentInSet = candidateTaxes.some((t) => t.item_tax_template === ctx.item_tax_template);
    if (currentInSet) {
      if (out) out.item_tax_template = ctx.item_tax_template;
      return ctx.item_tax_template;
    }
  }

  // Find matching tax category
  for (const tax of candidateTaxes) {
    if (String(tax.tax_category ?? "") === String(taxCategory ?? "")) {
      if (out) out.item_tax_template = tax.item_tax_template;
      return tax.item_tax_template;
    }
  }

  return undefined;
}

function isWithinValidRange(
  ctx: ItemDetailsCtx,
  tax: { minimum_net_rate?: number; maximum_net_rate?: number },
): boolean {
  const maxRate = tax.maximum_net_rate ?? 0;
  if (!maxRate) return true;

  const netRate = ctx.base_net_rate ?? 0;
  const minRate = tax.minimum_net_rate ?? 0;
  return minRate <= netRate && netRate <= maxRate;
}

/* ------------------------------------------------------------------ */
/*  Default accounts & cost center                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns the default income (revenue) account for an item.
 * Mirrors `get_default_income_account` from the Python source.
 */
export function getDefaultIncomeAccount(
  ctx: ItemDetailsCtx,
  itemDefaults: ItemDefault,
  itemGroupDefaults: ItemGroupDefault,
  brandDefaults?: BrandDefault,
): string | undefined {
  return (
    itemDefaults.income_account ||
    itemGroupDefaults.income_account ||
    brandDefaults?.income_account ||
    ctx.income_account
  );
}

/**
 * Returns the default expense (COGS) account for an item.
 * Mirrors `get_default_expense_account` from the Python source.
 */
export function getDefaultExpenseAccount(
  ctx: ItemDetailsCtx,
  itemDefaults: ItemDefault,
  itemGroupDefaults: ItemGroupDefault,
  brandDefaults?: BrandDefault,
): string | undefined {
  // Special handling for Sales Invoice / Delivery Note → COGS account
  if (ctx.doctype === "Sales Invoice" || ctx.doctype === "Delivery Note") {
    const cogsAccount =
      itemDefaults.default_cogs_account ||
      itemGroupDefaults.default_cogs_account ||
      brandDefaults?.default_cogs_account;
    if (cogsAccount) return cogsAccount;
  }

  return (
    itemDefaults.expense_account ||
    itemGroupDefaults.expense_account ||
    brandDefaults?.expense_account ||
    ctx.expense_account
  );
}

/**
 * Returns the default cost center for an item.
 * Mirrors `get_default_cost_center` from the Python source.
 */
export function getDefaultCostCenter(
  ctx: ItemDetailsCtx,
  itemDefaults?: ItemDefault,
  itemGroupDefaults?: ItemGroupDefault,
  brandDefaults?: BrandDefault,
  company?: string,
): string | undefined {
  let costCenter: string | undefined;

  // Item / Group / Brand cost center
  if (itemDefaults && itemGroupDefaults && brandDefaults) {
    if (ctx.customer) {
      costCenter =
        itemDefaults.selling_cost_center ||
        itemGroupDefaults.selling_cost_center ||
        brandDefaults.selling_cost_center;
    } else if (ctx.supplier) {
      costCenter =
        itemDefaults.buying_cost_center ||
        itemGroupDefaults.buying_cost_center ||
        brandDefaults.buying_cost_center;
    } else {
      costCenter =
        itemDefaults.selling_cost_center ||
        itemGroupDefaults.selling_cost_center ||
        brandDefaults.selling_cost_center ||
        itemDefaults.buying_cost_center ||
        itemGroupDefaults.buying_cost_center ||
        brandDefaults.buying_cost_center;
    }
  }

  // Direct ctx fallback
  if (!costCenter && ctx.cost_center) {
    costCenter = ctx.cost_center;
  }

  // Company fallback (in pure mode, caller must supply company cost_center via ctx)
  if (!costCenter && company && ctx.cost_center) {
    costCenter = ctx.cost_center;
  }

  return costCenter;
}

/**
 * Returns the default supplier for an item.
 * Mirrors `get_default_supplier` from the Python source.
 */
export function getDefaultSupplier(
  itemDefaults: ItemDefault,
  itemGroupDefaults: ItemGroupDefault,
  brandDefaults?: BrandDefault,
): string | undefined {
  return (
    itemDefaults.default_supplier ||
    itemGroupDefaults.default_supplier ||
    brandDefaults?.default_supplier
  );
}

/* ------------------------------------------------------------------ */
/*  Warehouse resolution                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns the default warehouse for an item line.
 * Mirrors `get_item_warehouse_` from the Python source.
 */
export function getItemWarehouse(
  ctx: ItemDetailsCtx,
  _item: ItemDoc,
  overwriteWarehouse: boolean,
  defaults: ItemDefaultsBundle,
): string | undefined {
  const { itemDefaults, itemGroupDefaults, brandDefaults } = defaults;

  let warehouse: string | undefined;
  if (overwriteWarehouse || !ctx.warehouse) {
    warehouse =
      ctx.set_warehouse ||
      itemDefaults.default_warehouse ||
      itemGroupDefaults.default_warehouse ||
      brandDefaults.default_warehouse ||
      ctx.warehouse;
  } else {
    warehouse = ctx.warehouse;
  }

  return warehouse;
}

/* ------------------------------------------------------------------ */
/*  Helpers (exported for parity)                                      */
/* ------------------------------------------------------------------ */

export function getDefaultDiscountAccount(
  ctx: ItemDetailsCtx,
  itemDefaults: ItemDefault,
  itemGroupDefaults: ItemGroupDefault,
  brandDefaults?: BrandDefault,
): string | undefined {
  return (
    itemDefaults.default_discount_account ||
    itemGroupDefaults.default_discount_account ||
    brandDefaults?.default_discount_account ||
    ctx.discount_account
  );
}

export function getDefaultProvisionalAccount(
  ctx: ItemDetailsCtx,
  itemDefaults: ItemDefault,
  itemGroupDefaults: ItemGroupDefault,
  brandDefaults?: BrandDefault,
): string | undefined {
  return (
    itemDefaults.default_provisional_account ||
    itemGroupDefaults.default_provisional_account ||
    brandDefaults?.default_provisional_account ||
    ctx.default_provisional_account
  );
}
