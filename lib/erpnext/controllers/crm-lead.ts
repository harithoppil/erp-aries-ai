/**
 * Ported from erpnext/crm/doctype/lead/lead.py
 * Pure business logic for Lead validation, derivation and mapping.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CRMNote {
  note?: string;
  added_by?: string;
  added_on?: Date;
}

export interface Lead {
  id?: string;
  name?: string;
  naming_series?: string;
  salutation?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  lead_name?: string;
  job_title?: string;
  gender?: string;
  lead_owner?: string;
  status: string;
  customer?: string;
  type?: string;
  request_type?: string;
  email_id?: string;
  website?: string;
  mobile_no?: string;
  whatsapp_no?: string;
  phone?: string;
  phone_ext?: string;
  company_name?: string;
  no_of_employees?: string;
  annual_revenue?: number;
  industry?: string;
  market_segment?: string;
  territory?: string;
  fax?: string;
  city?: string;
  state?: string;
  country?: string;
  qualification_status?: string;
  qualified_by?: string;
  qualified_on?: Date;
  company?: string;
  language?: string;
  image?: string;
  title?: string;
  disabled?: boolean;
  unsubscribed?: boolean;
  blog_subscriber?: boolean;
  notes?: CRMNote[];
  docstatus?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface ProspectLead {
  lead: string;
  lead_name?: string;
  email?: string;
  mobile_no?: string;
  lead_owner?: string;
  status?: string;
}

export interface ProspectOpportunity {
  opportunity: string;
  amount?: number;
  stage?: string;
  deal_owner?: string;
  probability?: number;
  expected_closing?: Date;
  currency?: string;
  contact_person?: string;
}

export interface Prospect {
  id?: string;
  name?: string;
  company_name?: string;
  customer_group?: string;
  no_of_employees?: string;
  annual_revenue?: number;
  market_segment?: string;
  industry?: string;
  territory?: string;
  prospect_owner?: string;
  website?: string;
  fax?: string;
  company?: string;
  notes?: CRMNote[];
  leads?: ProspectLead[];
  opportunities?: ProspectOpportunity[];
}

export interface Contact {
  first_name?: string;
  last_name?: string;
  salutation?: string;
  gender?: string;
  designation?: string;
  company_name?: string;
  email_ids?: { email_id: string; is_primary?: number }[];
  phone_nos?: { phone: string; is_primary_phone?: number; is_primary_mobile_no?: number }[];
}

export interface Customer {
  name?: string;
  customer_type?: string;
  customer_name?: string;
  customer_group?: string;
  lead_name?: string;
  phone_1?: string;
  fax_1?: string;
  customer_primary_address?: string;
  customer_primary_contact?: string;
}

export interface OpportunityItem {
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

export interface Opportunity {
  name?: string;
  opportunity_from?: string;
  party_name?: string;
  contact_display?: string;
  customer_name?: string;
  contact_email?: string;
  contact_mobile?: string;
  opportunity_owner?: string;
  notes?: string;
  status?: string;
  title?: string;
  currency?: string;
  conversion_rate?: number;
  transaction_date?: Date;
  company?: string;
  items?: OpportunityItem[];
  docstatus?: number;
}

export interface Quotation {
  name?: string;
  quotation_to?: string;
  party_name?: string;
  customer_address?: string;
  contact_person?: string;
  opportunity?: string;
  enq_no?: string;
  currency?: string;
  conversion_rate?: number;
  transaction_date?: Date;
  company?: string;
  status?: string;
  docstatus?: number;
  items?: OpportunityItem[];
}

export interface Communication {
  sender?: string;
  sender_full_name?: string;
  phone_no?: string;
}

export interface CRMSettings {
  allow_lead_duplication_based_on_emails?: boolean;
  auto_creation_of_contact?: boolean;
  carry_forward_communication_and_comments?: boolean;
}

export interface LeadDetails {
  territory?: string;
  customerName?: string;
  contactDisplay?: string;
  contactEmail?: string;
  contactMobile?: string;
  contactPhone?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

/* ------------------------------------------------------------------ */
/*  Lead Name / Title helpers                                          */
/* ------------------------------------------------------------------ */

export function setFullName(doc: Lead): string {
  if (doc.first_name) {
    return [doc.salutation, doc.first_name, doc.middle_name, doc.last_name]
      .filter((n): n is string => !!n)
      .join(" ");
  }
  return doc.lead_name || "";
}

