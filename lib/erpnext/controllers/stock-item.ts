/**
 * Ported from erpnext/stock/doctype/item/item.py
 * Pure business logic for Item validations, UOM handling, and variant checks.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ItemUomConversion {
  uom: string;
  conversion_factor: number;
  idx?: number;
}

export interface ItemBarcode {
  barcode?: string;
  barcode_type?: string;
  idx?: number;
}

export interface ItemTax {
  item_tax_template?: string;
  tax_category?: string;
  minimum_net_rate?: number;
  maximum_net_rate?: number;
  idx?: number;
}

export interface ItemReorder {
  warehouse?: string;
  warehouse_group?: string;
  warehouse_reorder_level?: number;
  warehouse_reorder_qty?: number;
  material_request_type?: string;
  idx?: number;
}

export interface ItemDefault {
  company: string;
  default_warehouse?: string;
  default_price_list?: string;
  buying_cost_center?: string;
  selling_cost_center?: string;
  expense_account?: string;
  income_account?: string;
  default_supplier?: string;
  default_cogs_account?: string;
  default_inventory_account?: string;
  default_provisional_account?: string;
  default_discount_account?: string;
  idx?: number;
}

export interface ItemCustomerDetail {
  ref_code?: string;
  customer_name?: string;
  idx?: number;
}

export interface ItemSupplier {
  supplier?: string;
  idx?: number;
}

export interface ItemVariantAttribute {
  attribute?: string;
  attribute_value?: string;
  variant_of?: string;
  idx?: number;
}

export interface ItemDoc {
  name?: string;
  item_code: string;
  item_name?: string;
  item_group?: string;
  description?: string;
  stock_uom: string;
  has_serial_no?: boolean;
  has_batch_no?: boolean;
  is_stock_item?: boolean;
  is_fixed_asset?: boolean;
  is_customer_provided_item?: boolean;
  valuation_method?: "" | "FIFO" | "Moving Average" | "LIFO";
  standard_rate?: number;
  valuation_rate?: number;
  opening_stock?: number;
  allow_zero_valuation_rate?: boolean;
  disabled?: boolean;
  end_of_life?: string;
  has_variants?: boolean;
  variant_of?: string;
  variant_based_on?: "Item Attribute" | "Manufacturer";
  default_material_request_type?: string;
  barcodes?: ItemBarcode[];
  taxes?: ItemTax[];
  uoms?: ItemUomConversion[];
  reorder_levels?: ItemReorder[];
  item_defaults?: ItemDefault[];
  customer_items?: ItemCustomerDetail[];
  supplier_items?: ItemSupplier[];
  attributes?: ItemVariantAttribute[];
  retain_sample?: boolean;
  sample_quantity?: number;
  brand?: string;
  batch_number_series?: string;
  serial_no_series?: string;
  create_new_batch?: boolean;
  is_purchase_item?: boolean;
  default_bom?: string;
  customer_code?: string;
  sales_uom?: string;
  purchase_uom?: string;
  min_order_qty?: number;
  delivered_by_supplier?: boolean;
  weight_per_unit?: number;
  weight_uom?: string;
  grant_commission?: boolean;
  last_purchase_rate?: number;
  enable_deferred_revenue?: boolean;
  enable_deferred_expense?: boolean;
  no_of_months?: number;
  no_of_months_exp?: number;
  deferred_revenue_account?: string;
  deferred_expense_account?: string;
  asset_category?: string;
  lead_time_days?: number;
  image?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface UomConversionDetail {
  from_uom: string;
  to_uom: string;
  value: number;
}

export interface BinQtyArgs {
  actual_qty?: number;
  ordered_qty?: number;
  reserved_qty?: number;
  indented_qty?: number;
  planned_qty?: number;
  reserved_qty_for_production?: number;
  reserved_qty_for_sub_contract?: number;
  reserved_qty_for_production_plan?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cstr(value: string | number | boolean | undefined | null): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

/* ------------------------------------------------------------------ */
/*  Item Validations                                                   */
/* ------------------------------------------------------------------ */

