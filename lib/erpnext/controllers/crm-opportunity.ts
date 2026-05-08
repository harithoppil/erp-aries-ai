/**
 * Ported from erpnext/crm/doctype/opportunity/opportunity.py
 * Pure business logic for Opportunity validation, calculations and mapping.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OpportunityItem {
  id?: string;
  item_code?: string;
  item_name?: string;
  uom?: string;
  qty: number;
  brand?: string;
  item_group?: string;
  description?: string;
  image?: string;
  rate?: number;
  amount?: number;
  base_rate?: number;
  base_amount?: number;
  idx: number;
}

export interface OpportunityLostReasonDetail {
  lost_reason?: string;
}

export interface CompetitorDetail {
  competitor?: string;
}

export interface CRMNote {
  note?: string;
  added_by?: string;
  added_on?: Date;
}

export interface Opportunity {
  id?: string;
  name?: string;
  naming_series?: string;
  opportunity_from: string;
  party_name: string;
  customer_name?: string;
  status: string;
  opportunity_type?: string;
  opportunity_owner?: string;
  sales_stage?: string;
  expected_closing?: Date;
  probability?: number;
  no_of_employees?: string;
  annual_revenue?: number;
  customer_group?: string;
  industry?: string;
  market_segment?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  territory?: string;
  currency?: string;
  conversion_rate?: number;
  opportunity_amount?: number;
  base_opportunity_amount?: number;
  total?: number;
  base_total?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  company: string;
  transaction_date: Date;
  language?: string;
  amended_from?: string;
  title?: string;
  first_response_time?: string;
  order_lost_reason?: string;
  contact_person?: string;
  contact_email?: string;
  contact_mobile?: string;
  whatsapp?: string;
  phone?: string;
  phone_ext?: string;
  customer_address?: string;
  address_display?: string;
  contact_display?: string;
  items?: OpportunityItem[];
  lost_reasons?: OpportunityLostReasonDetail[];
  competitors?: CompetitorDetail[];
  notes?: CRMNote[];
  docstatus?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Lead {
  name?: string;
  lead_name?: string;
  company_name?: string;
  email_id?: string;
  mobile_no?: string;
  status?: string;
}

export interface ProspectLead {
  lead?: string;
  lead_name?: string;
  email?: string;
  mobile_no?: string;
  lead_owner?: string;
  status?: string;
}

export interface ProspectOpportunity {
  opportunity?: string;
  amount?: number;
  stage?: string;
  deal_owner?: string;
  probability?: number;
  expected_closing?: Date;
  currency?: string;
  contact_person?: string;
}

export interface Prospect {
  name?: string;
  company_name?: string;
  leads?: ProspectLead[];
  opportunities?: ProspectOpportunity[];
}

export interface Customer {
  name?: string;
  customer_name?: string;
  email?: string;
  lead_name?: string;
  opportunity_name?: string;
  default_currency?: string;
}

export interface Quotation {
  name?: string;
  quotation_to?: string;
  opportunity?: string;
  enq_no?: string;
  status?: string;
  docstatus?: number;
  party_name?: string;
  items?: { prevdoc_docname?: string }[];
}

export interface Item {
  item_code: string;
  item_name?: string;
  stock_uom?: string;
  image?: string;
  description?: string;
  item_group?: string;
  brand?: string;
}

export interface Communication {
  sender?: string;
  sender_full_name?: string;
  phone_no?: string;
  reference_doctype?: string;
  reference_name?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface NewLeadResolution {
  opportunityFrom: string;
  partyName: string;
  newLead?: Partial<Lead>;
}

export interface OpportunityValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  doc?: Opportunity;
  items?: OpportunityItem[];
}

/* ------------------------------------------------------------------ */
/*  Opportunity type & exchange rate                                   */
/* ------------------------------------------------------------------ */

export function setOpportunityType(doc: Opportunity): string {
  return doc.opportunity_type || "Sales";
}

export function setExchangeRate(
  currency: string | undefined,
  companyCurrency: string,
  currentRate: number | undefined,
  transactionDate: Date,
  getRate: (from: string, to: string, date: Date) => number
): number {
  if (currency === companyCurrency) return 1.0;
  if (!currentRate || currentRate === 1.0) {
    return getRate(currency || companyCurrency, companyCurrency, transactionDate);
  }
  return currentRate;
}

/* ------------------------------------------------------------------ */
/*  Totals calculation                                                 */
/* ------------------------------------------------------------------ */

export function calculateTotals(
  doc: Opportunity,
  items: OpportunityItem[]
): { total: number; baseTotal: number; items: OpportunityItem[] } {
  let total = 0;
  let baseTotal = 0;
  const rate = doc.conversion_rate || 1.0;

  const updatedItems = items.map((item) => {
    const amount = (item.rate || 0) * item.qty;
    const baseRate = rate * (item.rate || 0);
    const baseAmount = rate * amount;
    total += amount;
    baseTotal += baseAmount;
    return {
      ...item,
      amount,
      base_rate: baseRate,
      base_amount: baseAmount,
    };
  });

  return { total, baseTotal, items: updatedItems };
}

