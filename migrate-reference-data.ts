/**
 * Migration script: Frappe (local PostgreSQL) -> Azure PostgreSQL
 * Migrates reference/setup data using INSERT ... ON CONFLICT (name) DO NOTHING
 *
 * CRITICAL RULES:
 * 1. READ-ONLY on Frappe DB — never modify the source
 * 2. INSERT-only on Azure — skip duplicates, never overwrite
 * 3. Only migrate columns that exist in BOTH databases
 * 4. Handle Frappe smallint (0/1) -> Azure boolean conversion
 * 5. Handle NOT NULL constraints in Azure when Frappe has NULL values
 */

import { Client as PgClient } from "pg";
import { PrismaClient } from "./prisma/client";

// Frappe source connection
const frappeConfig = {
  host: "localhost",
  port: 5432,
  database: "aries_site",
  user: "aries_frappe",
  password: "aries_pass",
};

// Azure target connection (direct pg for parameterized inserts)
const azureConfig = {
  host: "aries-erp-ai.postgres.database.azure.com",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Arieserp1!",
  ssl: { rejectUnauthorized: false },
};

// Table mapping: Frappe tabXxx -> Azure snake_case
const TABLE_MAP: Array<{
  frappeTable: string;
  azureTable: string;
  priority: number;
  label: string;
}> = [
  // Priority 1 — Large reference tables
  { frappeTable: "tabAccount", azureTable: "account", priority: 1, label: "Chart of Accounts" },
  { frappeTable: "tabUOM", azureTable: "uom", priority: 1, label: "Units of Measure" },
  { frappeTable: "tabCurrency", azureTable: "currency", priority: 1, label: "Currencies" },
  { frappeTable: "tabCountry", azureTable: "country", priority: 1, label: "Countries" },
  { frappeTable: "tabRole", azureTable: "role", priority: 1, label: "Roles" },
  { frappeTable: "tabReport", azureTable: "report", priority: 1, label: "Reports" },
  // Priority 2 — Medium reference tables
  { frappeTable: "tabDesignation", azureTable: "designation", priority: 2, label: "Designations" },
  { frappeTable: "tabDepartment", azureTable: "department", priority: 2, label: "Departments" },
  { frappeTable: "tabSupplier Group", azureTable: "supplier_group", priority: 2, label: "Supplier Groups" },
  { frappeTable: "tabStock Entry Type", azureTable: "stock_entry_type", priority: 2, label: "Stock Entry Types" },
  { frappeTable: "tabIndustry Type", azureTable: "industry_type", priority: 2, label: "Industry Types" },
  { frappeTable: "tabItem Attribute Value", azureTable: "item_attribute_value", priority: 2, label: "Item Attribute Values" },
  { frappeTable: "tabPrint Format", azureTable: "print_format", priority: 2, label: "Print Formats" },
  { frappeTable: "tabLetter Head", azureTable: "letter_head", priority: 2, label: "Letter Heads" },
  { frappeTable: "tabEmail Template", azureTable: "email_template", priority: 2, label: "Email Templates" },
  { frappeTable: "tabSalutation", azureTable: "salutation", priority: 2, label: "Salutations" },
  { frappeTable: "tabItem Group", azureTable: "item_group", priority: 2, label: "Item Groups" },
  // Priority 3 — Workspace/navigation
  { frappeTable: "tabWorkspace", azureTable: "workspace", priority: 3, label: "Workspaces" },
  { frappeTable: "tabWorkspace Link", azureTable: "workspace_link", priority: 3, label: "Workspace Links" },
  { frappeTable: "tabScheduled Job Type", azureTable: "scheduled_job_type", priority: 3, label: "Scheduled Job Types" },
];

// Frappe internal columns to skip
const SKIP_COLUMNS = new Set(["_user_tags", "_comments", "_assign", "_liked_by"]);

// Columns that are boolean in Azure but smallint in Frappe
const BOOLEAN_COLUMNS = new Set([
  "is_group", "disabled", "enabled", "desk_access", "two_factor_auth", "is_custom",
  "must_be_whole_number", "symbol_on_right", "add_total_row", "prepared_report",
  "add_translate_data", "custom_format", "raw_printing", "align_labels_right",
  "show_section_headings", "line_breaks", "absolute_value", "print_format_builder",
  "print_format_builder_beta", "is_default", "hide_custom", "public", "is_hidden",
  "onboard", "is_query_report", "hidden", "stopped", "create_log",
  "include_in_gross", "use_html", "add_to_transit", "is_standard",
]);

interface ColumnMeta {
  name: string;
  isNullable: boolean;
  dataType: string;
}

interface MigrationResult {
  table: string;
  label: string;
  frappeCount: number;
  azureBefore: number;
  attempted: number;
  inserted: number;
  skippedExisting: number;
  errors: number;
  columnsUsed: string[];
  errorDetails: string[];
}

