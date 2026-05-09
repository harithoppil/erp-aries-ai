#!/usr/bin/env tsx
/**
 * Test: Generate 1 table (Uom) using proper response_format json_schema.
 * No beta APIs. Temperature 1.0, top_p 1.0.
 */

import "dotenv/config";
import { azureOpenAI } from "../lib/azure-openai";

async function main() {
  const deployment = process.env.AZURE_DEEPSEEK_MODEL ?? "DeepSeek-V4-Flash";

  const schema = {
    type: "object" as const,
    properties: {
      Uom: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const, description: "PK. Short code: NOS, KG, SET, HR, MTR, LTR, BOX, PAC" },
            uom_name: { type: "string" as const, description: "Full name: Number, Kilogram, Set, Hour, Meter, Liter, Box, Pack" },
            creation: { type: "string" as const },
            modified: { type: "string" as const },
            owner: { type: "string" as const },
            modified_by: { type: "string" as const },
            docstatus: { type: "number" as const },
            idx: { type: "number" as const },
            must_be_whole_number: { type: "number" as const },
          },
          required: ["name", "uom_name"],
          additionalProperties: false,
        },
      },
    },
    required: ["Uom"],
    additionalProperties: false,
  };

  const response = await azureOpenAI.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: "system",
        content: `You generate ERP seed data for a trading company in India and UAE. Output exactly matches the provided JSON schema. Use realistic business data.`,
      },
      {
        role: "user",
        content: `Generate 5 rows for the Uom (Unit of Measure) table.

Table schema:
model Uom {
  name String @id @db.VarChar(140)
  creation DateTime? @default(now()) @db.Timestamptz(3)
  modified DateTime? @updatedAt @db.Timestamptz(3)
  modified_by String? @db.VarChar(255)
  owner String? @db.VarChar(255)
  docstatus Int? @default(0)
  idx Int? @default(0)
  uom_name String @db.VarChar(255)
  must_be_whole_number Int?
}

Rules:
- name = PK code (NOS, KG, SET, HR, MTR, LTR, BOX, PAC)
- uom_name = full readable name
- docstatus = 0, idx = auto-increment
- owner = "Administrator", modified_by = "Administrator"
- creation = "2024-01-15T00:00:00Z", modified = "2025-06-30T00:00:00Z"`,
      },
    ],
    temperature: 1.0,
    top_p: 1.0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "uom_seed",
        description: "Seed data for UOM table",
        schema,
        strict: true,
      },
    },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  console.log("=== RAW RESPONSE ===");
  console.log(content);
  console.log("\n=== PARSED ===");
  console.log(JSON.stringify(JSON.parse(content), null, 2));
  console.log("\n=== TOKENS ===");
  console.log(`Prompt: ${response.usage?.prompt_tokens}`);
  console.log(`Completion: ${response.usage?.completion_tokens}`);
  console.log(`Total: ${response.usage?.total_tokens}`);
  const cost =
    ((response.usage?.prompt_tokens ?? 0) / 1e6) * 0.19 +
    ((response.usage?.completion_tokens ?? 0) / 1e6) * 0.51;
  console.log(`Cost: $${cost.toFixed(6)}`);
}

main().catch(console.error);
