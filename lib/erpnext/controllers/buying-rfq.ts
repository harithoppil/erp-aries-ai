/**
 * Ported from erpnext/buying/doctype/request_for_quotation/request_for_quotation.py
 * Pure business logic for Request for Quotation validation & calculations.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RFQItem {
  idx: number;
  name?: string;
  item_code?: string;
  item_name?: string;
  description?: string;
  qty: number;
  uom?: string;
  stock_uom?: string;
  stock_qty?: number;
  conversion_factor?: number;
  warehouse?: string;
  schedule_date?: string;
  material_request?: string;
  material_request_item?: string;
  sales_order?: string;
  supplier_part_no?: string;
  project?: string;
  project_name?: string;
  brand?: string;
}

export interface RFQSupplier {
  idx: number;
  supplier: string;
  supplier_name?: string;
  contact?: string;
  email_id?: string;
  send_email?: boolean;
  email_sent?: boolean;
  quote_status?: string;
}

export interface RFQDoc {
  name?: string;
  docstatus?: number;
  status?: string;
  title?: string;
  subject?: string;
  company: string;
  currency?: string;
  transaction_date: string;
  schedule_date?: string;
  items: RFQItem[];
  suppliers: RFQSupplier[];
  message_for_supplier?: string;
  mfs_html?: string;
  use_html?: boolean;
  email_template?: string;
  has_unit_price_items?: boolean;
  vendor?: string;
  opportunity?: string;
  incoterm?: string;
  named_place?: string;
  letter_head?: string;
  select_print_heading?: string;
  billing_address?: string;
  shipping_address?: string;
  terms?: string;
  tc_name?: string;
  send_attached_files?: boolean;
  send_document_print?: boolean;
}

export interface ValidationResult<T = never> {
  valid: boolean;
  error?: string;
  warnings?: string[];
  doc?: T;
}

export interface RFQValidationContext {
  allowZeroQtyInRFQ?: boolean;
  supplierPreventRFQMap?: Record<string, boolean>;
  supplierWarnRFQMap?: Record<string, boolean>;
  supplierScorecardStatusMap?: Record<string, string>;
  contactEmailMap?: Record<string, string>;
}

export interface EmailTemplateData {
  use_html?: boolean;
  response?: string;
  response_html?: string;
  subject?: string;
}

export interface SupplierQuotationItemData {
  item_code?: string;
  item_name?: string;
  description?: string;
  qty: number;
  rate?: number;
  conversion_factor?: number;
  warehouse?: string;
  material_request?: string;
  material_request_item?: string;
  stock_qty?: number;
  uom?: string;
  request_for_quotation_item?: string;
  request_for_quotation?: string;
  supplier_part_no?: string;
}

export interface SupplierQuotationDoc {
  supplier: string;
  company: string;
  currency: string;
  buying_price_list?: string;
  terms?: string;
  opportunity?: string;
  items: SupplierQuotationItemData[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

/* ------------------------------------------------------------------ */
/*  Main Validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Main RFQ validation.
 * Ported from RequestforQuotation.validate()
 */
export function validateRFQ(
  doc: RFQDoc,
  ctx: RFQValidationContext
): ValidationResult<RFQDoc> {
  let d = { ...doc };

  // set_has_unit_price_items
  d = setHasUnitPriceItemsRFQ(d, ctx.allowZeroQtyInRFQ ?? false);

  // validate_duplicate_supplier
  const dupVal = validateDuplicateSupplier(d.suppliers);
  if (!dupVal.valid) return dupVal;

  // validate_supplier_list
  const suppVal = validateSupplierList(
    d.suppliers,
    ctx.supplierPreventRFQMap ?? {},
    ctx.supplierWarnRFQMap ?? {},
    ctx.supplierScorecardStatusMap ?? {}
  );
  if (!suppVal.valid) return suppVal;
  if (suppVal.warnings) {
    return { valid: true, warnings: suppVal.warnings, doc: d };
  }

  // update_email_id
  d.suppliers = updateEmailId(d.suppliers, ctx.contactEmailMap ?? {});

  // validate qty is not zero (unless unit price item)
  const qtyVal = validateQtyIsNotZero(d.items, d.has_unit_price_items ?? false);
  if (!qtyVal.valid) return qtyVal;

  return { valid: true, doc: d };
}

/* ------------------------------------------------------------------ */
/*  Unit Price Items                                                   */
/* ------------------------------------------------------------------ */

/**
 * Set has_unit_price_items flag for RFQ.
 * Ported from RequestforQuotation.set_has_unit_price_items()
 */
