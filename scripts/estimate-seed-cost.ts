#!/usr/bin/env tsx
/**
 * Estimate token count and cost for generating seed data for all 520 tables
 * using DeepSeek V4 Flash via Azure OpenAI.
 */

import { encoding_for_model } from "tiktoken";
import * as fs from "fs";

// DeepSeek V4 Flash pricing (per 1M tokens)
const PRICING = {
  inputPer1M: 0.19,
  outputPer1M: 0.51,
};

// Use cl100k_base as proxy (DeepSeek uses similar tokenizer to GPT-4)
const enc = encoding_for_model("gpt-4");

function countTokens(text: string): number {
  return enc.encode(text).length;
}

interface ModelInfo {
  name: string;
  fields: string[];
  schema: string;
}

function parseSchema(): ModelInfo[] {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
  const models: ModelInfo[] = [];

  const modelRegex = /model\s+(\w+)\s+\{([^}]+)\}/gs;
  let match;

  while ((match = modelRegex.exec(schema)) !== null) {
    const name = match[1];
    const body = match[2];
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));

    const fields = lines.map((l) => l.split(/\s+/)[0]).filter(Boolean);

    models.push({
      name,
      fields,
      schema: `model ${name} {\n${body}\n}`,
    });
  }

  return models;
}

// Group models into logical batches
function groupByModule(models: ModelInfo[]): ModelInfo[][] {
  const groups: Record<string, ModelInfo[]> = {
    system: [],
    accounts: [],
    selling: [],
    buying: [],
    stock: [],
    manufacturing: [],
    hr: [],
    crm: [],
    projects: [],
    assets: [],
    support: [],
    india: [],
    uae: [],
    education: [],
    healthcare: [],
    agriculture: [],
    hospitality: [],
    website: [],
    integrations: [],
    quality: [],
    maintenance: [],
    subscriptions: [],
    other: [],
  };

  const keywords: Record<string, string[]> = {
    accounts: ["account", "gl", "journal", "payment", "invoice", "tax", "fiscal", "bank", "cost_center", "budget", "cash_flow", "profit", "loss", "balance", "ledger"],
    selling: ["sales", "quotation", "delivery", "customer", "territory", "selling", "price_list", "discount"],
    buying: ["purchase", "supplier", "request_quotation", "supplier_quotation", "buying"],
    stock: ["stock", "item", "warehouse", "bin", "serial", "batch", "uom", "reconciliation", "movement"],
    manufacturing: ["bom", "work_order", "job_card", "operation", "downtime", "production"],
    hr: ["employee", "department", "designation", "salary", "payroll", "leave", "attendance", "appraisal", "interview"],
    crm: ["lead", "opportunity", "campaign", "email_campaign", "contact", "communication"],
    projects: ["project", "task", "timesheet"],
    assets: ["asset", "depreciation", "maintenance", "asset_movement", "asset_category"],
    support: ["issue", "service_level", "warranty", "maintenance_visit"],
    india: ["gst", "tds", "eway", "einvoice", "hsn", "gstr", "igst", "cgst", "sgst"],
    uae: ["uae", "trn", "vat"],
    education: ["student", "course", "program", "instructor", "assessment", "fees"],
    healthcare: ["patient", "practitioner", "lab", "vital", "therapy", "healthcare"],
    agriculture: ["crop", "land", "disease", "pest", "soil", "harvest"],
    hospitality: ["hotel", "room", "reservation", "restaurant"],
    website: ["blog", "web_page", "website", "page", "theme", "social_media"],
    integrations: ["webhook", "slack", "connected_app", "integration"],
    quality: ["quality", "inspection"],
    maintenance: ["maintenance", "machine", "repair"],
    subscriptions: ["subscription", "plan", "usage"],
  };

  for (const model of models) {
    const lower = model.name.toLowerCase();
    let placed = false;

    for (const [group, words] of Object.entries(keywords)) {
      if (words.some((w) => lower.includes(w))) {
        groups[group].push(model);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Check for system/config tables
      if (
        model.fields.includes("creation") &&
        model.fields.includes("modified") &&
        model.fields.includes("owner") &&
        model.fields.includes("docstatus")
      ) {
        groups.system.push(model);
      } else {
        groups.other.push(model);
      }
    }
  }

  return Object.values(groups).filter((g) => g.length > 0);
}

function main() {
  const models = parseSchema();
  const groups = groupByModule(models);

  console.log("=== SEED DATA COST ESTIMATE ===\n");
  console.log(`Total models in schema: ${models.length}`);
  console.log(`Grouped into batches: ${groups.length}\n`);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const SYSTEM_PROMPT = `You are a database seed data generator. Given a set of Prisma model schemas, generate realistic seed data as JSON. For each model, produce 3-10 rows of realistic business data. All foreign key references must be consistent within the generated data. Output ONLY valid JSON in this exact format:

{
  "ModelName": [
    { "field1": "value1", "field2": "value2" },
    ...
  ]
}

Rules:
1. Use realistic company names for India/UAE markets
2. All Link/foreign key fields must reference names that exist in the generated data
3. Currency fields: use realistic amounts
4. Dates: use 2024-2025 range
5. Boolean fields: vary them, don't all default to false
6. The "name" field is the primary key (String), use meaningful IDs like "ACC-001", "CUST-001"
7. For child tables (tables with parent/parentfield/parenttype), include the parent reference`;

  const systemTokens = countTokens(SYSTEM_PROMPT);

  console.log("Per-batch breakdown:");
  console.log("-".repeat(80));

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const schemaText = group.map((m) => m.schema).join("\n\n");
    const userPrompt = `Generate seed data for these ${group.length} tables:\n\n${schemaText}\n\nGenerate 3-10 realistic rows per table. Output ONLY JSON.`;

    const inputTokens = systemTokens + countTokens(userPrompt);
    // Estimate output: ~150 tokens per row × 5 rows avg × group size
    const outputTokens = group.length * 5 * 150;

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    console.log(
      `Batch ${String(i + 1).padStart(2)} (${group[0].name}…): ${
        group.length
      } tables | Input: ${inputTokens.toLocaleString()} tok | Output: ${outputTokens.toLocaleString()} tok`
    );
  }

  console.log("-".repeat(80));
  console.log(`\nTOTALS:`);
  console.log(`  Input tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`  Combined:      ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);

  const inputCost = (totalInputTokens / 1e6) * PRICING.inputPer1M;
  const outputCost = (totalOutputTokens / 1e6) * PRICING.outputPer1M;
  const totalCost = inputCost + outputCost;

  console.log(`\nCOST (DeepSeek V4 Flash):`);
  console.log(`  Input cost:  $${inputCost.toFixed(4)}`);
  console.log(`  Output cost: $${outputCost.toFixed(4)}`);
  console.log(`  TOTAL:       $${totalCost.toFixed(4)}  (~$${totalCost.toFixed(2)})`);

  enc.free();
}

main();