export function validateItem(doc: ItemDoc): ValidationResult {
  const warnings: string[] = [];

  if (!doc.item_name) {
    doc.item_name = doc.item_code;
  }

  const uomResult = validateUom(doc);
  if (!uomResult.success) return uomResult;

  const typeResult = validateItemType(doc);
  if (!typeResult.success) return typeResult;

  const convResult = validateConversionFactor(doc.uoms ?? [], doc.stock_uom);
  if (!convResult.success) return convResult;

  const fixedAssetResult = validateFixedAsset(doc);
  if (!fixedAssetResult.success) return fixedAssetResult;

  const custResult = validateCustomerProvidedItem(doc);
  if (!custResult.success) return custResult;

  const taxResult = validateItemTaxNetRateRange(doc.taxes ?? []);
  if (!taxResult.success) return taxResult;

  const dupTaxResult = checkItemTaxDuplicates(doc.taxes ?? []);
  if (!dupTaxResult.success) return dupTaxResult;

  const defaultResult = validateItemDefaults(doc.item_defaults ?? []);
  if (!defaultResult.success) return defaultResult;

  const reorderResult = validateReorderLevels(doc.reorder_levels ?? []);
  if (!reorderResult.success) return reorderResult;

  if (doc.barcodes && doc.barcodes.length > 0) {
    const barcodeResult = validateBarcode(doc.barcodes);
    if (!barcodeResult.success) return barcodeResult;
  }

  if (doc.has_variants && doc.attributes) {
    const attrResult = validateAttributes(doc.attributes, doc.variant_based_on ?? "Item Attribute");
    if (!attrResult.success) return attrResult;
  }

  // Auto-set customer code
  if (doc.customer_items && doc.customer_items.length > 0) {
    const customerCodes = new Set(doc.customer_items.map((d) => d.ref_code).filter(Boolean));
    doc.customer_code = Array.from(customerCodes).join(",");
  }

  // Clear retain sample if no batch
  if (!doc.has_batch_no) {
    doc.retain_sample = false;
  }
  if (!doc.retain_sample) {
    doc.sample_quantity = 0;
  }

  return { success: true, warnings };
}

export function validateUom(doc: ItemDoc): ValidationResult {
  if (!doc.stock_uom) {
    return { success: false, error: "Stock UOM is mandatory" };
  }

  if (doc.has_variants && doc.variant_of) {
    // Template UOM must match variant UOM (unless explicitly allowed)
    // Caller must fetch template_uom and pass it; this is a placeholder
    // for the check that would happen in the server action.
  }

  return { success: true };
}

export function validateConversionFactor(
  uoms: ItemUomConversion[],
  stockUom: string
): ValidationResult {
  const checkList: string[] = [];

  for (const d of uoms) {
    const uomName = cstr(d.uom);
    if (checkList.includes(uomName)) {
      return {
        success: false,
        error: `Unit of Measure ${uomName} has been entered more than once in Conversion Factor Table`,
      };
    }
    checkList.push(uomName);

    if (uomName && uomName === cstr(stockUom) && flt(d.conversion_factor) !== 1) {
      return {
        success: false,
        error: `Conversion factor for default Unit of Measure must be 1 in row ${d.idx ?? 0}`,
      };
    }
  }

  // Ensure stock_uom exists in uoms table
  if (stockUom && !uoms.some((u) => cstr(u.uom) === cstr(stockUom))) {
    uoms.push({ uom: stockUom, conversion_factor: 1 });
  }

  return { success: true };
}

export function validateItemType(doc: ItemDoc): ValidationResult {
  if (doc.has_serial_no && !doc.is_stock_item && !doc.is_fixed_asset) {
    return { success: false, error: "'Has Serial No' can not be 'Yes' for non-stock item" };
  }

  if (!doc.has_serial_no && doc.serial_no_series) {
    doc.serial_no_series = undefined;
  }

  if (!doc.has_batch_no && doc.batch_number_series) {
    // In ERPNext this is allowed to persist, but batch number series
    // only makes sense when has_batch_no is true.
  }

  return { success: true };
}

export function validateBarcode(barcodes: ItemBarcode[]): ValidationResult {
  const seen = new Set<string>();
  for (const row of barcodes) {
    if (!row.barcode) continue;
    if (seen.has(row.barcode)) {
      return { success: false, error: `Barcode ${row.barcode} is duplicated within this item` };
    }
    seen.add(row.barcode);

    const validTypes = [
      "EAN",
      "UPC-A",
      "CODE-39",
      "ISBN-10",
      "ISBN-13",
      "EAN8",
      "EAN13",
      "UPCA",
    ];
    if (row.barcode_type && !validTypes.includes(row.barcode_type)) {
      // Allow custom barcode types; strict validation would need an external library.
    }
  }
  return { success: true };
}