export function setLeadName(doc: Lead): string {
  if (doc.lead_name) return doc.lead_name;
  if (doc.company_name) return doc.company_name;
  if (doc.email_id) return doc.email_id.split("@")[0];
  return "";
}

export function setTitle(doc: Lead): string {
  return doc.company_name || doc.lead_name || "";
}

export function parseFullName(fullName: string): {
  firstName?: string;
  middleName?: string;
  lastName?: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/* ------------------------------------------------------------------ */
/*  Email validation                                                   */
/* ------------------------------------------------------------------ */

export function checkEmailIdIsUnique(
  doc: Lead,
  existingLeads: Lead[],
  allowDuplication: boolean
): string | null {
  if (!doc.email_id || allowDuplication) return null;

  const duplicates = existingLeads.filter(
    (l) => l.email_id === doc.email_id && l.name !== doc.name
  );

  if (duplicates.length > 0) {
    const names = duplicates.map((d) => d.name).join(", ");
    return `Email Address must be unique, it is already used in ${names}`;
  }

  return null;
}

export function validateEmailId(
  doc: Lead,
  ignoreEmailValidation?: boolean
): string[] {
  const errors: string[] = [];
  if (!doc.email_id) return errors;

  if (!ignoreEmailValidation) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(doc.email_id)) {
      errors.push(`Invalid Email Address: ${doc.email_id}`);
    }
  }

  if (doc.email_id === doc.lead_owner) {
    errors.push("Lead Owner cannot be same as the Lead Email Address");
  }

  return errors;
}

export function getGravatarUrl(email: string): string {
  const hash = email.trim().toLowerCase();
  return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}

/* ------------------------------------------------------------------ */
/*  Lead validation                                                    */
/* ------------------------------------------------------------------ */