export function setHasUnitPriceItemsRFQ(
  doc: RFQDoc,
  allowZeroQtyInRFQ: boolean
): RFQDoc {
  if (!allowZeroQtyInRFQ) {
    return { ...doc, has_unit_price_items: false };
  }

  const hasUnitPriceItems = doc.items.some(
    (row) => row.item_code && !row.qty
  );

  return { ...doc, has_unit_price_items: hasUnitPriceItems };
}

/* ------------------------------------------------------------------ */
/*  Duplicate Supplier                                                 */
/* ------------------------------------------------------------------ */

/**
 * Validate that no supplier is entered multiple times.
 * Ported from RequestforQuotation.validate_duplicate_supplier()
 */
export function validateDuplicateSupplier(suppliers: RFQSupplier[]): ValidationResult<never> {
  const supplierList = suppliers.map((d) => d.supplier);
  const uniqueSuppliers = new Set(supplierList);

  if (supplierList.length !== uniqueSuppliers.size) {
    return { valid: false, error: "Same supplier has been entered multiple times" };
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Supplier List Validation                                           */
/* ------------------------------------------------------------------ */

/**
 * Validate supplier scorecard standing for RFQs.
 * Ported from RequestforQuotation.validate_supplier_list()
 */
export function validateSupplierList(
  suppliers: RFQSupplier[],
  supplierPreventRFQMap: Record<string, boolean>,
  supplierWarnRFQMap: Record<string, boolean>,
  supplierScorecardStatusMap: Record<string, string>
): ValidationResult<never> {
  const warnings: string[] = [];

  for (const d of suppliers) {
    if (supplierPreventRFQMap[d.supplier]) {
      const standing = supplierScorecardStatusMap[d.supplier];
      return {
        valid: false,
        error: `RFQs are not allowed for ${d.supplier} due to a scorecard standing of ${standing}`,
      };
    }

    if (supplierWarnRFQMap[d.supplier]) {
      const standing = supplierScorecardStatusMap[d.supplier];
      warnings.push(
        `${d.supplier} currently has a ${standing} Supplier Scorecard standing, and RFQs to this supplier should be issued with caution.`
      );
    }
  }

  return { valid: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  Email ID                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fallback email_id from contact master.
 * Ported from RequestforQuotation.update_email_id()
 */
export function updateEmailId(
  suppliers: RFQSupplier[],
  contactEmailMap: Record<string, string>
): RFQSupplier[] {
  return suppliers.map((rfqSupplier) => {
    if (!rfqSupplier.email_id && rfqSupplier.contact) {
      const email = contactEmailMap[rfqSupplier.contact];
      if (email) {
        return { ...rfqSupplier, email_id: email };
      }
    }
    return rfqSupplier;
  });
}

/**
 * Validate that email_id is present for email sending.
 * Ported from RequestforQuotation.validate_email_id()
 */
export function validateEmailId(
  emailId: string | undefined,
  idx: number,
  supplier: string
): ValidationResult<never> {
  if (!emailId) {
    return {
      valid: false,
      error: `Row ${idx}: For Supplier ${supplier}, Email Address is Required to send an email`,
    };
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Qty Validation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Validate that qty is not zero (unless unit price items allowed).
 * Ported from BuyingController.validate_qty_is_not_zero()
 */
export function validateQtyIsNotZero(
  items: RFQItem[],
  hasUnitPriceItems: boolean
): ValidationResult<never> {
  for (const item of items) {
    if (!hasUnitPriceItems && flt(item.qty) === 0) {
      return {
        valid: false,
        error: `Row ${item.idx}: Qty cannot be zero for item ${item.item_code}`,
      };
    }
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Email Template Data                                                */
/* ------------------------------------------------------------------ */

/**
 * Apply email template defaults to RFQ.
 * Ported from RequestforQuotation.set_data_for_supplier()
 */
export function applyEmailTemplateData(
  doc: RFQDoc,
  templateData: EmailTemplateData | null
): RFQDoc {
  if (!templateData) return doc;

  let d = { ...doc };
  d.use_html = templateData.use_html ?? false;

  if (templateData.use_html) {
    if (!d.mfs_html) {
      d.mfs_html = templateData.response_html ?? "";
    }
  } else {
    if (!d.message_for_supplier) {
      d.message_for_supplier = templateData.response ?? "";
    }
  }

  if (!d.subject) {
    d.subject = templateData.subject ?? "";
  }

  return d;
}

/* ------------------------------------------------------------------ */
/*  Supplier Quotation Mapping                                         */
/* ------------------------------------------------------------------ */

export interface SQMappingContext {
  forSupplier?: string;
  supplierCurrency?: string;
  supplierPriceList?: string;
  supplierPartNoMap?: Record<string, string>;
}

/**
 * Build Supplier Quotation document from RFQ.
 * Ported from make_supplier_quotation_from_rfq()
 */
export function buildSupplierQuotationFromRFQ(
  rfq: RFQDoc,
  ctx: SQMappingContext
): SupplierQuotationDoc {
  const sq: SupplierQuotationDoc = {
    supplier: ctx.forSupplier ?? rfq.suppliers[0]?.supplier ?? "",
    company: rfq.company,
    currency: ctx.supplierCurrency ?? rfq.currency ?? "",
    buying_price_list: ctx.supplierPriceList,
    opportunity: rfq.opportunity,
    items: [],
  };

  for (const item of rfq.items) {
    const sqItem: SupplierQuotationItemData = {
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      qty: item.qty,
      conversion_factor: item.conversion_factor,
      warehouse: item.warehouse,
      material_request: item.material_request,
      material_request_item: item.material_request_item,
      stock_qty: item.stock_qty,
      uom: item.uom,
      request_for_quotation_item: item.name,
      request_for_quotation: rfq.name,
      supplier_part_no: ctx.supplierPartNoMap
        ? ctx.supplierPartNoMap[`${item.item_code}:${sq.supplier}`]
        : undefined,
    };

    sq.items.push(sqItem);
  }

  return sq;
}

/* ------------------------------------------------------------------ */
/*  Material Request → RFQ Mapping                                     */
/* ------------------------------------------------------------------ */

export interface MaterialRequestItemRef {
  material_request: string;
  item_code: string;
}

/**
 * Group material request items by MR name.
 * Pure transform — caller runs the query.
 */
export function groupMaterialRequestsByName(
  mrItemsList: MaterialRequestItemRef[]
): Record<string, string[]> {
  const materialRequests: Record<string, string[]> = {};

  for (const d of mrItemsList) {
    if (!materialRequests[d.material_request]) {
      materialRequests[d.material_request] = [];
    }
    if (!materialRequests[d.material_request].includes(d.item_code)) {
      materialRequests[d.material_request].push(d.item_code);
    }
  }

  return materialRequests;
}

/* ------------------------------------------------------------------ */
/*  RFQ Supplier Status                                                */
/* ------------------------------------------------------------------ */

export interface SupplierQuotationCount {
  supplier: string;
  request_for_quotation_item: string;
  count: number;
}

/**
 * Update quote_status for each RFQ supplier based on existing Supplier Quotations.
 * Ported from RequestforQuotation.update_rfq_supplier_status()
 */
export function updateRFQSupplierStatus(
  suppliers: RFQSupplier[],
  rfqItems: RFQItem[],
  sqCounts: SupplierQuotationCount[]
): RFQSupplier[] {
  return suppliers.map((supplier) => {
    let quoteStatus = "Received";

    for (const item of rfqItems) {
      const count = sqCounts.find(
        (c) =>
          c.supplier === supplier.supplier &&
          c.request_for_quotation_item === item.name
      );

      if (!count || count.count === 0) {
        quoteStatus = "Pending";
        break;
      }
    }

    return { ...supplier, quote_status: quoteStatus };
  });
}

/* ------------------------------------------------------------------ */
/*  Portal / Supplier Link                                             */
/* ------------------------------------------------------------------ */

/**
 * Check if supplier has a portal user entry.
 * Ported from create_supplier_quotation() permission check.
 */
export function hasPortalUser(
  supplier: string,
  portalUsers: string[]
): boolean {
  return portalUsers.includes(supplier);
}

/* ------------------------------------------------------------------ */
/*  PDF / Print Preview                                                */
/* ------------------------------------------------------------------ */

/**
 * Set vendor and supplier_part_no for print preview.
 * Ported from RequestforQuotation.before_print() / update_supplier_part_no()
 */
export function setSupplierPartNoForPrint(
  doc: RFQDoc,
  supplier: string,
  supplierPartNoMap: Record<string, string>
): RFQDoc {
  let d = { ...doc };
  d.vendor = supplier;

  d.items = d.items.map((item) => {
    const key = `${item.item_code}:${supplier}`;
    return { ...item, supplier_part_no: supplierPartNoMap[key] };
  });

  return d;
}