export function validateItemTaxNetRateRange(taxes: ItemTax[]): ValidationResult {
  for (const tax of taxes) {
    if (flt(tax.maximum_net_rate) < flt(tax.minimum_net_rate)) {
      return {
        success: false,
        error: `Taxes row #${tax.idx ?? 0}: Maximum Net Rate cannot be smaller than Minimum Net Rate`,
      };
    }
  }
  return { success: true };
}

export function checkItemTaxDuplicates(taxes: ItemTax[]): ValidationResult {
  const checkList: Array<[string, string | undefined]> = [];
  for (const d of taxes) {
    if (!d.item_tax_template) continue;
    const key: [string, string | undefined] = [d.item_tax_template, d.tax_category];
    const exists = checkList.some(
      (k) => k[0] === key[0] && k[1] === key[1]
    );
    if (exists) {
      return {
        success: false,
        error: `${d.item_tax_template} entered twice ${d.tax_category ? `for tax category ${d.tax_category}` : ""} in Item Taxes`,
      };
    }
    checkList.push(key);
  }
  return { success: true };
}

export function validateFixedAsset(doc: ItemDoc): ValidationResult {
  if (doc.is_fixed_asset) {
    if (doc.is_stock_item) {
      return { success: false, error: "Fixed Asset Item must be a non-stock item." };
    }
  }
  return { success: true };
}

export function validateCustomerProvidedItem(doc: ItemDoc): ValidationResult {
  if (doc.is_customer_provided_item) {
    if (doc.is_purchase_item) {
      return {
        success: false,
        error: '"Customer Provided Item" cannot be Purchase Item also',
      };
    }
    if (flt(doc.valuation_rate) > 0) {
      return {
        success: false,
        error: '"Customer Provided Item" cannot have Valuation Rate',
      };
    }
    doc.default_material_request_type = "Customer Provided";
  }
  return { success: true };
}

export function validateRetainSample(
  doc: ItemDoc,
  sampleRetentionWarehouse?: string
): ValidationResult {
  if (doc.retain_sample) {
    if (!sampleRetentionWarehouse) {
      return {
        success: false,
        error: "Please select Sample Retention Warehouse in Stock Settings first",
      };
    }
    if (!doc.has_batch_no) {
      return {
        success: false,
        error: `${doc.item_code} Retain Sample is based on batch, please check Has Batch No to retain sample of item`,
      };
    }
  }
  return { success: true };
}

export function validateItemDefaults(defaults: ItemDefault[]): ValidationResult {
  const companies = new Set<string>();
  for (const row of defaults) {
    if (companies.has(row.company)) {
      return { success: false, error: "Cannot set multiple Item Defaults for a company." };
    }
    companies.add(row.company);
  }
  return { success: true };
}

export function validateReorderLevels(levels: ItemReorder[]): ValidationResult {
  const warehouseMaterialRequestType: Array<[string | undefined, string | undefined]> = [];

  for (const d of levels) {
    const warehouse = d.warehouse;
    const materialRequestType = d.material_request_type;

    if (!d.warehouse_group) {
      d.warehouse_group = warehouse;
    }

    const exists = warehouseMaterialRequestType.some(
      (pair) => pair[0] === warehouse && pair[1] === materialRequestType
    );
    if (exists) {
      return {
        success: false,
        error: `Row #${d.idx ?? 0}: A reorder entry already exists for warehouse ${warehouse} with reorder type ${materialRequestType}.`,
      };
    }
    warehouseMaterialRequestType.push([warehouse, materialRequestType]);

    if (flt(d.warehouse_reorder_level) > 0 && !flt(d.warehouse_reorder_qty)) {
      return {
        success: false,
        error: `Row #${d.idx ?? 0}: Please set reorder quantity`,
      };
    }
  }

  return { success: true };
}

export function validateAttributes(
  attributes: ItemVariantAttribute[],
  variantBasedOn: string
): ValidationResult {
  if (variantBasedOn !== "Item Attribute") {
    return { success: true };
  }

  if (!attributes || attributes.length === 0) {
    return { success: false, error: "Attribute table is mandatory" };
  }

  const seen: string[] = [];
  for (const d of attributes) {
    if (!d.attribute) continue;
    if (seen.includes(d.attribute)) {
      return {
        success: false,
        error: `Attribute ${d.attribute} selected multiple times in Attributes Table`,
      };
    }
    seen.push(d.attribute);
  }

  return { success: true };
}