/**
 * Convert a Frappe value to match Azure column type, handling:
 * - Frappe smallint 0/1 -> Azure boolean
 * - NULL values for NOT NULL Azure columns -> appropriate defaults
 * - Frappe string numbers -> proper numeric types
 * - timestamp without tz -> timestamp with tz
 */
function convertValue(val: any, colMeta: ColumnMeta): any {
  const isBool = BOOLEAN_COLUMNS.has(colMeta.name);

  // Handle boolean columns
  if (isBool) {
    if (val === null || val === undefined) return false;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") return val === "1" || val.toLowerCase() === "true";
    return false;
  }

  // Handle NULL values
  if (val === null || val === undefined) {
    if (colMeta.isNullable) return null;
    // NOT NULL column — provide default based on type
    if (colMeta.dataType.includes("character") || colMeta.dataType === "text") return "";
    if (colMeta.dataType.includes("integer") || colMeta.dataType.includes("int")) return 0;
    if (colMeta.dataType.includes("numeric") || colMeta.dataType.includes("decimal") || colMeta.dataType.includes("double") || colMeta.dataType.includes("real")) return 0;
    if (colMeta.dataType.includes("timestamp") || colMeta.dataType.includes("date")) return new Date();
    if (colMeta.dataType === "boolean") return false;
    return "";
  }

  // Handle type-specific conversions
  if (colMeta.dataType.includes("integer") || colMeta.dataType.includes("int")) {
    // Frappe stores idx as bigint string sometimes
    const num = typeof val === "string" ? parseInt(val, 10) : Number(val);
    if (isNaN(num)) return 0;
    return num;
  }

  if (colMeta.dataType.includes("numeric") || colMeta.dataType.includes("decimal") || colMeta.dataType.includes("double") || colMeta.dataType.includes("real") || colMeta.dataType === "float") {
    const num = typeof val === "string" ? parseFloat(val) : Number(val);
    if (isNaN(num)) return 0;
    return num;
  }

  if (colMeta.dataType.includes("timestamp") || colMeta.dataType.includes("date")) {
    if (val instanceof Date) return val;
    if (typeof val === "string") return new Date(val);
    return new Date();
  }

  // String types — just return as-is
  return val;
}

