#!/usr/bin/env tsx
/**
 * Seed data GENERATOR — NO DB INSERTION.
 * Generates JSON for all erpnext_port tables via DeepSeek V4 Flash.
 * Self-correcting loop: Zod validates → on error, feeds error summary → retries.
 * All validated responses saved to seed-output/{module}.json for review.
 * Temperature: 1.0 (first), 0.5 (retry). Max 2 retries.
 *
 * Improvements v3:
 * - Hardened Zod schema with .refine() enforcing name + date formats
 * - Smart retry: only error summary fed back (not full raw response)
 * - Temperature decay + exponential backoff + API timeout
 * - Module-scoped FK hints (only relevant tables passed)
 * - All output saved to seed-output/ as JSON (NO DB writes)
 * - Per-module validation report
 */

import "dotenv/config";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createAzure } from "@ai-sdk/azure";
import * as fs from "fs";
import * as path from "path";

// ── AI SDK AZURE PROVIDER ────────────────────────────────────────────────────
// Azure AI Services endpoint: https://{resource}.services.ai.azure.com/openai/v1
// The SDK appends /v1{path} to baseURL, so we strip that suffix.
const AZURE_BASE = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/v\d\/?$/, "");
const azure = createAzure({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: AZURE_BASE || undefined,
});

// ── CONSTANTS ───────────────────────────────────────────────────────────────
const MAX_ZOD_RETRIES = 3;        // retries when structured output fails
const MAX_API_RETRIES = 3;      // retries when API returns 429/5xx/timeout
const RETRY_BACKOFF_MS = 2000;
const OUTPUT_DIR = "seed-output";
const RAW_DIR = "seed-output/raw-data";
const MAX_STRING_LEN = 255;

// CLI args
const CLI_ARGS = process.argv.slice(2);
const FILTER_MODULES = CLI_ARGS.filter((a) => !a.startsWith("--"));
const DRY_RUN = CLI_ARGS.includes("--dry-run");
const MAX_TABLES_PER_MODULE = parseInt(
  CLI_ARGS.find((a) => a.startsWith("--max-tables="))?.split("=")[1] ?? "0",
  10
) || undefined;
const OVERRIDE_ROWS = parseInt(
  CLI_ARGS.find((a) => a.startsWith("--rows="))?.split("=")[1] ?? "0",
  10
) || undefined;

// ── ZOD SCHEMA: Strict validation of LLM output ─────────────────────────────
const RowValueSchema = z.union([
  z.string().min(1).max(MAX_STRING_LEN),
  z.number().finite().safe(),
  z.boolean(),
]);

const RowSchema = z
  .record(z.string().min(1), RowValueSchema)
  .refine(
    (row) =>
      "name" in row &&
      row.name !== undefined &&
      row.name !== null &&
      String(row.name).length > 0,
    { message: "Every row must have a non-empty 'name' field (primary key)", path: ["name"] }
  )
  .refine(
    (row) => {
      const dateFields = [
        "creation", "modified", "posting_date", "transaction_date",
        "from_date", "to_date", "schedule_date", "delivery_date",
      ];
      for (const f of dateFields) {
        if (f in row && typeof row[f] === "string") {
          const v = row[f] as string;
          if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
        }
      }
      return true;
    },
    { message: "Date fields must be YYYY-MM-DD or ISO-8601" }
  );

const SeedDataSchema = z.record(
  z.string().min(1).regex(/^[A-Z][a-zA-Z0-9_]*$/, "Model name must be PascalCase"),
  z.array(RowSchema).min(1, "Each model must have at least 1 row")
);

// Inferred type from Zod schema — replaces all `any[]` with proper typing
type SeedData = z.infer<typeof SeedDataSchema>;