export function validateNamingSeries(series: string): ValidationResult {
  if (series && series.includes("#") && !series.includes(".")) {
    return {
      success: false,
      error: `Invalid naming series (. missing) for ${series}`,
    };
  }
  return { success: true };
}

export function getProjectedQty(args: BinQtyArgs): number {
  return (
    flt(args.actual_qty) +
    flt(args.ordered_qty) +
    flt(args.indented_qty) +
    flt(args.planned_qty) -
    flt(args.reserved_qty) -
    flt(args.reserved_qty_for_production) -
    flt(args.reserved_qty_for_sub_contract) -
    flt(args.reserved_qty_for_production_plan)
  );
}

export function validateCantChange(
  doc: ItemDoc,
  oldDoc: ItemDoc,
  hasTransactions: boolean
): ValidationResult {
  const restrictedFields: Array<keyof ItemDoc> = [
    "has_serial_no",
    "is_stock_item",
    "valuation_method",
    "has_batch_no",
  ];

  const changedFields: string[] = [];
  for (const field of restrictedFields) {
    const docVal = doc[field] as string | number | boolean | undefined | null;
    const oldVal = oldDoc[field] as string | number | boolean | undefined | null;
    if (cstr(docVal) !== cstr(oldVal)) {
      changedFields.push(field);
    }
  }

  // Allow changing valuation method from FIFO to Moving Average, not vice versa
  if (doc.valuation_method === "Moving Average" && changedFields.includes("valuation_method")) {
    changedFields.splice(changedFields.indexOf("valuation_method"), 1);
  }

  if (changedFields.length === 0) {
    return { success: true };
  }

  if (hasTransactions) {
    return {
      success: false,
      error: `As there are existing submitted transactions against item ${doc.item_code}, you can not change the value of ${changedFields.join(", ")}.`,
    };
  }

  return { success: true };
}

export function getUomConvFactor(
  uoms: UomConversionDetail[],
  fromUom: string,
  toUom: string
): number | undefined {
  if (fromUom === toUom) return 1.0;

  // Exact match
  const exact = uoms.find((u) => u.from_uom === fromUom && u.to_uom === toUom);
  if (exact) return exact.value;

  // Inverse match
  const inverse = uoms.find((u) => u.from_uom === toUom && u.to_uom === fromUom);
  if (inverse) return 1 / inverse.value;

  // Intermediate match: fromUom -> X -> toUom
  // i.e. find first where to_uom = toUom, second where to_uom = fromUom, both with same from_uom
  for (const first of uoms) {
    if (first.to_uom === toUom) {
      const second = uoms.find(
        (u) => u.from_uom === first.from_uom && u.to_uom === fromUom
      );
      if (second && second.value !== 0) {
        return first.value / second.value;
      }
    }
  }

  return undefined;
}

export function generateItemCode(itemName: string, namingSeries?: string): string {
  if (namingSeries) {
    // In a real implementation the series would be expanded by the caller.
    return `${namingSeries}-${itemName}`;
  }
  return itemName;
}

export function validateEndOfLife(
  endOfLife?: string,
  disabled?: boolean
): ValidationResult {
  if (endOfLife && endOfLife !== "0000-00-00") {
    const eol = getdate(endOfLife);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eol <= today) {
      return {
        success: false,
        error: `Item has reached its end of life on ${endOfLife}`,
      };
    }
  }

  if (disabled) {
    return { success: false, error: "Item is disabled" };
  }

  return { success: true };
}

export function validateIsStockItem(isStockItem: boolean): ValidationResult {
  if (!isStockItem) {
    return { success: false, error: "Item is not a stock Item" };
  }
  return { success: true };
}

export function validateCancelledItem(docstatus: number): ValidationResult {
  if (docstatus === 2) {
    return { success: false, error: "Item is cancelled" };
  }
  return { success: true };
}

