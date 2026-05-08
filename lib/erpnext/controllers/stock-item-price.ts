/**
 * Ported from erpnext/stock/doctype/item_price/item_price.py
 * Pure business logic for Item Price validations and duplicate checks.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ItemPriceDoc {
  name?: string;
  item_code: string;
  item_name?: string;
  item_description?: string;
  price_list: string;
  price_list_rate: number;
  currency?: string;
  uom?: string;
  brand?: string;
  buying?: boolean;
  selling?: boolean;
  customer?: string;
  supplier?: string;
  batch_no?: string;
  valid_from?: string;
  valid_upto?: string;
  packing_unit?: number;
  lead_time_days?: number;
  reference?: string;
  note?: string;
  has_variants?: boolean;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface PriceListDetails {
  buying: boolean;
  selling: boolean;
  currency: string;
  enabled: boolean;
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

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export function validateItemPrice(
  doc: ItemPriceDoc,
  itemExists: boolean,
  priceListDetails?: PriceListDetails
): ValidationResult {
  if (!itemExists) {
    return { success: false, error: `Item ${doc.item_code} not found.` };
  }

  if (doc.has_variants) {
    return {
      success: false,
      error: `Item Price cannot be created for the template item ${doc.item_code}`,
    };
  }

  if (priceListDetails && !priceListDetails.enabled) {
    return {
      success: false,
      error: `The price list ${doc.price_list} does not exist or is disabled`,
    };
  }

  const dateResult = validateFromToDates(doc.valid_from, doc.valid_upto);
  if (!dateResult.success) return dateResult;

  return { success: true };
}

export function validateFromToDates(
  validFrom?: string,
  validUpto?: string
): ValidationResult {
  if (validFrom && validUpto) {
    const from = new Date(validFrom);
    const to = new Date(validUpto);
    if (from > to) {
      return {
        success: false,
        error: "Valid From date must be before Valid Upto date",
      };
    }
  }
  return { success: true };
}

export function validateItemTemplate(
  hasVariants: boolean,
  itemCode: string
): ValidationResult {
  if (hasVariants) {
    return {
      success: false,
      error: `Item Price cannot be created for the template item ${itemCode}`,
    };
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Duplicate Check                                                    */
/* ------------------------------------------------------------------ */

export function checkDuplicatePrice(
  existingPrices: ItemPriceDoc[],
  newPrice: ItemPriceDoc
): ValidationResult {
  const dataFields: Array<keyof ItemPriceDoc> = [
    "uom",
    "valid_from",
    "valid_upto",
    "customer",
    "supplier",
    "batch_no",
  ];
  const numberFields: Array<keyof ItemPriceDoc> = ["packing_unit"];

  for (const existing of existingPrices) {
    if (existing.name === newPrice.name) continue;
    if (existing.item_code !== newPrice.item_code) continue;
    if (existing.price_list !== newPrice.price_list) continue;

    let isDuplicate = true;

    for (const field of dataFields) {
      const existingVal = String(existing[field] ?? "");
      const newVal = String(newPrice[field] ?? "");
      if (existingVal !== newVal) {
        isDuplicate = false;
        break;
      }
    }

    if (!isDuplicate) continue;

    for (const field of numberFields) {
      const existingVal = flt(existing[field] as number | string | undefined);
      const newVal = flt(newPrice[field] as number | string | undefined);
      if (existingVal !== newVal) {
        isDuplicate = false;
        break;
      }
    }

    if (isDuplicate) {
      return {
        success: false,
        error:
          "Item Price appears multiple times based on Price List, Supplier/Customer, Currency, Item, Batch, UOM, Qty, and Dates.",
      };
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Price List & Item Details                                          */
/* ------------------------------------------------------------------ */

export function updatePriceListDetails(
  priceList: PriceListDetails
): { buying: boolean; selling: boolean; currency: string } {
  return {
    buying: priceList.buying,
    selling: priceList.selling,
    currency: priceList.currency,
  };
}

export function updateItemDetails(
  itemName?: string,
  itemDescription?: string
): { item_name?: string; item_description?: string } {
  return {
    item_name: itemName,
    item_description: itemDescription,
  };
}

export function setReference(
  doc: ItemPriceDoc
): { reference?: string; customer?: string; supplier?: string } {
  const updates: { reference?: string; customer?: string; supplier?: string } = {};

  if (doc.selling) {
    updates.reference = doc.customer;
  }
  if (doc.buying) {
    updates.reference = doc.supplier;
  }

  if (doc.selling && !doc.buying) {
    updates.supplier = undefined;
  }
  if (doc.buying && !doc.selling) {
    updates.customer = undefined;
  }

  return updates;
}

/* ------------------------------------------------------------------ */
/*  Rate Helpers                                                       */
/* ------------------------------------------------------------------ */

export function computeItemPriceRate(
  baseRate: number,
  conversionRate = 1.0
): { base_rate: number; rate: number } {
  const rate = flt(baseRate / conversionRate);
  return { base_rate: flt(baseRate), rate };
}

export function validateUomExists(
  uom: string,
  itemUoms: string[]
): ValidationResult {
  if (!itemUoms.includes(uom)) {
    return {
      success: false,
      error: `UOM ${uom} not found in Item`,
    };
  }
  return { success: true };
}