// ── EMBEDDED MODULE MAPPING ─────────────────────────────────────────────────
const mapping: Record<string, string> = {
  // ── ACCOUNTS & FINANCE ──
  Account: "Accounts", Accountcategory: "Accounts", Accountclosingbalance: "Accounts",
  Accountingdimension: "Accounts", Accountingdimensiondetail: "Accounts",
  Accountingdimensionfilter: "Accounts", Accountingperiod: "Accounts", Accountssettings: "Accounts",
  Advancepaymentledgerentry: "Accounts", Advancetaxesandcharges: "Accounts", Bank: "Accounts",
  Bankaccount: "Accounts", Bankaccountsubtype: "Accounts", Bankaccounttype: "Accounts",
  Bankclearance: "Accounts", Bankclearancedetail: "Accounts", Bankguarantee: "Accounts",
  Bankreconciliationtool: "Accounts", Bankstatementimport: "Accounts", Banktransaction: "Accounts",
  Banktransactionmapping: "Accounts", Banktransactionpayments: "Accounts",
  Bisectaccountingstatements: "Accounts", Bisectnodes: "Accounts", Budget: "Accounts",
  Budgetaccount: "Accounts", Budgetdistribution: "Accounts", Cashierclosing: "Accounts",
  Cashierclosingpayments: "Accounts", Chartofaccountsimporter: "Accounts",
  Chequeprinttemplate: "Accounts", Costcenter: "Accounts", Costcenterallocation: "Accounts",
  Costcenterallocationpercentage: "Accounts", Discountedinvoice: "Accounts", Dunning: "Accounts",
  Dunninglettertext: "Accounts", Dunningtype: "Accounts", Exchangeraterevaluation: "Accounts",
  Exchangeraterevaluationaccount: "Accounts", Financebook: "Accounts", Financialreportrow: "Accounts",
  Financialreporttemplate: "Accounts", Glentry: "Accounts", Invoicediscounting: "Accounts",
  Journalentry: "Accounts", Journalentryaccount: "Accounts", Journalentrytemplate: "Accounts",
  Journalentrytemplateaccount: "Accounts", Ledgerhealth: "Accounts", Ledgerhealthmonitor: "Accounts",
  Ledgerhealthmonitorcompany: "Accounts", Ledgermerge: "Accounts", Ledgermergeaccounts: "Accounts",
  Paymententry: "Accounts", Paymententrydeduction: "Accounts", Paymententryreference: "Accounts",
  Paymentgatewayaccount: "Accounts", Paymentledgerentry: "Accounts", Paymentorder: "Accounts",
  Paymentorderreference: "Accounts", Paymentreconciliation: "Accounts",
  Paymentreconciliationallocation: "Accounts", Paymentreconciliationinvoice: "Accounts",
  Paymentreconciliationpayment: "Accounts", Paymentreference: "Accounts", Paymentrequest: "Accounts",
  Paymentschedule: "Accounts", Paymentterm: "Accounts", Paymenttermstemplate: "Accounts",
  Paymenttermstemplatedetail: "Accounts", Periodclosingvoucher: "Accounts", Plaidsettings: "Accounts",
  Processdeferredaccounting: "Accounts", Processpaymentreconciliation: "Accounts",
  Processpaymentreconciliationlog: "Accounts",
  Processpaymentreconciliationlogallocations: "Accounts", Processperiodclosingvoucher: "Accounts",
  Processperiodclosingvoucherdetail: "Accounts", Processstatementofaccounts: "Accounts",
  Processstatementofaccountscc: "Accounts", Processstatementofaccountscustomer: "Accounts",
  Psoacostcenter: "Accounts", Psoaproject: "Accounts", Repostaccountingledger: "Accounts",
  Repostaccountingledgeritems: "Accounts", Repostpaymentledger: "Accounts",
  Repostpaymentledgeritems: "Accounts", Unreconcilepayment: "Accounts",
  Unreconcilepaymententries: "Accounts", Overduepayment: "Accounts",

  // ── STOCK & INVENTORY ──
  Batch: "Stock", Bin: "Stock", Deliverynote: "Stock", Deliverynoteitem: "Stock",
  Deliveryscheduleitem: "Stock", Deliverysettings: "Stock", Deliverystop: "Stock",
  Deliverytrip: "Stock", Inventorydimension: "Stock", Item: "Stock", Itemalternative: "Stock",
  Itemattribute: "Stock", Itemattributevalue: "Stock", Itembarcode: "Stock", Itemdefault: "Stock",
  Itemgroup: "Stock", Itemleadtime: "Stock", Itemmanufacturer: "Stock", Itemprice: "Stock",
  Itemreorder: "Stock", Itemsupplier: "Stock", Itemvariant: "Stock", Itemvariantattribute: "Stock",
  Itemvariantsettings: "Stock", Landedcostitem: "Stock", Landedcostpurchasereceipt: "Stock",
  Landedcosttaxesandcharges: "Stock", Landedcostvendorinvoice: "Stock", Landedcostvoucher: "Stock",
  Materialrequest: "Stock", Materialrequestitem: "Stock", Materialrequestplanitem: "Stock",
  Packeditem: "Stock", Packingslip: "Stock", Packingslipitem: "Stock", Picklist: "Stock",
  Picklistitem: "Stock", Purchasereceipt: "Stock", Purchasereceiptitem: "Stock",
  Purchasereceiptitemsupplied: "Stock", Putawayrule: "Stock", Quickstockbalance: "Stock",
  Repostitemvaluation: "Stock", Serialandbatchbundle: "Stock", Serialandbatchentry: "Stock",
  Serialno: "Stock", Stockclosingbalance: "Stock", Stockclosingentry: "Stock", Stockentry: "Stock",
  Stockentrydetail: "Stock", Stockentrytype: "Stock", Stockledgerentry: "Stock",
  Stockreconciliation: "Stock", Stockreconciliationitem: "Stock", Stockrepostingsettings: "Stock",
  Stockreservationentry: "Stock", Stocksettings: "Stock", Uom: "Stock", Uomcategory: "Stock",
  Uomconversiondetail: "Stock", Uomconversionfactor: "Stock", Warehouse: "Stock",
  Warehousetype: "Stock",

  // ── SELLING ──
  Campaign: "Selling", Campaignemailschedule: "Selling", Campaignitem: "Selling",
  Customer: "Selling", Customercreditlimit: "Selling", Customergroup: "Selling",
  Customergroupitem: "Selling", Customeritem: "Selling", Installationnote: "Selling",
  Installationnoteitem: "Selling", Posclosingentry: "Selling", Posclosingentrydetail: "Selling",
  Posclosingentrytaxes: "Selling", Poscustomergroup: "Selling", Posfield: "Selling",
  Posinvoice: "Selling", Posinvoiceitem: "Selling", Posinvoicemergelog: "Selling",
  Posinvoicereference: "Selling", Positemgroup: "Selling", Posopeningentry: "Selling",
  Posopeningentrydetail: "Selling", Pospaymentmethod: "Selling", Posprofile: "Selling",
  Posprofileuser: "Selling", Possearchfields: "Selling", Possettings: "Selling",
  Pricelist: "Selling", Pricelistcountry: "Selling", Pricingrule: "Selling",
  Pricingrulebrand: "Selling", Pricingruledetail: "Selling", Pricingruleitemcode: "Selling",
  Pricingruleitemgroup: "Selling", Promotionalscheme: "Selling",
  Promotionalschemepricediscount: "Selling", Promotionalschemeproductdiscount: "Selling",
  Quotation: "Selling", Quotationitem: "Selling", Quotationlostreason: "Selling",
  Quotationlostreasondetail: "Selling", Salesinvoice: "Selling", Salesinvoiceadvance: "Selling",
  Salesinvoiceitem: "Selling", Salesinvoicepayment: "Selling", Salesinvoicereference: "Selling",
  Salesinvoicetimesheet: "Selling", Salesorder: "Selling", Salesorderitem: "Selling",
  Salespartner: "Selling", Salespartneritem: "Selling", Salespartnertype: "Selling",
  Salesperson: "Selling", Salesstage: "Selling", Salesteam: "Selling", Sellingsettings: "Selling",
  Territory: "Selling", Territoryitem: "Selling",

  // ── BUYING ──
  Blanketorder: "Buying", Blanketorderitem: "Buying", Buyingsettings: "Buying",
  Importsupplierinvoice: "Buying", Purchaseinvoice: "Buying", Purchaseinvoiceadvance: "Buying",
  Purchaseinvoiceitem: "Buying", Purchaseorder: "Buying", Purchaseorderitem: "Buying",
  Requestforquotation: "Buying", Requestforquotationitem: "Buying",
  Requestforquotationsupplier: "Buying", Supplier: "Buying", Suppliergroup: "Buying",
  Suppliergroupitem: "Buying", Supplieritem: "Buying", Supplierquotation: "Buying",
  Supplierquotationitem: "Buying", Supplierscorecard: "Buying", Supplierscorecardcriteria: "Buying",
  Supplierscorecardperiod: "Buying", Supplierscorecardscoringcriteria: "Buying",
  Supplierscorecardscoringstanding: "Buying", Supplierscorecardscoringvariable: "Buying",
  Supplierscorecardstanding: "Buying", Supplierscorecardvariable: "Buying",
  Customernumberatsupplier: "Buying", Suppliernumberatcustomer: "Buying",

  // ── MANUFACTURING ──
  Bom: "Manufacturing", Bomcreator: "Manufacturing", Bomcreatoritem: "Manufacturing",
  Bomexplosionitem: "Manufacturing", Bomitem: "Manufacturing", Bomoperation: "Manufacturing",
  Bomsecondaryitem: "Manufacturing", Bomupdatebatch: "Manufacturing", Bomupdatelog: "Manufacturing",
  Bomupdatetool: "Manufacturing", Bomwebsiteitem: "Manufacturing", Bomwebsiteoperation: "Manufacturing",
  Downtimeentry: "Manufacturing", Jobcard: "Manufacturing", Jobcarditem: "Manufacturing",
  Jobcardoperation: "Manufacturing", Jobcardscheduledtime: "Manufacturing",
  Jobcardsecondaryitem: "Manufacturing", Jobcardtimelog: "Manufacturing",
  Manufacturingsettings: "Manufacturing", Masterproductionschedule: "Manufacturing",
  Masterproductionscheduleitem: "Manufacturing", Operation: "Manufacturing",
  Plantfloor: "Manufacturing", Productionplan: "Manufacturing", Productionplanitem: "Manufacturing",
  Productionplanitemreference: "Manufacturing", Productionplanmaterialrequest: "Manufacturing",
  Productionplanmaterialrequestwarehouse: "Manufacturing", Productionplansalesorder: "Manufacturing",
  Productionplansubassemblyitem: "Manufacturing", Routing: "Manufacturing",
  Salesforecast: "Manufacturing", Salesforecastitem: "Manufacturing", Suboperation: "Manufacturing",
  Workorder: "Manufacturing", Workorderitem: "Manufacturing", Workorderoperation: "Manufacturing",
  Workstation: "Manufacturing", Workstationcost: "Manufacturing",
  Workstationoperatingcomponent: "Manufacturing",
  Workstationoperatingcomponentaccount: "Manufacturing", Workstationtype: "Manufacturing",
  Workstationworkinghour: "Manufacturing",

  // ── SUBCONTRACTING ──
  Subcontractingbom: "Subcontracting", Subcontractinginwardorder: "Subcontracting",
  Subcontractinginwardorderitem: "Subcontracting",
  Subcontractinginwardorderreceiveditem: "Subcontracting",
  Subcontractinginwardordersecondaryitem: "Subcontracting",
  Subcontractinginwardorderserviceitem: "Subcontracting", Subcontractingorder: "Subcontracting",
  Subcontractingorderitem: "Subcontracting", Subcontractingorderserviceitem: "Subcontracting",
  Subcontractingordersupplieditem: "Subcontracting", Subcontractingreceipt: "Subcontracting",
  Subcontractingreceiptitem: "Subcontracting", Subcontractingreceiptsupplieditem: "Subcontracting",

  // ── ASSETS ──
  Asset: "Assets", Assetactivity: "Assets", Assetcapitalization: "Assets",
  Assetcapitalizationassetitem: "Assets", Assetcapitalizationserviceitem: "Assets",
  Assetcapitalizationstockitem: "Assets", Assetcategory: "Assets", Assetcategoryaccount: "Assets",
  Assetdepreciationschedule: "Assets", Assetfinancebook: "Assets", Assetmovement: "Assets",
  Assetmovementitem: "Assets", Assetshiftallocation: "Assets", Assetshiftfactor: "Assets",
  Assetvalueadjustment: "Assets", Depreciationschedule: "Assets",

  // ── MAINTENANCE ──
  Assetmaintenance: "Maintenance", Assetmaintenancelog: "Maintenance",
  Assetmaintenancetask: "Maintenance", Assetmaintenanceteam: "Maintenance",
  Assetrepair: "Maintenance", Assetrepairconsumeditem: "Maintenance",
  Assetrepairpurchaseinvoice: "Maintenance", Maintenanceschedule: "Maintenance",
  Maintenancescheduledetail: "Maintenance", Maintenancescheduleitem: "Maintenance",
  Maintenanceteammember: "Maintenance", Maintenancevisit: "Maintenance",
  Maintenancevisitpurpose: "Maintenance",

  // ── PROJECTS ──
  Activitycost: "Projects", Activitytype: "Projects", Dependenttask: "Projects",
  Project: "Projects", Projectssettings: "Projects", Projecttemplate: "Projects",
  Projecttemplatetask: "Projects", Projecttype: "Projects", Projectupdate: "Projects",
  Projectuser: "Projects", Task: "Projects", Taskdependson: "Projects", Tasktype: "Projects",
  Timesheet: "Projects", Timesheetdetail: "Projects",

  // ── CRM ──
  Competitor: "CRM", Competitordetail: "CRM", Contract: "CRM",
  Contractfulfilmentchecklist: "CRM", Contracttemplate: "CRM",
  Contracttemplatefulfilmentterms: "CRM", Couponcode: "CRM", Crmnote: "CRM",
  Crmsettings: "CRM", Lead: "CRM", Marketsegment: "CRM", Opportunity: "CRM",
  Opportunityitem: "CRM", Opportunitylostreason: "CRM", Opportunitylostreasondetail: "CRM",
  Opportunitytype: "CRM", Prospect: "CRM", Prospectlead: "CRM", Prospectopportunity: "CRM",

  // ── HR ──
  Department: "Human Resource", Designation: "Human Resource", Employee: "Human Resource",
  Employeeeducation: "Human Resource", Employeeexternalworkhistory: "Human Resource",
  Employeegroup: "Human Resource", Employeegrouptable: "Human Resource",
  Employeeinternalworkhistory: "Human Resource", Holiday: "Human Resource",
  Holidaylist: "Human Resource",

  // ── SUPPORT ──
  Issue: "Support", Issuepriority: "Support", Issuetype: "Support",
  Pauseslaonstatus: "Support", Serviceday: "Support", Servicelevelagreement: "Support",
  Servicelevelpriority: "Support", Slafulfilledonstatus: "Support", Supportsearchsource: "Support",
  Supportsettings: "Support", Warrantyclaim: "Support",

  // ── QUALITY MANAGEMENT ──
  Itemqualityinspectionparameter: "Quality Management", Nonconformance: "Quality Management",
  Qualityaction: "Quality Management", Qualityactionresolution: "Quality Management",
  Qualityfeedback: "Quality Management", Qualityfeedbackparameter: "Quality Management",
  Qualityfeedbacktemplate: "Quality Management", Qualityfeedbacktemplateparameter: "Quality Management",
  Qualitygoal: "Quality Management", Qualitygoalobjective: "Quality Management",
  Qualityinspection: "Quality Management", Qualityinspectionparameter: "Quality Management",
  Qualityinspectionparametergroup: "Quality Management", Qualityinspectionreading: "Quality Management",
  Qualityinspectiontemplate: "Quality Management", Qualitymeeting: "Quality Management",
  Qualitymeetingagenda: "Quality Management", Qualitymeetingminutes: "Quality Management",
  Qualityprocedure: "Quality Management", Qualityprocedureprocess: "Quality Management",
  Qualityreview: "Quality Management", Qualityreviewobjective: "Quality Management",

  // ── TAXES & REGIONAL ──
  Customstariffnumber: "Regional", Itemtax: "Regional", Itemtaxtemplate: "Regional",
  Itemtaxtemplatedetail: "Regional", Itemwisetaxdetail: "Regional",
  Lowerdeductioncertificate: "Regional", Purchasetaxesandcharges: "Regional",
  Purchasetaxesandchargestemplate: "Regional", Salestaxesandcharges: "Regional",
  Salestaxesandchargestemplate: "Regional", Taxcategory: "Regional", Taxrule: "Regional",
  Taxwithholdingaccount: "Regional", Taxwithholdingcategory: "Regional",
  Taxwithholdingentry: "Regional", Taxwithholdinggroup: "Regional", Taxwithholdingrate: "Regional",
  Uaevataccount: "Regional", Uaevatsettings: "Regional",

  // ── TELEPHONY & COMMUNICATION ──
  Calllog: "Telephony", Communicationmedium: "Telephony", Communicationmediumtimeslot: "Telephony",
  Emailcampaign: "Communication", Emaildigest: "Communication", Emaildigestrecipient: "Communication",
  Incomingcallhandlingschedule: "Telephony", Incomingcallsettings: "Telephony",
  Smscenter: "Communication", Telephonycalltype: "Telephony", Voicecallsettings: "Telephony",

  // ── SETUP & SYSTEM ──
  Alloweddimension: "Setup", Allowedtotransactwith: "Setup", Applicableonaccount: "Setup",
  Appointment: "Setup", Appointmentbookingsettings: "Setup", Appointmentbookingslots: "Setup",
  Authorizationcontrol: "Setup", Authorizationrule: "Setup", Availabilityofslots: "Setup",
  Branch: "Setup", Brand: "Setup", Closeddocument: "Setup", Company: "Setup",
  Currencyexchange: "Setup", Currencyexchangesettings: "Setup",
  Currencyexchangesettingsdetails: "Setup", Currencyexchangesettingsresult: "Setup",
  Driver: "Setup", Drivinglicensecategory: "Setup", Fiscalyear: "Setup",
  Fiscalyearcompany: "Setup", Globaldefaults: "Setup", Incoterm: "Setup",
  Industrytype: "Setup", Linkedlocation: "Setup", Location: "Setup",
  Modeofpayment: "Setup", Modeofpaymentaccount: "Setup", Monthlydistribution: "Setup",
  Monthlydistributionpercentage: "Setup", Partylink: "Setup", Partyaccount: "Setup",
  Partyspecificitem: "Setup", Partytype: "Setup", Peggedcurrencies: "Setup",
  Peggedcurrencydetails: "Setup", Printformat: "Setup", Productbundle: "Setup",
  Productbundleitem: "Setup", Repostallowedtypes: "Setup", Sharebalance: "Setup",
  Shareholder: "Setup", Sharetransfer: "Setup", Sharetype: "Setup", Shipment: "Setup",
  Shipmentdeliverynote: "Setup", Shipmentparcel: "Setup", Shipmentparceltemplate: "Setup",
  Shippingrule: "Setup", Shippingrulecondition: "Setup", Shippingrulecountry: "Setup",
  Targetdetail: "Setup", Termsandconditions: "Setup", Variantfield: "Setup", Vehicle: "Setup",

  // ── UTILITIES & MISC ──
  Renametool: "Utilities", Transactiondeletionrecord: "Utilities",
  Transactiondeletionrecorddetails: "Utilities", Transactiondeletionrecorditem: "Utilities",
  Transactiondeletionrecordtodelete: "Utilities", Video: "Utilities", Videosettings: "Utilities",

  // ── PORTAL ──
  Portaluser: "Portal", Websiteattribute: "Portal", Websitefilterfield: "Portal",
  Websiteitemgroup: "Portal",

  // ── EDI ──
  Codelist: "EDI", Commoncode: "EDI",

  // ── BULK TRANSACTION ──
  Bulktransactionlog: "Bulk Transaction", Bulktransactionlogdetail: "Bulk Transaction",

  // ── SUBSCRIPTION (part of selling) ──
  Subscription: "Selling", Subscriptioninvoice: "Selling", Subscriptionplan: "Selling",
  Subscriptionplandetail: "Selling", Subscriptionsettings: "Selling", Processsubscription: "Selling",
};