export function checkStockUomWithBin(
  currentStockUom: string,
  newStockUom: string,
  existingSleUom?: string,
  binsWithActivity?: Array<{ stock_uom?: string }>
): ValidationResult {
  if (currentStockUom === newStockUom) {
    return { success: true };
  }

  if (existingSleUom && cstr(existingSleUom) !== cstr(newStockUom)) {
    return {
      success: false,
      error: `Default Unit of Measure cannot be changed directly because you have already made some transaction(s) with another UOM. You will need to create a new Item to use a different Default UOM.`,
    };
  }

  if (binsWithActivity && binsWithActivity.length > 0) {
    return {
      success: false,
      error: `Default Unit of Measure cannot be changed directly because you have already made some transaction(s) with another UOM. You need to either cancel the linked documents or create a new Item.`,
    };
  }

  return { success: true };
}

export function addDefaultUomInConversionFactorTable(
  uoms: ItemUomConversion[],
  stockUom: string,
  isNew: boolean,
  hasUomChanged: boolean
): { uoms: ItemUomConversion[]; warnings: string[] } {
  const warnings: string[] = [];

  if (!isNew && hasUomChanged) {
    uoms = [];
    warnings.push(
      "Successfully changed Stock UOM, please redefine conversion factors for new UOM."
    );
  }

  const uomsList = uoms.map((d) => cstr(d.uom));
  if (stockUom && !uomsList.includes(stockUom)) {
    uoms.push({ uom: stockUom, conversion_factor: 1 });
  }

  return { uoms, warnings };
}

export function validateAutoReorderEnabledInStockSettings(
  reorderLevels: ItemReorder[],
  autoIndentEnabled: boolean
): ValidationResult {
  if (reorderLevels.length > 0 && !autoIndentEnabled) {
    return {
      success: false,
      error: "You have to enable auto re-order in Stock Settings to maintain re-order levels.",
    };
  }
  return { success: true };
}

export function validateDefaultBom(
  defaultBom: string | undefined,
  itemName: string,
  variantOf: string | undefined,
  bomItemName: string | undefined
): ValidationResult {
  if (defaultBom && bomItemName && ![itemName, variantOf].includes(bomItemName)) {
    return {
      success: false,
      error: `Default BOM (${bomItemName}) must be active for this item or its template`,
    };
  }
  return { success: true };
}

export function validateVariantBasedOnChange(
  doc: ItemDoc,
  oldVariantBasedOn?: string,
  hasVariants?: boolean,
  variantOf?: string
): ValidationResult {
  if (
    variantOf ||
    (hasVariants && doc.has_variants)
  ) {
    if (oldVariantBasedOn && doc.variant_based_on !== oldVariantBasedOn) {
      return {
        success: false,
        error: "Variant Based On cannot be changed",
      };
    }
  }
  return { success: true };
}

export function validateVariantAttributes(
  attributes: ItemVariantAttribute[],
  variantOf: string,
  existingVariantItemCode?: string
): ValidationResult {
  // Remove attributes with no attribute_value set
  const cleaned = attributes.filter((d) => cstr(d.attribute_value).trim() !== "");

  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < cleaned.length; i++) {
    cleaned[i].idx = i + 1;
    if (cleaned[i].attribute) {
      args[cleaned[i].attribute!] = cleaned[i].attribute_value;
    }
  }

  // Copy variant_of to each row
  for (const d of cleaned) {
    d.variant_of = variantOf;
  }

  if (existingVariantItemCode && existingVariantItemCode !== variantOf) {
    return {
      success: false,
      error: `Item variant ${existingVariantItemCode} exists with same attributes`,
    };
  }

  return { success: true };
}

export function validateStockExistsForTemplateItem(
  hasTransactions: boolean,
  oldHasVariants: boolean,
  newHasVariants: boolean,
  oldVariantOf: string | undefined,
  newVariantOf: string | undefined,
  attributesSame: boolean
): ValidationResult {
  if (!hasTransactions) return { success: true };

  if (
    Boolean(oldHasVariants) !== Boolean(newHasVariants) ||
    oldVariantOf !== newVariantOf
  ) {
    return {
      success: false,
      error: "Cannot change Variant properties after stock transaction. You will have to make a new Item to do this.",
    };
  }

  if ((newHasVariants || newVariantOf) && !attributesSame) {
    return {
      success: false,
      error: "Cannot change Attributes after stock transaction. Make a new Item and transfer stock to the new Item",
    };
  }

  return { success: true };
}

export function validateHasVariants(
  hasVariants: boolean,
  oldHasVariants: boolean,
  hasChildVariants: boolean
): ValidationResult {
  if (!hasVariants && oldHasVariants && hasChildVariants) {
    return { success: false, error: "Item has variants." };
  }
  return { success: true };
}