/* ------------------------------------------------------------------ */
/*  Item detail validation                                             */
/* ------------------------------------------------------------------ */

export function validateItemDetails(
  items: OpportunityItem[],
  itemMap: Record<string, Item>
): OpportunityItem[] {
  const fields: (keyof Item)[] = ["item_name", "description", "item_group", "brand"];

  return items.map((item) => {
    if (!item.item_code) return item;
    const source = itemMap[item.item_code];
    if (!source) return item;

    const updated: OpportunityItem = { ...item };
    for (const key of fields) {
      const k = key as keyof OpportunityItem;
      const rec = updated as unknown as Record<string, unknown>;
      if (!rec[k as string]) {
        rec[k as string] = source[key];
      }
    }
    return updated;
  });
}

export function validateUomIsInteger(
  items: { uom?: string; qty: number; idx: number }[],
  uomMap: Record<string, boolean>
): string[] {
  const errors: string[] = [];

  for (const item of items) {
    if (!item.uom) continue;
    if (uomMap[item.uom]) {
      if (Math.abs(Math.round(item.qty) - item.qty) > 0.0000001) {
        errors.push(
          `Row ${item.idx}: Quantity (${item.qty}) cannot be a fraction. To allow this, disable 'Must be Whole Number' in UOM ${item.uom}.`
        );
      }
    }
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/*  Customer name resolution                                           */
/* ------------------------------------------------------------------ */

export function validateCustName(
  doc: Opportunity,
  leads: Lead[],
  prospects: Prospect[]
): string {
  if (!doc.party_name) return doc.customer_name || "";

  if (doc.opportunity_from === "Customer") {
    return doc.customer_name || doc.party_name;
  }

  if (doc.opportunity_from === "Lead") {
    const prospect = prospects.find((p) =>
      p.leads?.some((l) => l.lead === doc.party_name)
    );
    if (prospect?.company_name) {
      return prospect.company_name;
    }
    const lead = leads.find((l) => l.name === doc.party_name);
    return lead?.company_name || lead?.lead_name || doc.party_name;
  }

  if (doc.opportunity_from === "Prospect") {
    const prospect = prospects.find((p) => p.name === doc.party_name);
    return prospect?.company_name || doc.party_name;
  }

  return doc.customer_name || "";
}

/* ------------------------------------------------------------------ */
/*  Auto-create Lead from contact email                                */
/* ------------------------------------------------------------------ */

export function makeNewLeadIfRequired(
  contactEmail: string | undefined,
  leads: Lead[],
  customers: Customer[],
  getFullname?: (email: string) => string
): NewLeadResolution {
  if (!contactEmail) {
    return { opportunityFrom: "", partyName: "" };
  }

  const customer = customers.find((c) => c.email === contactEmail);
  if (customer?.name) {
    return { opportunityFrom: "Customer", partyName: customer.name };
  }

  const lead = leads.find((l) => l.email_id === contactEmail);
  if (lead?.name) {
    return { opportunityFrom: "Lead", partyName: lead.name };
  }

  let senderName = getFullname ? getFullname(contactEmail) : undefined;
  if (senderName === contactEmail) {
    senderName = undefined;
  }
  if (!senderName && contactEmail.includes("@")) {
    const emailName = contactEmail.split("@")[0];
    senderName = emailName
      .split(".")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  }

  return {
    opportunityFrom: "Lead",
    partyName: "",
    newLead: {
      email_id: contactEmail,
      lead_name: senderName || "Unknown",
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Lost declaration                                                   */
/* ------------------------------------------------------------------ */

export function declareEnquiryLost(
  doc: Opportunity,
  lostReasonsList: string[],
  competitorsList: string[],
  detailedReason?: string,
  quotations?: Quotation[]
): { doc: Opportunity; error?: string } {
  if (hasActiveQuotation(doc.name || "", quotations || [])) {
    return {
      doc,
      error: "Cannot declare as lost, because Quotation has been made.",
    };
  }

  const updated: Opportunity = {
    ...doc,
    status: "Lost",
    order_lost_reason: detailedReason || doc.order_lost_reason,
    lost_reasons: lostReasonsList.map((r) => ({ lost_reason: r })),
    competitors: competitorsList.map((c) => ({ competitor: c })),
  };

  return { doc: updated };
}

/* ------------------------------------------------------------------ */
/*  Quotation existence checks                                         */
/* ------------------------------------------------------------------ */

export function hasActiveQuotation(
  oppName: string,
  quotations: Quotation[]
): boolean {
  return quotations.some(
    (q) =>
      q.opportunity === oppName &&
      q.docstatus === 1 &&
      q.status !== "Lost" &&
      q.status !== "Closed"
  );
}

export function hasOrderedQuotation(
  oppName: string,
  quotations: Quotation[]
): boolean {
  return quotations.some(
    (q) => q.opportunity === oppName && q.docstatus === 1 && q.status === "Ordered"
  );
}

export function hasLostQuotation(
  oppName: string,
  quotations: Quotation[]
): boolean {
  const lost = quotations.some(
    (q) => q.opportunity === oppName && q.docstatus === 1 && q.status === "Lost"
  );
  if (!lost) return false;
  return !hasActiveQuotation(oppName, quotations);
}

/* ------------------------------------------------------------------ */
/*  Auto-close opportunities                                           */
/* ------------------------------------------------------------------ */

export function autoCloseOpportunity(
  opportunities: Opportunity[],
  days: number
): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return opportunities
    .filter(
      (o) =>
        o.status === "Replied" &&
        o.updated_at &&
        new Date(o.updated_at) < cutoff
    )
    .map((o) => o.name || "")
    .filter((n): n is string => !!n);
}

/* ------------------------------------------------------------------ */
/*  Item details fetch (pure)                                          */
/* ------------------------------------------------------------------ */

export function getItemDetails(
  itemCode: string,
  itemMap: Record<string, Item>
): Partial<OpportunityItem> {
  const item = itemMap[itemCode];
  if (!item) {
    return {
      item_code: itemCode,
      item_name: "",
      uom: "",
      description: "",
      image: "",
      item_group: "",
      brand: "",
    };
  }

  return {
    item_code: itemCode,
    item_name: item.item_name || "",
    uom: item.stock_uom || "",
    description: item.description || "",
    image: item.image || "",
    item_group: item.item_group || "",
    brand: item.brand || "",
  };
}

/* ------------------------------------------------------------------ */
/*  Prospect update from Opportunity                                   */
/* ------------------------------------------------------------------ */

export function updateProspectFromOpportunity(
  prospect: Prospect,
  doc: Opportunity
): Prospect {
  const oppValues: ProspectOpportunity = {
    opportunity: doc.name || "",
    amount: doc.opportunity_amount,
    stage: doc.sales_stage,
    deal_owner: doc.opportunity_owner,
    probability: doc.probability,
    expected_closing: doc.expected_closing,
    currency: doc.currency,
    contact_person: doc.contact_person,
  };

  let alreadyAdded = false;
  const opportunities = prospect.opportunities?.map((o) => {
    if (o.opportunity === doc.name) {
      alreadyAdded = true;
      return { ...o, ...oppValues };
    }
    return o;
  });

  if (!alreadyAdded) {
    opportunities?.push(oppValues);
  }

  return { ...prospect, opportunities };
}

/* ------------------------------------------------------------------ */
/*  Composite validation                                               */
/* ------------------------------------------------------------------ */

export function validateOpportunity(
  doc: Opportunity,
  items: OpportunityItem[],
  itemMap: Record<string, Item>,
  leads: Lead[],
  prospects: Prospect[],
  uomMap: Record<string, boolean>
): OpportunityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let workingDoc: Opportunity = { ...doc };

  if (!workingDoc.opportunity_type) {
    workingDoc = { ...workingDoc, opportunity_type: "Sales" };
  }

  const validatedItems = validateItemDetails(items, itemMap);

  const uomErrors = validateUomIsInteger(
    validatedItems.map((i) => ({ uom: i.uom, qty: i.qty, idx: i.idx })),
    uomMap
  );
  errors.push(...uomErrors);

  const customerName = validateCustName(workingDoc, leads, prospects);
  if (customerName !== workingDoc.customer_name) {
    workingDoc = { ...workingDoc, customer_name: customerName };
  }

  if (!workingDoc.title) {
    workingDoc = { ...workingDoc, title: workingDoc.customer_name };
  }

  const { total, baseTotal, items: calculatedItems } = calculateTotals(
    workingDoc,
    validatedItems
  );
  workingDoc = {
    ...workingDoc,
    total,
    base_total: baseTotal,
    items: calculatedItems,
  };

  if (errors.length > 0) {
    return { success: false, error: errors.join("; "), warnings };
  }

  return { success: true, warnings, doc: workingDoc, items: calculatedItems };
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

export function mapOpportunityToQuotation(doc: Opportunity): Partial<Quotation> {
  return {
    quotation_to: doc.opportunity_from,
    enq_no: doc.name,
    party_name: doc.party_name,
    opportunity: doc.name,
  };
}

export function mapOpportunityToCustomer(doc: Opportunity): Partial<Customer> {
  const customer: Partial<Customer> = {
    opportunity_name: doc.name,
    customer_name: doc.customer_name,
    default_currency: doc.currency,
  };

  if (doc.opportunity_from === "Lead") {
    customer.lead_name = doc.party_name;
  }

  return customer;
}

export function mapOpportunityToSupplierQuotation(
  doc: Opportunity
): Partial<Quotation> {
  return {
    opportunity: doc.name,
    party_name: doc.party_name,
  };
}

export function mapOpportunityToRequestForQuotation(
  doc: Opportunity
): Partial<Quotation> {
  return {
    opportunity: doc.name,
    party_name: doc.party_name,
  };
}

export function makeOpportunityFromCommunication(
  leadName: string,
  company: string
): Partial<Opportunity> {
  return {
    company,
    opportunity_from: "Lead",
    party_name: leadName,
  };
}