// Normalize mapping for case-insensitive PascalCase ↔ lowercase-compound lookup
const normalizedMapping: Record<string, string> = {};
for (const [k, v] of Object.entries(mapping)) {
  normalizedMapping[k.toLowerCase()] = v;
}

// ── MODULE DEPENDENCIES (for FK hint scoping) ───────────────────────────────
const MODULE_DEPS: Record<string, string[]> = {
  Setup: [],
  Accounts: ["Setup"],
  Stock: ["Setup", "Buying", "Selling"],
  Selling: ["Setup", "Stock", "Accounts"],
  Buying: ["Setup", "Stock", "Accounts"],
  Manufacturing: ["Setup", "Stock", "Buying"],
  Subcontracting: ["Setup", "Stock", "Buying", "Manufacturing"],
  Regional: ["Setup", "Accounts"],
  Assets: ["Setup", "Accounts"],
  Maintenance: ["Setup", "Assets"],
  CRM: ["Setup", "Selling"],
  Projects: ["Setup", "Accounts"],
  "Human Resource": ["Setup"],
  Support: ["Setup"],
  "Quality Management": ["Setup", "Stock"],
  Telephony: ["Setup"],
  Communication: ["Setup"],
  Utilities: ["Setup"],
  EDI: ["Setup"],
  "Bulk Transaction": ["Setup"],
  Portal: ["Setup"],
  Unknown: ["Setup"],
};

// ── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
// System prompt = GENERAL context + rules (no table/column specifics).
// The user prompt (built dynamically in generateChunk) provides the actual
// tables, columns, types, and per-column examples for the current chunk.
const SYSTEM_PROMPT = `You generate realistic seed data for an ERPNext PostgreSQL database. The data is for Aries Marine Group — a global marine & offshore engineering company headquartered in Mumbai with operations in Dubai and worldwide.

Two primary companies:
- "Aries Marine & Engineering Services Private Limited" (abbr "AM-India", country "India", default_currency "INR", gstin "27AABCU9603R1ZM", Mumbai, Maharashtra)
- "Aries Marine (L.L.C)" (abbr "AM-Dubai", country "United Arab Emirates", default_currency "AED", trn "100012345678901", Dubai)

Rules:
1. "name" field is the primary key — unique, meaningful, human-readable (max 140 chars)
2. DateTime fields: ISO-8601 format "2024-01-15T00:00:00Z" or "YYYY-MM-DD"
3. Decimal fields: numeric values for money (e.g. 1250.50)
4. Int fields: whole numbers only (e.g. 0, 1, 10)
5. Boolean fields: true or false — mix realistically, not all false
6. Link/reference fields: must use values from EXISTING RECORDS provided in the prompt
7. Currency: realistic INR (₹1,000–₹5,000,000) and AED (500–2,500,000) amounts
8. Dates: 2024-01-15 to 2025-06-30 range
9. docstatus: 0 (draft) or 1 (submitted)
10. owner/modified_by: "Administrator"
11. Omit optional fields entirely — never set them to null
12. Output: model names as PascalCase keys, arrays of row objects as values
13. Every row MUST have a non-empty "name" field`;

