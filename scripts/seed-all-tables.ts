#!/usr/bin/env tsx
/**
 * Generate seed data for ALL 520 erpnext_port tables using DeepSeek V4 Flash.
 *
 * Strategy:
 * 1. TIER 1 - Masters (no FK deps): Company, UOM, Account, Warehouse, Territory, Item Group, Customer Group, Supplier Group
 * 2. TIER 2 - Reference data: Item, Customer, Supplier, Price List, Tax Template, Cost Center, Project
 * 3. TIER 3 - Transactions: SO, PO, DN, PR, SI, PI, Stock Entry, JV, Payment Entry
 * 4. TIER 4 - India-specific: GST settings, HSN, e-Invoice, e-Way Bill
 * 5. TIER 5 - Dormant tables: 1-3 dummy rows each
 *
 * FK consistency: previously generated names are passed forward as "existing records".
 */

import { PrismaClient } from "@/prisma/client";
import { chat } from "@/lib/azure-openai";
import * as fs from "fs";

const prisma = new PrismaClient();

// --- TIER DEFINITIONS ---
// Each tier: list of model names to generate, max rows per table
const TIERS = [
  {
    name: "MASTERS",
    models: [
      "Uom", "UomCategory", "Territory", "CustomerGroup", "SupplierGroup",
      "ItemGroup", "Warehouse", "WarehouseType", "Company", "Account",
      "CostCenter", "Department", "Designation", "Brand", "Currency",
      "FiscalYear", "ModeOfPayment", "PaymentTermsTemplate", "PrintFormat",
      "TermsAndConditions", "LetterHead", "EmailAccount", "Notification",
    ],
    rows: 5,
    notes: "No foreign key dependencies. Generate realistic India/UAE business names.",
  },
  {
    name: "ITEMS & PARTIES",
    models: [
      "Item", "ItemDefault", "ItemPrice", "ItemTaxTemplate", "ItemTaxTemplateDetail",
      "Customer", "Supplier", "Contact", "Address", "DynamicLink",
      "SalesPartner", "SalesTeam", "ItemSupplier",
    ],
    rows: 8,
    notes: "Reference Tier 1 masters. Items need UOM, Item Group, Warehouse. Customers need Territory, Customer Group.",
  },
  {
    name: "TAX & PRICING",
    models: [
      "PurchaseTaxesAndChargesTemplate", "PurchaseTaxesAndCharges",
      "SalesTaxesAndChargesTemplate", "SalesTaxesAndCharges",
      "PriceList", "ItemPrice", "PricingRule", "TaxCategory",
      "TaxRule", "ShippingRule", "ShippingRuleCondition",
    ],
    rows: 4,
    notes: "Reference Items, Accounts, Companies. India: CGST 9%+SGST 9% or IGST 18%. UAE: 5% VAT.",
  },
  {
    name: "INDIA COMPLIANCE",
    models: [
      "GstHsnCode", "GstAccount", "GstSettings", "EInvoiceSettings",
      "EWayBillSettings", "EInvoiceRequestLog", "EInvoiceUser",
      "GstInwardSupply", "GstItem",
    ],
    rows: 3,
    notes: "India-specific. HSN codes 4/6/8 digits. GSTIN format: 22AAAAA0000A1Z5",
  },
  {
    name: "UAE COMPLIANCE",
    models: [
      "UaeVatSettings", "UaeVatAccount",
    ],
    rows: 2,
    notes: "UAE-specific. TRN format: 1234567890123. 5% VAT.",
  },
  {
    name: "TRANSACTIONS - SELLING",
    models: [
      "Quotation", "QuotationItem",
      "SalesOrder", "SalesOrderItem",
      "DeliveryNote", "DeliveryNoteItem",
      "SalesInvoice", "SalesInvoiceItem", "SalesInvoicePayment",
      "SalesInvoiceTimesheet", "SalesInvoiceReference",
    ],
    rows: 5,
    notes: "Full sell cycle: Quotation -> SO -> DN -> SI. Reference Customers, Items, Warehouses, Tax Templates.",
  },
  {
    name: "TRANSACTIONS - BUYING",
    models: [
      "RequestForQuotation", "RequestForQuotationItem", "RequestForQuotationSupplier",
      "PurchaseOrder", "PurchaseOrderItem", "PurchaseOrderTax", "PurchaseOrderPaymentSchedule",
      "PurchaseReceipt", "PurchaseReceiptItem", "PurchaseReceiptItemSupplied",
      "PurchaseInvoice", "PurchaseInvoiceItem", "PurchaseInvoiceAdvance",
    ],
    rows: 5,
    notes: "Full buy cycle: RFQ -> PO -> PR -> PI. Reference Suppliers, Items, Warehouses.",
  },
  {
    name: "TRANSACTIONS - STOCK",
    models: [
      "StockEntry", "StockEntryItem", "StockEntryDetail",
      "StockReconciliation", "StockReconciliationItem",
      "MaterialRequest", "MaterialRequestItem",
      "PickList", "PickListItem",
    ],
    rows: 4,
    notes: "Stock movements: Receipt, Issue, Transfer, Reconciliation. Update bin quantities.",
  },
  {
    name: "TRANSACTIONS - ACCOUNTING",
    models: [
      "JournalEntry", "JournalEntryAccount",
      "PaymentEntry", "PaymentEntryDeduction", "PaymentEntryReference",
      "GL_Entry",
    ],
    rows: 5,
    notes: "Journal entries must balance (debit = credit). Payment entries link to invoices.",
  },
  {
    name: "DORMANT - EDUCATION",
    models: ["Student", "StudentGroup", "Course", "Program", "Instructor", "Assessment", "Fees"],
    rows: 2,
    notes: "DORMANT. Generate minimal dummy data.",
  },
  {
    name: "DORMANT - HEALTHCARE",
    models: ["Patient", "Practitioner", "VitalSigns", "LabTest", "TherapyType", "HealthcarePractitioner"],
    rows: 2,
    notes: "DORMANT. Minimal dummy data.",
  },
  {
    name: "DORMANT - AGRICULTURE",
    models: ["Crop", "CropCycle", "LandUnit", "Disease", "Fertilizer"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - HOSPITALITY",
    models: ["HotelRoom", "HotelRoomType", "HotelRoomReservation", "Restaurant", "RestaurantTable"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - WEBSITE",
    models: ["BlogPost", "WebPage", "WebsiteTheme", "SocialMediaPost", "WebsiteAttribute"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - CRM",
    models: ["Lead", "Opportunity", "Campaign", "EmailCampaign", "Communication", "Newsletter"],
    rows: 2,
    notes: "DORMANT. Not using ERPNext's built-in CRM.",
  },
  {
    name: "DORMANT - MANUFACTURING",
    models: ["BOM", "BOMItem", "BOMOperation", "JobCard", "DowntimeEntry", "WorkOrderOperation"],
    rows: 2,
    notes: "DORMANT unless you activate manufacturing module.",
  },
  {
    name: "DORMANT - HR",
    models: ["Employee", "EmployeeEducation", "SalaryStructure", "PayrollEntry", "LeaveApplication", "ExpenseClaim"],
    rows: 2,
    notes: "DORMANT unless HR module activated.",
  },
  {
    name: "DORMANT - ASSETS",
    models: ["Asset", "AssetCategory", "AssetMovement", "DepreciationSchedule", "AssetRepair"],
    rows: 2,
    notes: "DORMANT unless asset module activated.",
  },
  {
    name: "DORMANT - PROJECTS",
    models: ["Project", "Task", "Timesheet", "TimesheetDetail", "ProjectUpdate"],
    rows: 2,
    notes: "DORMANT unless project module activated.",
  },
  {
    name: "DORMANT - SUPPORT",
    models: ["Issue", "ServiceLevelAgreement", "WarrantyClaim", "MaintenanceVisit", "MaintenanceSchedule"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - SUBSCRIPTIONS",
    models: ["Subscription", "SubscriptionPlan", "SubscriptionSettings", "SubscriptionInvoice"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - LMS",
    models: ["LMSCourse", "LMSBatch", "LMSEnrollment", "LMSCertificate", "LMSAssessment"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - INTEGRATIONS",
    models: ["Webhook", "ConnectedApp", "IntegrationRequest", "SlackWebhookURL", "OAuthClient"],
    rows: 2,
    notes: "DORMANT. Next.js app handles integrations.",
  },
  {
    name: "DORMANT - QUALITY",
    models: ["QualityInspection", "QualityInspectionReading", "QualityInspectionTemplate"],
    rows: 2,
    notes: "DORMANT unless quality module activated.",
  },
  {
    name: "DORMANT - MAINTENANCE",
    models: ["Machine", "MachineRepair", "MaintenanceLog", "MachineReading"],
    rows: 2,
    notes: "DORMANT.",
  },
  {
    name: "DORMANT - OTHERS",
    models: [],
    rows: 2,
    notes: "Any remaining ungrouped tables get 2 dummy rows each.",
  },
];

// --- HELPERS ---

function extractModelSchema(schemaText: string, modelName: string): string {
  const regex = new RegExp(`model ${modelName} \\{([^}]*)\\}`, "s");
  const match = schemaText.match(regex);
  if (!match) return "";

  const lines = match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));

  return `model ${modelName} {\n${lines.join("\n")}\n}`;
}

function cleanJsonResponse(text: string): string {
  // Remove markdown code fences
  text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  // Find first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return text.slice(start, end + 1);
}

// Track generated names for FK consistency
const generatedNames: Record<string, string[]> = {};

function addGeneratedNames(modelName: string, rows: any[]) {
  generatedNames[modelName] = rows.map((r) => r.name).filter(Boolean);
}

function getExistingNamesHint(): string {
  const parts: string[] = [];
  for (const [model, names] of Object.entries(generatedNames)) {
    if (names.length > 0) {
      parts.push(`${model}: [${names.slice(0, 5).join(", ")}${names.length > 5 ? "..." : ""}]`);
    }
  }
  return parts.length > 0
    ? `\n\nPreviously generated records (use these for foreign keys):\n${parts.join("\n")}`
    : "";
}

// --- MAIN ---

async function seedTier(tier: (typeof TIERS)[number], schemaText: string) {
  console.log(`\n--- ${tier.name} (${tier.models.length} tables) ---`);

  // Build schema chunk
  const schemas = tier.models
    .map((m) => extractModelSchema(schemaText, m))
    .filter(Boolean);

  if (schemas.length === 0) {
    console.log(`  (no models found in schema)`);
    return;
  }

  const prompt = `You are an ERP seed data generator. Generate ${tier.rows} realistic rows for each of these ${schemas.length} tables.

BUSINESS CONTEXT: A trading/manufacturing company operating in India and UAE.

SCHEMAS:
${schemas.join("\n\n")}
${getExistingNamesHint()}

RULES:
1. Output ONLY a JSON object. Keys are model names, values are arrays of row objects.
2. "name" is the primary key. Use meaningful IDs: "COMP-001", "CUST-001", "ACC-1000", "ITEM-001".
3. Dates: use 2024-01-15 to 2025-06-30.
4. Currency amounts: realistic (items ₹100-₹50000, invoices ₹1000-₹500000).
5. Booleans: mix true/false, not all false.
6. Link fields (String referencing other tables): use ONLY names from "Previously generated records" above.
7. For dormant tables: minimal realistic data is fine.
8. docstatus: 0 (draft) for most, some 1 (submitted).
9. owner/modified_by: "Administrator".
10. India GST: GSTIN format 22AAAAA0000A1Z5, HSN codes 6 digits.
11. UAE: TRN format 1234567890123.

OUTPUT FORMAT EXACTLY:
{
  "ModelName": [{...}, {...}],
  "ModelName2": [{...}]
}`;

  const { content, usage, cost } = await chat(
    [{ role: "user", content: prompt }],
    { model: "deepseek-v4-flash", temperature: 0.3 }
  );

  console.log(`  Tokens: ${usage?.prompt_tokens ?? "?"} in / ${usage?.completion_tokens ?? "?"} out | Cost: $${cost?.total?.toFixed(4) ?? "?"}`);

  // Parse JSON
  const jsonStr = cleanJsonResponse(content);
  let data: Record<string, any[]>;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.log(`  ❌ JSON parse failed. Saving raw response to debug.`);
    fs.writeFileSync(`scripts/debug-${tier.name}.txt`, content);
    return;
  }

  // Insert into DB
  let inserted = 0;
  for (const [modelName, rows] of Object.entries(data)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Map to actual Prisma model (schema uses PascalCase)
    const prismaModel = modelName;

    try {
      // Use raw query since we have 520 models and can't have 520 typed insert calls
      const tableName = prismaModel; // @@map handles this in Prisma
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((c) => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

        await prisma.$executeRawUnsafe(
          `INSERT INTO "erpnext_port"."${tableName}" (${columns.join(", ")}) VALUES (${placeholders})`,
          ...values
        );
        inserted++;
      }
      addGeneratedNames(modelName, rows);
      console.log(`  ✅ ${modelName}: ${rows.length} rows`);
    } catch (e: any) {
      console.log(`  ⚠️  ${modelName}: ${e.message.slice(0, 100)}`);
    }
  }

  console.log(`  Total inserted: ${inserted} rows`);
}

async function seedRemainingTables(schemaText: string) {
  // Find any tables not in any tier
  const allTierModels = new Set(TIERS.flatMap((t) => t.models));
  const allModels = new Set(
    Array.from(schemaText.matchAll(/model (\w+) \{/g)).map((m) => m[1])
  );

  const remaining = Array.from(allModels).filter((m) => !allTierModels.has(m) && !allTierModels.has(m));
  if (remaining.length === 0) return;

  console.log(`\n--- REMAINING ${remaining.length} tables ---`);

  // Batch remaining in groups of 15
  for (let i = 0; i < remaining.length; i += 15) {
    const batch = remaining.slice(i, i + 15);
    const schemas = batch
      .map((m) => extractModelSchema(schemaText, m))
      .filter(Boolean);

    const prompt = `Generate 2 dummy rows for each of these ${batch.length} tables. Output ONLY JSON.\n\n${schemas.join("\n\n")}`;

    const { content } = await chat([{ role: "user", content: prompt }], {
      model: "deepseek-v4-flash",
      temperature: 0.2,
    });

    const jsonStr = cleanJsonResponse(content);
    try {
      const data = JSON.parse(jsonStr);
      for (const [modelName, rows] of Object.entries(data)) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows as any[]) {
          const columns = Object.keys(row);
          const values = columns.map((c) => row[c]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "erpnext_port"."${modelName}" (${columns.join(", ")}) VALUES (${placeholders})`,
              ...values
            );
          } catch {}
        }
      }
    } catch {}

    console.log(`  Batch ${Math.floor(i / 15) + 1}/${Math.ceil(remaining.length / 15)}: ${batch.length} tables`);
  }
}

async function main() {
  console.log("=== DEEPSEEK V4 FLASH SEED GENERATOR ===");
  console.log("Model: DeepSeek-V4-Flash | Input: $0.19/M | Output: $0.51/M\n");

  const schemaText = fs.readFileSync("prisma/schema.prisma", "utf-8");

  let totalCost = 0;
  const startTime = Date.now();

  for (const tier of TIERS) {
    try {
      await seedTier(tier, schemaText);
    } catch (e) {
      console.log(`  ❌ Tier failed: ${e}`);
    }
  }

  // Seed any remaining tables not in tiers
  await seedRemainingTables(schemaText);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== DONE in ${duration}s ===`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