export function validateLead(
  doc: Lead,
  existingLeads: Lead[],
  settings: CRMSettings
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const leadName = setLeadName(doc);
  if (!leadName && !doc.company_name && !doc.email_id) {
    errors.push("A Lead requires either a person's name or an organization's name");
  }

  const emailError = checkEmailIdIsUnique(
    doc,
    existingLeads,
    settings.allow_lead_duplication_based_on_emails ?? false
  );
  if (emailError) errors.push(emailError);

  errors.push(...validateEmailId(doc));

  if (errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return { success: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  Contact / Prospect creation from Lead                              */
/* ------------------------------------------------------------------ */

export function createContactFromLead(doc: Lead): Contact {
  const leadName = doc.lead_name || setFullName(doc) || setLeadName(doc);

  const contact: Contact = {
    first_name: doc.first_name || leadName,
    last_name: doc.last_name,
    salutation: doc.salutation,
    gender: doc.gender,
    designation: doc.job_title,
    company_name: doc.company_name,
    email_ids: doc.email_id ? [{ email_id: doc.email_id, is_primary: 1 }] : [],
    phone_nos: [],
  };

  if (doc.phone) {
    contact.phone_nos.push({ phone: doc.phone, is_primary_phone: 1 });
  }
  if (doc.mobile_no) {
    contact.phone_nos.push({ phone: doc.mobile_no, is_primary_mobile_no: 1 });
  }

  return contact;
}

export function createProspectFromLead(doc: Lead): Prospect {
  return {
    company_name: doc.company_name,
    no_of_employees: doc.no_of_employees,
    industry: doc.industry,
    market_segment: doc.market_segment,
    annual_revenue: doc.annual_revenue,
    territory: doc.territory,
    fax: doc.fax,
    website: doc.website,
    prospect_owner: doc.lead_owner,
    company: doc.company,
    leads: [
      {
        lead: doc.name || "",
        lead_name: doc.lead_name,
        email: doc.email_id,
        mobile_no: doc.mobile_no,
        lead_owner: doc.lead_owner,
        status: doc.status,
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers (Lead → Customer / Opportunity / Quotation)        */
/* ------------------------------------------------------------------ */

export function mapLeadToCustomer(
  doc: Lead,
  defaultCustomerGroup?: string
): Partial<Customer> {
  const customer: Partial<Customer> = {};

  if (doc.company_name) {
    customer.customer_type = "Company";
    customer.customer_name = doc.company_name;
  } else {
    customer.customer_type = "Individual";
    customer.customer_name = doc.lead_name;
  }

  customer.lead_name = doc.name;
  customer.phone_1 = doc.phone;
  customer.fax_1 = doc.fax;

  if (defaultCustomerGroup) {
    customer.customer_group = defaultCustomerGroup;
  }

  return customer;
}

export function mapLeadToOpportunity(doc: Lead): Partial<Opportunity> {
  return {
    opportunity_from: "Lead",
    party_name: doc.name,
    contact_display: doc.lead_name,
    customer_name: doc.company_name,
    contact_email: doc.email_id,
    contact_mobile: doc.mobile_no,
    opportunity_owner: doc.lead_owner,
    notes: doc.notes ? JSON.stringify(doc.notes) : undefined,
  };
}

export function mapLeadToQuotation(doc: Lead): Partial<Quotation> {
  return {
    quotation_to: "Lead",
    party_name: doc.name,
  };
}

/* ------------------------------------------------------------------ */
/*  Lead details / Communication helpers                               */
/* ------------------------------------------------------------------ */

export function getLeadDetails(doc: Lead): LeadDetails {
  return {
    territory: doc.territory,
    customerName: doc.company_name || doc.lead_name,
    contactDisplay: doc.lead_name || "",
    contactEmail: doc.email_id,
    contactMobile: doc.mobile_no,
    contactPhone: doc.phone,
  };
}

export function makeLeadFromCommunication(comm: Communication): Partial<Lead> {
  return {
    lead_name: comm.sender_full_name,
    email_id: comm.sender,
    mobile_no: comm.phone_no,
  };
}

export function stripNumber(number: string): string {
  return number.replace(/^\+/, "").replace(/^0+/, "");
}

export function getLeadWithPhoneNumber(
  number: string,
  leads: Lead[]
): Lead | undefined {
  if (!number) return undefined;
  const stripped = stripNumber(number);
  return leads.find((lead) => {
    const phones = [lead.phone, lead.whatsapp_no, lead.mobile_no].filter(
      (p): p is string => !!p
    );
    return phones.some((p) => stripNumber(p).endsWith(stripped));
  });
}

/* ------------------------------------------------------------------ */
/*  Prospect linkage helpers                                           */
/* ------------------------------------------------------------------ */

export function addLeadToProspect(leadName: string, prospect: Prospect): Prospect {
  const exists = prospect.leads?.some((l) => l.lead === leadName);
  if (exists) return prospect;

  const newLead: ProspectLead = { lead: leadName };
  return {
    ...prospect,
    leads: [...(prospect.leads || []), newLead],
  };
}

export function updateProspectFromLead(prospect: Prospect, doc: Lead): Prospect {
  const updatedLeads = prospect.leads?.map((row) => {
    if (row.lead === doc.name) {
      return {
        ...row,
        lead_name: doc.lead_name,
        email: doc.email_id,
        mobile_no: doc.mobile_no,
        lead_owner: doc.lead_owner,
        status: doc.status,
      };
    }
    return row;
  });

  return { ...prospect, leads: updatedLeads };
}

export function removeLinkFromProspect(
  prospect: Prospect,
  leadName: string
): Prospect | null {
  const leads = prospect.leads || [];
  if (leads.length === 1 && leads[0].lead === leadName) {
    return null;
  }

  const filtered = leads.filter((l) => l.lead !== leadName);
  return { ...prospect, leads: filtered };
}

/* ------------------------------------------------------------------ */
/*  Existence checks (pure – caller passes related docs)               */
/* ------------------------------------------------------------------ */

export function hasCustomer(leadName: string, customers: Customer[]): boolean {
  return customers.some((c) => c.lead_name === leadName);
}

export function hasOpportunity(
  leadName: string,
  opportunities: Opportunity[]
): boolean {
  return opportunities.some(
    (o) => o.party_name === leadName && o.status !== "Lost"
  );
}

export function hasQuotation(
  leadName: string,
  quotations: Quotation[]
): boolean {
  return quotations.some(
    (q) =>
      q.party_name === leadName && q.docstatus === 1 && q.status !== "Lost"
  );
}

export function hasLostQuotation(
  leadName: string,
  quotations: Quotation[]
): boolean {
  return quotations.some(
    (q) =>
      q.party_name === leadName && q.docstatus === 1 && q.status === "Lost"
  );
}