// Module-specific hints — business context only, NO table lists (those come from the chunk)
const MODULE_HINTS: Record<string, { rows: number; hint: string }> = {
  Setup: {
    rows: 8,
    hint: `Create exactly TWO companies: "Aries Marine & Engineering Services Private Limited" (abbr "AM-India") and "Aries Marine (L.L.C)" (abbr "AM-Dubai"). India FY "2024-2025" (2024-04-01 to 2025-03-31); UAE calendar year "2025" (2025-01-01 to 2025-12-31). Link via FiscalYearCompany. Mode of Payment: Cash, Bank, Credit Card, Wire Transfer, Cheque. Brand names: "Aries", "Generic", "Siemens", "Caterpillar", "Hyundai". TermsAndConditions: "Standard Payment Terms - 30 days net", "UAE Delivery Terms - EXW Dubai". Shareholder names: "Sai Balaji", "Deepthi Nair".`,
  },
  Accounts: {
    rows: 6,
    hint: `Chart of Accounts: parent groups with is_group=true and realistic lft/rgt. Groups: "Assets" (1–20), "Liabilities" (21–40), "Equity" (41–50), "Income" (51–70), "Expenses" (71–100). Leaf accounts: "Cash - AM-India", "Bank - AM-India", "Debtors - AM-India", etc. + UAE variants " - AM-Dubai". Cost centers: "Main - AM-India", "Sales - AM-India", "Operations - AM-Dubai". Journal entries MUST balance: total_debit = total_credit. Naming: JournalEntry "ACC-JV-.YYYY.-00001", PaymentEntry "ACC-PAY-.YYYY.-00001". GLEntry mirrors JournalEntryAccount. India tax: CGST 9% + SGST 9% or IGST 18%. UAE: VAT 5%.`,
  },
  Stock: {
    rows: 5,
    hint: `Marine & offshore items. UOMs: "NOS", "KG", "SET", "HR", "LTR", "BOX". Item groups: "Raw Material", "Finished Good", "Consumable", "Service", "Marine Equipment", "Safety Gear". Warehouses: "Stores - AM-India", "Finished Goods - AM-India", "Stores - AM-Dubai", "Main - AM-Dubai". Include marine items: steel plates, welding rods, safety helmets, ROV spare parts. StockEntry naming: "MAT-STE-.YYYY.-00001", PurchaseReceipt "PUR-REC-.YYYY.-00001", DeliveryNote "SAL-DN-.YYYY.-00001". Bin: projected_qty = actual_qty + ordered_qty - reserved_qty. StockLedgerEntry mirrors StockEntryDetail movements.`,
  },
  Selling: {
    rows: 5,
    hint: `Marine/offshore customers: "ADNOC Offshore" (Government, UAE), "Dubai Ports Authority" (Government, UAE), "ONGC Ltd" (Commercial, India), "L&T Shipbuilding" (Commercial, India). Full cycle: Quotation→SalesOrder→DeliveryNote→SalesInvoice. Naming: Quotation "SAL-QTN-.YYYY.-00001", SalesOrder "SAL-ORD-.YYYY.-00001", DeliveryNote "SAL-DN-.YYYY.-00001", SalesInvoice "SACC-SINV-.YYYY.-00001". Amount consistency: qty × rate = amount. India: CGST 9% + SGST 9% or IGST 18%; UAE: 5% VAT. One credit note with is_return=true.`,
  },
  Buying: {
    rows: 5,
    hint: `Marine/offshore suppliers: "Hyundai Heavy Industries" (Marine Equipment, South Korea), "Jotun Paints UAE" (Coatings, UAE), "Tata Steel" (Raw Material, India), "Caterpillar Marine" (Engines, UAE). Full cycle: RFQ→SupplierQuotation→PurchaseOrder→PurchaseReceipt→PurchaseInvoice. Naming: RFQ "PUR-RFQ-.YYYY.-00001", SQ "PUR-SQTN-.YYYY.-00001", PO "PUR-ORD-.YYYY.-00001", PR "PUR-REC-.YYYY.-00001", PI "PACC-PINV-.YYYY.-00001". Amount consistency: qty × rate = amount. India: CGST+SGST or IGST; UAE: 5% VAT.`,
  },
  Manufacturing: {
    rows: 3,
    hint: `Marine/offshore manufacturing. BOM = one finished good (e.g. "Subsea Pipeline Flange", "Offshore Platform Bracket") with 2–4 raw materials. Operations: "Flame Cutting", "CNC Milling", "Submerged Arc Welding", "NDT", "Hot-Dip Galvanizing", "Final Assembly". time_in_mins 20–180, hourly_rate ₹250–₹1,200. Workstations: "CNC-Plasma-01", "SAW-Bay-A", "NDT-Station-1". WorkOrder qty 10–40. Downtime: "Machine Breakdown", "Material Shortage", "Power Failure".`,
  },
  Regional: {
    rows: 4,
    hint: `India GST: Maharashtra GSTIN 27AABCU9603R1ZM. HSN: 730890 (steel), 890120 (vessels), 850120 (marine engines), 731815 (bolts). Intra-state: CGST 9% + SGST 9%; inter-state: IGST 18%. UAE VAT: TRN 100012345678901, 5% flat. TaxRule: "Within Maharashtra"→CGST+SGST; "Outside Maharashtra"→IGST; "UAE Local Supply"→VAT 5%.`,
  },
  "Quality Management": {
    rows: 3,
    hint: `ISO 9001:2015 + ISO 45001 certified. Parameters: "Weld Penetration" (8.0mm ±0.5), "Coating Thickness" (350μm ±25), "Hydrostatic Pressure" (15.0 bar ±0.5), "Surface Roughness" (Ra 3.2μm ±0.5), "NDT Ultrasonic" (Accept/Reject/Conditional), "Bolt Torque" (280 Nm ±10). Rule: ANY rejected reading → overall "Rejected". Generate two Accepted, one Rejected inspection.`,
  },
  Subcontracting: {
    rows: 3,
    hint: `Subcontractors for hot-dip galvanizing, NDT, specialized welding. BOM qty × order qty = supplied qty exactly. Receipt may be partial (e.g. 18/20), consumed = receipt proportion. Status: Draft→Submitted→Completed.`,
  },
  Assets: {
    rows: 2,
    hint: `Marine/offshore assets. Categories: "Marine Vessels", "Heavy Machinery", "Office Equipment", "Vehicles". Examples: Deep-Sea ROV (₹4,500,000), Crawler Crane 50T, Diesel Generator 500KVA. Depreciation 5–10 years.`,
  },
  Maintenance: {
    rows: 1,
    hint: `Critical marine equipment maintenance. Preventive + corrective. Assets from previous modules.`,
  },
  CRM: {
    rows: 2,
    hint: `Marine/offshore B2B leads. Sources: Referral, Exhibition-OTC, Website. Market segments: "Oil & Gas", "Marine", "Offshore". Competitors: "Global Diving & Marine", "Vertechs Offshore".`,
  },
  Projects: {
    rows: 2,
    hint: `Marine projects: vessel retrofit, pipeline inspection, platform maintenance. ProjectType: "External", "Internal", "R&D". Activities: "Diving Operations", "Welding", "Inspection", "Engineering".`,
  },
  "Human Resource": {
    rows: 2,
    hint: `Marine/offshore workforce. Departments: "Marine Operations", "Engineering", "Safety & HSE", "Finance", "HR". Designations: "Marine Engineer", "Commercial Diver", "NDT Inspector", "Safety Officer". Indian + UAE employees.`,
  },
  Support: {
    rows: 2,
    hint: `Equipment + software issue tracking. IssueType: "Equipment", "Software", "Safety", "Vessel". Priority: "Low"–"Critical". Marine Equipment SLA: response 4h.`,
  },
  Telephony: {
    rows: 1,
    hint: `VOIP for offshore rig comms. Call types: "Rig Emergency", "Client Inquiry". Satellite phone medium.`,
  },
  Utilities: { rows: 1, hint: `Minimal. ERP training videos, bulk delete logs.` },
  EDI: { rows: 1, hint: `Maritime EDI. EDIFACT D96B: BAPLIE (bayplan), IFTMBC (booking).` },
  "Bulk Transaction": { rows: 1, hint: `Bulk import logs. Minimal data.` },
  Portal: { rows: 1, hint: `Client portal for ADNOC/ONGC type customers. Minimal data.` },
  Communication: { rows: 1, hint: `HSE newsletters, SMS for UAE ops. Minimal data.` },
  Unknown: { rows: 1, hint: `Only IndiaChartOfAccounts and UAEChartOfAccounts — skip all other country COA templates. One minimal row per other unclassified table.` },
};