async function migrate() {
  const frappe = new PgClient(frappeConfig);
  const azure = new PgClient(azureConfig);

  await frappe.connect();
  await azure.connect();
  console.log("Connected to Frappe (source) and Azure (target) databases\n");
  console.log("=".repeat(80));

  const results: MigrationResult[] = [];

  // Sort by priority
  const sortedTables = [...TABLE_MAP].sort((a, b) => a.priority - b.priority);

  for (const table of sortedTables) {
    console.log(`\n--- Migrating: ${table.frappeTable} -> ${table.azureTable} (${table.label}) ---`);

    try {
      // Step 1: Get Frappe columns
      const frappeColsResult = await frappe.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table.frappeTable]
      );
      const frappeCols = frappeColsResult.rows
        .map((r: any) => r.column_name)
        .filter((c: string) => !SKIP_COLUMNS.has(c));

      // Step 2: Get Azure columns with metadata
      const azureColsResult = await azure.query(
        `SELECT column_name, is_nullable, data_type FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
        [table.azureTable]
      );
      const azureColMap = new Map<string, ColumnMeta>();
      for (const row of azureColsResult.rows) {
        azureColMap.set(row.column_name, {
          name: row.column_name,
          isNullable: row.is_nullable === "YES",
          dataType: row.data_type,
        });
      }

      // Step 3: Find intersection — columns that exist in BOTH databases
      const commonCols = frappeCols.filter((c: string) => azureColMap.has(c));

      if (commonCols.length === 0) {
        console.log(`  No common columns found. Skipping.`);
        results.push({
          table: table.azureTable, label: table.label,
          frappeCount: 0, azureBefore: 0, attempted: 0, inserted: 0,
          skippedExisting: 0, errors: 0, columnsUsed: [], errorDetails: [],
        });
        continue;
      }

      // Get column metadata for common columns
      const commonColMetas = commonCols.map((c: string) => azureColMap.get(c)!);

      console.log(`  Common columns (${commonCols.length}): ${commonCols.join(", ")}`);

      // Step 4: Count rows
      const frappeCountResult = await frappe.query(`SELECT count(*) as cnt FROM "${table.frappeTable}"`);
      const frappeCount = parseInt(frappeCountResult.rows[0].cnt);

      const azureBeforeResult = await azure.query(`SELECT count(*) as cnt FROM "${table.azureTable}"`);
      const azureBefore = parseInt(azureBeforeResult.rows[0].cnt);

      console.log(`  Frappe rows: ${frappeCount} | Azure rows before: ${azureBefore}`);

      // Step 5: Read data from Frappe
      const frappeData = await frappe.query(`SELECT "${commonCols.join('", "')}" FROM "${table.frappeTable}"`);
      console.log(`  Read ${frappeData.rows.length} rows from Frappe`);

      // Step 6: Insert into Azure row-by-row (parameterized for type safety)
      let inserted = 0;
      let skippedExisting = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      // Build parameterized INSERT SQL
      const colList = commonCols.map((c: string) => `"${c}"`).join(", ");
      const paramList = commonCols.map((_: string, i: number) => `$${i + 1}`).join(", ");
      const insertSQL = `INSERT INTO "${table.azureTable}" (${colList}) VALUES (${paramList}) ON CONFLICT (name) DO NOTHING`;

      for (let i = 0; i < frappeData.rows.length; i++) {
        const row = frappeData.rows[i];

        // Convert values to match Azure types
        const values = commonCols.map((col: string, idx: number) => {
          return convertValue(row[col], commonColMetas[idx]);
        });

        try {
          const result = await azure.query(insertSQL, values);
          if (result.rowCount && result.rowCount > 0) {
            inserted++;
          } else {
            skippedExisting++;
          }
        } catch (err: any) {
          // Unique constraint violations on non-PK columns mean the data already exists under a different key
          if (err.code === "23505") {
            skippedExisting++;
          } else {
            errors++;
            const detail = `Row "${row.name}" (code=${err.code}): ${err.message.substring(0, 120)}`;
            if (errorDetails.length < 5) {
              errorDetails.push(detail);
              console.log(`  Error: ${detail}`);
            }
          }
        }

        // Progress indicator
        if ((i + 1) % 100 === 0 || i + 1 === frappeData.rows.length) {
          process.stdout.write(`  Progress: ${i + 1}/${frappeData.rows.length} (inserted=${inserted}, skipped=${skippedExisting}, errors=${errors})\n`);
        }
      }

      const azureAfterResult = await azure.query(`SELECT count(*) as cnt FROM "${table.azureTable}"`);
      const azureAfter = parseInt(azureAfterResult.rows[0].cnt);

      console.log(`  Result: Attempted=${frappeData.rows.length}, Inserted=${inserted}, Skipped(exists)=${skippedExisting}, Errors=${errors}`);
      console.log(`  Azure rows after: ${azureAfter} (was ${azureBefore}, delta=+${azureAfter - azureBefore})`);

      results.push({
        table: table.azureTable, label: table.label,
        frappeCount, azureBefore, attempted: frappeData.rows.length,
        inserted, skippedExisting, errors, columnsUsed: commonCols, errorDetails,
      });

    } catch (err: any) {
      console.log(`  ERROR: ${err.message.substring(0, 150)}`);
      results.push({
        table: table.azureTable, label: table.label,
        frappeCount: -1, azureBefore: -1, attempted: 0, inserted: 0,
        skippedExisting: 0, errors: 1, columnsUsed: [], errorDetails: [err.message.substring(0, 200)],
      });
    }
  }

  // Print summary
  console.log("\n\n" + "=".repeat(80));
  console.log("MIGRATION SUMMARY");
  console.log("=".repeat(80));
  console.log(
    "Table".padEnd(25) +
    "Label".padEnd(25) +
    "Frappe".padStart(8) +
    "Azure(B)".padStart(8) +
    "Added".padStart(8) +
    "Skipped".padStart(8) +
    "Errors".padStart(8)
  );
  console.log("-".repeat(90));

  let totalFrappe = 0, totalInserted = 0, totalSkipped = 0, totalErrors = 0;

  for (const r of results) {
    console.log(
      r.table.padEnd(25) +
      r.label.padEnd(25) +
      String(r.frappeCount).padStart(8) +
      String(r.azureBefore).padStart(8) +
      String(r.inserted).padStart(8) +
      String(r.skippedExisting).padStart(8) +
      String(r.errors).padStart(8)
    );
    if (r.frappeCount > 0) {
      totalFrappe += r.frappeCount;
      totalInserted += r.inserted;
      totalSkipped += r.skippedExisting;
      totalErrors += r.errors;
    }
  }

  console.log("-".repeat(90));
  console.log(
    "TOTAL".padEnd(50) +
    String(totalFrappe).padStart(8) +
    "".padStart(8) +
    String(totalInserted).padStart(8) +
    String(totalSkipped).padStart(8) +
    String(totalErrors).padStart(8)
  );

  // Print error details if any
  const allErrors = results.filter(r => r.errorDetails.length > 0);
  if (allErrors.length > 0) {
    console.log("\n--- Error Details ---");
    for (const r of allErrors) {
      console.log(`\n  ${r.table}:`);
      for (const d of r.errorDetails) {
        console.log(`    ${d}`);
      }
    }
  }

  // Cleanup
  await frappe.end();
  await azure.end();
  console.log("\nMigration complete. Connections closed.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