// ── PRIORITY ORDER ──────────────────────────────────────────────────────────
const PRIORITY_ORDER = [
  { prio: "critical", modules: ["Setup", "Accounts", "Stock", "Selling", "Buying"] },
  { prio: "high", modules: ["Manufacturing", "Regional", "Quality Management", "Subcontracting"] },
  { prio: "medium", modules: ["CRM", "Projects", "Assets", "Human Resource", "Support", "Maintenance"] },
  { prio: "dormant", modules: [] as string[] },
];

// ── TYPE DEFINITIONS ────────────────────────────────────────────────────────
interface ModelInfo {
  name: string;
  tableName: string;
  schemaBlock: string;
  fields: string[];
}

interface ModuleReport {
  name: string;
  tables: number;
  models: number;
  rows: number;
  retries: number;
  savedTo: string;
}

// ── PARSE SCHEMA ────────────────────────────────────────────────────────────
function parseSchema(): ModelInfo[] {
  const text = fs.readFileSync("prisma/schema.prisma", "utf-8");
  const models: ModelInfo[] = [];
  const regex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (!m[0].includes('@@schema("erpnext_port")')) continue;
    const mapMatch = m[0].match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : m[1];

    // Compact schema block: model name + fields with types
    const lines = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));
    const fields = lines
      .map((l) => {
        const parts = l.split(/\s+/);
        const name = parts[0];
        let type = parts[1] ?? "String";
        // Simplify Prisma types for LLM
        if (type.includes("DateTime")) type = "DateTime";
        else if (type.includes("Decimal")) type = "Decimal";
        else if (type.includes("Int")) type = "Int";
        else if (type.includes("Float")) type = "Float";
        else if (type.includes("Boolean")) type = "Boolean";
        else type = "String";
        const isOptional = l.includes("?");
        return `${name}${isOptional ? "?" : ""}: ${type}`;
      })
      .filter(Boolean);

    const compactBlock = `model ${m[1]} {\n  ${fields.join("\n  ")}\n}`;

    models.push({
      name: m[1],
      tableName,
      schemaBlock: compactBlock,
      fields: fields.map((f) => f.replace(/\?$/, "")),
    });
  }
  return models;
}

// ── COST TRACKING ───────────────────────────────────────────────────────────
const COST = { input: 0, output: 0, calls: 0, retries: 0, usd: 0 };

// ── SAVE COST REPORT ────────────────────────────────────────────────────────
function saveCostReport(report: ModuleReport[]) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const costPath = path.join(OUTPUT_DIR, "_cost-report.json");
  const summaryPath = path.join(OUTPUT_DIR, "_summary.json");

  // Detailed cost report
  const costReport = {
    generatedAt: new Date().toISOString(),
    model: process.env.AZURE_DEEPSEEK_MODEL ?? "DeepSeek-V4-Flash",
    pricing: { inputPer1M: 0.19, outputPer1M: 0.51 },
    totals: {
      calls: COST.calls,
      retries: COST.retries,
      inputTokens: COST.input,
      outputTokens: COST.output,
      costUsd: parseFloat(COST.usd.toFixed(4)),
      costInr: parseFloat((COST.usd * 83.5).toFixed(2)),
    },
    modules: report.map((r) => ({
      module: r.name,
      tables: r.tables,
      models: r.models,
      rows: r.rows,
      file: path.basename(r.savedTo),
    })),
  };

  fs.writeFileSync(costPath, JSON.stringify(costReport, null, 2));

  // Combined summary (cost + all module data references)
  const summary = {
    _meta: {
      generatedAt: new Date().toISOString(),
      model: process.env.AZURE_DEEPSEEK_MODEL ?? "DeepSeek-V4-Flash",
      totalModules: report.length,
      totalModels: report.reduce((s, r) => s + r.models, 0),
      totalRows: report.reduce((s, r) => s + r.rows, 0),
      totalCalls: COST.calls,
      totalRetries: COST.retries,
      inputTokens: COST.input,
      outputTokens: COST.output,
      costUsd: parseFloat(COST.usd.toFixed(4)),
      costInr: parseFloat((COST.usd * 83.5).toFixed(2)),
    },
    files: report.reduce((acc, r) => {
      acc[r.name] = path.basename(r.savedTo);
      return acc;
    }, {} as Record<string, string>),
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  return { costPath, summaryPath };
}

// ── AZURE MODEL SELECTOR ──────────────────────────────────────────────────
function getModel(deployment: string) {
  return azure.chat(deployment);
}

// ── FK HINT BUILDER (module-scoped) ─────────────────────────────────────────
function buildFkHint(
  existing: Record<string, string[]>,
  currentModule: string
): string {
  const deps = MODULE_DEPS[currentModule] ?? [];
  const allowed = new Set([currentModule, ...deps]);

  const selfRefTables = new Set([
    "Account", "ItemGroup", "CostCenter", "Warehouse",
    "Territory", "Department", "Task", "BOM",
  ]);

  const lines: string[] = [];
  for (const [table, names] of Object.entries(existing)) {
    if (names.length === 0) continue;
    const tableMod = normalizedMapping[table.toLowerCase()] ?? "Unknown";
    if (!allowed.has(tableMod) && !selfRefTables.has(table)) continue;

    const preview = names.slice(0, 5).join(", ");
    if (names.length > 20) {
      lines.push(`${table}: [${preview} …(${names.length})]`);
    } else {
      lines.push(`${table}: [${preview}${names.length > 5 ? ` …(${names.length})` : ""}]`);
    }
  }
  return lines.join("\n");
}

// ── SELF-CORRECTING GENERATION ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`API timeout after ${ms}ms`)), ms)
    ),
  ]);

// ── API CALL WITH 429/5xx RETRY (wraps generateText) ────────────────────
async function callWithApiRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = MAX_API_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), 90_000);
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status ?? e?.statusCode;
      const isRetryable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        e.message?.includes("timeout") ||
        e.message?.includes("ECONNRESET") ||
        e.message?.includes("ETIMEDOUT") ||
        e.message?.includes("socket hang up") ||
        e.message?.includes("rate limit");

      if (!isRetryable || attempt >= maxAttempts) throw e;

      const delay = Math.min(4000 * Math.pow(2, attempt - 1), 60000);
      console.log(`    ⏳ API ${status ?? "error"} (attempt ${attempt}/${maxAttempts}) → retry in ${delay}ms`);
      COST.retries++;
      await sleep(delay);
    }
  }
  throw new Error("API retry exhausted");
}

// ── Build per-column example value for the user prompt ────────────────────
// Only provides examples for KNOWN fields; for unknown String fields, no example
// (let the LLM infer from field name + business context)
function columnExample(fieldName: string, type: string): string | null {
  const f = fieldName.toLowerCase();
  // Known fixed-value fields
  if (f === "name") return '"SET-001"';
  if (f === "docstatus") return "0 or 1";
  if (f === "idx") return "1";
  if (f === "owner" || f === "modified_by") return '"Administrator"';
  if (f === "creation" || f === "modified") return '"2024-01-15T00:00:00Z"';
  if (f === "company" || f === "parent") return '"Aries Marine & Engineering Services Private Limited"';
  if (f === "parentfield") return '"items" or relevant field name';
  if (f === "parenttype") return '"Company" or parent DocType';
  // Type-based defaults for numeric/boolean only
  if (type === "Boolean") return "true/false";
  if (type === "Int") return "0";
  if (type === "Decimal" || type === "Float") return "0.0";
  if (type === "DateTime") return '"2024-01-15T00:00:00Z"';
  // String fields — no generic example, let LLM infer from context
  return null;
}

// ── GENERATE ONE CHUNK OF MODELS (AI SDK + Output.object) ───────────────
async function generateChunk(
  moduleName: string,
  chunk: ModelInfo[],
  _allModuleModels: ModelInfo[],
  existing: Record<string, string[]>,
  moduleConfig: { rows: number; hint: string },
  rowsOverride?: number
): Promise<SeedData> {
  const deployment = process.env.AZURE_DEEPSEEK_MODEL ?? "DeepSeek-V4-Flash";
  const model = getModel(deployment);
  const rows = rowsOverride ?? moduleConfig.rows;
  const fkHint = buildFkHint(existing, moduleName);

  // Build per-table schema with column examples
  const tableDefs = chunk.map((m) => {
    const fields = m.schemaBlock
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("model"))
      .map((l) => l.trim().replace(/[,;]$/, ""));
    const examples: string[] = [];
    for (const f of fields) {
      const parts = f.split(":");
      const fName = parts[0]?.trim().replace(/\?$/, "") ?? "";
      const fType = parts[1]?.trim() ?? "String";
      const isOpt = f.includes("?");
      const ex = columnExample(fName, fType);
      const exStr = ex ? `  → e.g. ${ex}` : "";
      examples.push(`    ${fName}${isOpt ? "?" : ""}: ${fType}${exStr}`);
    }
    return `TABLE: ${m.name}\n  Columns:\n${examples.join("\n")}`;
  }).join("\n\n");

  const userContent = `We need seed data for the following ${chunk.length} table(s) in our ERPNext PostgreSQL database. Generate ${rows} rows per table.

${tableDefs}

${fkHint ? `EXISTING RECORDS (use ONLY these names for foreign key / Link fields):\n${fkHint}\n` : ""}
Business context for this module: ${moduleConfig.hint}

Output: JSON object with PascalCase model names as keys, each mapping to an array of row objects. Every row must have a unique "name" PK. Omit optional fields entirely — never null.`;

  const systemPrompt = SYSTEM_PROMPT;

  // Build raw-data file prefix for this chunk (per-attempt suffix appended)
  const chunkSlug = `${moduleName.replace(/\s+/g, "_")}-${chunk.map((m) => m.name).join("_")}`;

  for (let attempt = 1; attempt <= MAX_ZOD_RETRIES; attempt++) {
    const temperature = attempt === 1 ? 1.0 : 0.5;
    const attemptSlug = `${chunkSlug}-attempt${attempt}`;

    // ── Always save the request BEFORE calling ──
    if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
    const reqPath = path.join(RAW_DIR, `req-${attemptSlug}.json`);
    const reqPayload = {
      _meta: { module: moduleName, model: deployment, temperature, attempt, chunkTables: chunk.map((m) => m.name) },
      system: systemPrompt,
      user: userContent,
    };
    fs.writeFileSync(reqPath, JSON.stringify(reqPayload, null, 2));

    try {
      const result = await callWithApiRetry(() =>
        generateText({
          model,
          system: systemPrompt,
          prompt: userContent,
          temperature,
          maxOutputTokens: 16000,
          output: Output.object({ schema: SeedDataSchema }),
          onStepFinish: (event) => {
            if (event.usage) {
              const inTok = event.usage.inputTokens ?? 0;
              const outTok = event.usage.outputTokens ?? 0;
              console.log(`    📊 Step ${event.stepNumber}: ${inTok} in / ${outTok} out tokens (${event.finishReason})`);
            }
          },
        })
      );

      // ── Always save the response ──
      const resPath = path.join(RAW_DIR, `res-${attemptSlug}.json`);
      fs.writeFileSync(resPath, JSON.stringify({
        _meta: { module: moduleName, model: deployment, temperature, attempt, chunkTables: chunk.map((m) => m.name), status: "ok" },
        response: result.text,
        usage: result.totalUsage ?? result.usage ?? null,
        output: result.output,
      }, null, 2));

      // Output.object ensures result.output is already Zod-validated
      const data = result.output;
      if (!data || Object.keys(data).length === 0) {
        console.log(`    ❌ Attempt ${attempt}: structured output returned empty object`);
        if (attempt >= MAX_ZOD_RETRIES) return {};
        COST.retries++;
        await sleep(RETRY_BACKOFF_MS * attempt);
        continue;
      }

      // Track cost (use totalUsage which aggregates across all steps)
      COST.calls++;
      const usage = result.totalUsage ?? result.usage;
      const inputTok = usage?.inputTokens ?? 0;
      const outputTok = usage?.outputTokens ?? 0;

      // Azure DeepSeek often omits token counts — estimate from text length (~4 chars/tok)
      if (inputTok === 0 && outputTok === 0) {
        const estInput = Math.ceil((systemPrompt.length + userContent.length) / 4);
        const estOutput = Math.ceil((result.text?.length ?? 0) / 4);
        COST.input += estInput;
        COST.output += estOutput;
        COST.usd += (estInput / 1e6) * 0.19 + (estOutput / 1e6) * 0.51;
      } else {
        COST.input += inputTok;
        COST.output += outputTok;
        COST.usd += (inputTok / 1e6) * 0.19 + (outputTok / 1e6) * 0.51;
      }

      if (attempt > 1) console.log(`    ✅ Fixed on attempt ${attempt}`);
      return data;

    } catch (e: unknown) {
      // ── Always save the error response ──
      const resPath = path.join(RAW_DIR, `res-${attemptSlug}.json`);
      const errorInfo: Record<string, unknown> = {
        _meta: { module: moduleName, model: deployment, temperature, attempt, chunkTables: chunk.map((m) => m.name), status: "error" },
        errorType: e instanceof Error ? e.constructor.name : "Unknown",
        errorMessage: e instanceof Error ? e.message : String(e),
      };

      if (e instanceof NoObjectGeneratedError) {
        errorInfo.rawText = e.text;
        errorInfo.finishReason = e.finishReason;
      }

      fs.writeFileSync(resPath, JSON.stringify(errorInfo, null, 2));

      if (e instanceof NoObjectGeneratedError) {
        console.log(`    ❌ Attempt ${attempt}: structured output generation failed (NoObjectGeneratedError)`);
        if (attempt >= MAX_ZOD_RETRIES) {
          console.log(`    ⚠️ All ${MAX_ZOD_RETRIES} attempts failed. Raw data saved to ${RAW_DIR}`);
          return {};
        }
        COST.retries++;
        await sleep(RETRY_BACKOFF_MS * attempt);
        continue;
      }

      // API-level error (429/5xx exhausted, timeout, etc.)
      const msg = e instanceof Error ? e.message?.slice(0, 80) : "unknown";
      console.log(`    ❌ API call failed: ${msg}`);
      return {};
    }
  }

  return {};
}

// ── GENERATE FULL MODULE (chunked, PARALLEL) ───────────────────────────────
async function generateWithZodRetry(
  moduleName: string,
  models: ModelInfo[],
  existing: Record<string, string[]>,
  rowsOverride?: number
): Promise<SeedData> {
  const config = MODULE_HINTS[moduleName] ?? MODULE_HINTS.Unknown;
  const rows = rowsOverride ?? config.rows;

  // Chunk size: 1 table per API call
  const CHUNK_SIZE = 1;
  const merged: SeedData = {};

  // Build chunks
  const chunks: ModelInfo[][] = [];
  for (let i = 0; i < models.length; i += CHUNK_SIZE) {
    chunks.push(models.slice(i, i + CHUNK_SIZE));
  }

  if (chunks.length > 1) {
    console.log(`    ${chunks.length} chunks → firing ${Math.min(chunks.length, 10)} in parallel (rate limit: 1000 req/min)`);
  }

  // Process chunks with concurrency limit of 14
  const CONCURRENCY = 14;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, idx) =>
        generateChunk(moduleName, chunk, models, existing, config, rows).then((data) => {
          if (chunks.length > 1) {
            const globalIdx = i + idx + 1;
            const ok = Object.keys(data).length > 0 ? "✅" : "❌";
            console.log(`      ${ok} chunk ${globalIdx}/${chunks.length} done (${Object.keys(data).length} models)`);
          }
          return data;
        })
      )
    );

    for (const data of results) {
      for (const [key, rows] of Object.entries(data)) {
        merged[key] = [...(merged[key] ?? []), ...rows];
      }
    }
  }

  return merged;
}

// ── SAVE JSON (replaces DB insertion) ──────────────────────────────────────
function saveJson(moduleName: string, data: SeedData): { path: string; totalRows: number } {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const safeName = moduleName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(OUTPUT_DIR, `${safeName}.json`);

  // Add metadata envelope
  const envelope = {
    _meta: {
      module: moduleName,
      generatedAt: new Date().toISOString(),
      model: process.env.AZURE_DEEPSEEK_MODEL ?? "DeepSeek-V4-Flash",
      tables: Object.keys(data).length,
      totalRows: Object.values(data).reduce((s, rows) => s + rows.length, 0),
    },
    ...data,
  };

  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2));
  return { path: filePath, totalRows: envelope._meta.totalRows };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== SEED DATA GENERATOR — Aries Marine ERPNext ===");
  console.log("Generates JSON files in seed-output/. NO DB insertion.\n");
  console.log("Companies: Aries Marine & Engg Services Pvt Ltd (India) + Aries Marine LLC (Dubai)");
  console.log("temperature=1.0→0.5 | max_retries=2\n");

  if (FILTER_MODULES.length > 0) {
    console.log(`🔍 Filtering to modules: ${FILTER_MODULES.join(", ")}\n`);
  }
  if (DRY_RUN) {
    console.log("⚠️ DRY RUN — no API calls, just listing what would be generated\n");
  }

  const allModels = parseSchema();
  console.log(`Schema models loaded: ${allModels.length}\n`);

  // Group by module
  const byModule = new Map<string, ModelInfo[]>();
  for (const model of allModels) {
    const mod = normalizedMapping[model.name.toLowerCase()] ?? "Unknown";
    const list = byModule.get(mod) ?? [];
    list.push(model);
    byModule.set(mod, list);
  }

  const existing: Record<string, string[]> = {};
  const report: ModuleReport[] = [];
  const start = Date.now();

  for (const tier of PRIORITY_ORDER) {
    const tierModules =
      tier.modules.length > 0
        ? tier.modules.filter((m) => byModule.has(m))
        : Array.from(byModule.keys()).filter(
            (m) => !PRIORITY_ORDER.flatMap((t) => t.modules).includes(m)
          );

    if (tierModules.length === 0) continue;
    console.log(`\n--- ${tier.prio.toUpperCase()} (${tierModules.length} modules) ---`);

    for (const modName of tierModules) {
      // Skip if filtered
      if (FILTER_MODULES.length > 0 && !FILTER_MODULES.includes(modName)) continue;

      let models = byModule.get(modName) ?? [];
      if (models.length === 0) continue;

      // Apply table limit for testing
      if (MAX_TABLES_PER_MODULE && models.length > MAX_TABLES_PER_MODULE) {
        models = models.slice(0, MAX_TABLES_PER_MODULE);
      }

      const config = MODULE_HINTS[modName] ?? MODULE_HINTS.Unknown;
      const rows = OVERRIDE_ROWS ?? config.rows;
      console.log(`\n${modName} (${models.length} tables, ${rows} rows)...`);

      if (DRY_RUN) {
        console.log(`    [DRY] Would generate ${rows} rows × ${models.length} models`);
        report.push({
          name: modName,
          tables: models.length,
          models: models.length,
          rows: rows * models.length,
          retries: 0,
          savedTo: path.join(OUTPUT_DIR, `${modName.replace(/\s+/g, "_")}.json`),
        });
        continue;
      }

      const data = await generateWithZodRetry(modName, models, existing, rows);

      // Save to JSON
      const { path: filePath } = saveJson(modName, data);

      // Track names for FK hints in subsequent modules
      let modelCount = 0;
      let rowCount = 0;
      for (const [modelName, rows] of Object.entries(data)) {
        modelCount++;
        rowCount += rows.length;
        const names = rows.map((r) => String(r.name)).filter(Boolean);
        if (names.length) {
          existing[modelName] = [...(existing[modelName] ?? []), ...names];
        }
      }

      report.push({
        name: modName,
        tables: models.length,
        models: modelCount,
        rows: rowCount,
        retries: COST.retries,
        savedTo: filePath,
      });

      console.log(
        `  💾 Saved ${rowCount} rows (${modelCount} models) → ${filePath} | $${COST.usd.toFixed(4)} total`
      );
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);

  // ── FINAL REPORT ─────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`              GENERATION REPORT`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.table(
    report.map((r) => ({
      Module: r.name,
      Tables: r.tables,
      Models: r.models,
      Rows: r.rows,
      File: path.basename(r.savedTo),
    }))
  );

  const totalRows = report.reduce((s, r) => s + r.rows, 0);
  const totalModels = report.reduce((s, r) => s + r.models, 0);

  console.log(`\n=== DONE in ${duration}s ===`);
  console.log(`Modules generated: ${report.length}`);
  console.log(`Total models: ${totalModels}`);
  console.log(`Total rows: ${totalRows}`);
  console.log(`Output dir: ${path.resolve(OUTPUT_DIR)}`);
  console.log(`API calls: ${COST.calls}`);
  console.log(`Retries (Zod errors): ${COST.retries}`);
  console.log(`Input:  ${COST.input.toLocaleString()} tok`);
  console.log(`Output: ${COST.output.toLocaleString()} tok`);
  console.log(`COST: $${COST.usd.toFixed(4)} (~$${Math.ceil(COST.usd * 100) / 100})`);

  // Save cost + summary to files
  const { costPath, summaryPath } = saveCostReport(report);
  console.log(`\n💰 Cost report saved → ${costPath}`);
  console.log(`📋 Summary saved     → ${summaryPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
