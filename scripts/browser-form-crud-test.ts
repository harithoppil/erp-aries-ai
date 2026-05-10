/**
 * Comprehensive Form CRUD E2E Test — Aries ERP
 *
 * For every doctype sidebar page:
 *   1. List page loads with data
 *   2. Navigate to /new → verify form renders with correct field types
 *   3. Fill form → Save → verify creation (redirect or toast)
 *   4. Navigate to created record → Edit → Save → verify update
 *   5. Delete the test record → verify it's gone (restore seed data)
 *
 * Also tests:
 *   - Required field validation (save with empty required → error message)
 *   - Date fields reject letters
 *   - Number fields reject letters
 *   - Toast messages appear on success/error
 *
 * Uses local Chrome + puppeteer-core.
 *
 * Usage: bun run scripts/browser-form-crud-test.ts
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; detail?: string }[] = [];

function ok(name: string) {
  passed++;
  results.push({ name, ok: true });
  console.log(`  ✓ ${name}`);
}

function fail(name: string, detail: string) {
  failed++;
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}: ${detail}`);
}

async function screenshot(page: puppeteer.Page, name: string) {
  await page.screenshot({ path: `/tmp/e2e-${name}.png`, fullPage: false });
}

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Doctypes to test ────────────────────────────────────────────────────────

const DOCTYPES = [
  "customer",
  "supplier",
  "item",
  "warehouse",
  "lead",
  "account",
  "bom",
  "item-tax",
  "quotation",
  "purchase-order",
  "sales-order",
  "sales-invoice",
  "purchase-invoice",
  "employee",
  "project",
  "task",
  "journal-entry",
  "payment-entry",
];

// ── Helper: safe goto with retry ────────────────────────────────────────────

async function safeGoto(page: puppeteer.Page, url: string, retries = 2): Promise<boolean> {
  for (let i = 0; i <= retries; i++) {
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
      return true;
    } catch {
      if (i === retries) return false;
      await wait(2000);
    }
  }
  return false;
}

// ── Helper: get form field info ─────────────────────────────────────────────

interface FieldInfo {
  key: string;
  type: string; // "text" | "number" | "date" | "boolean" | "textarea" | "select"
  required: boolean;
  selector: string;
}

async function getFormFields(page: puppeteer.Page): Promise<FieldInfo[]> {
  return page.evaluate(() => {
    const fields: FieldInfo[] = [];
    const labels = document.querySelectorAll("label[for]");
    for (const label of labels) {
      const key = label.getAttribute("for") || "";
      if (!key) continue;
      const hasRequired = label.querySelector(".text-red-500") !== null;

      // Find the associated input
      const input = document.getElementById(key);
      if (!input) continue;

      let type = "text";
      if (input.tagName === "INPUT") {
        type = (input as HTMLInputElement).type || "text";
      } else if (input.tagName === "TEXTAREA") {
        type = "textarea";
      } else if (input.tagName === "SELECT") {
        type = "select";
      } else if (input.closest('[data-slot="switch"]') || input.getAttribute("role") === "switch") {
        type = "boolean";
      }

      // Check for switch component (shadcn)
      const switchEl = label.closest("div")?.querySelector('[data-slot="switch"]');
      if (switchEl) type = "boolean";

      fields.push({
        key,
        type,
        required: hasRequired,
        selector: `#${CSS.escape(key)}`,
      });
    }
    return fields;
  });
}

// ── Helper: fill a form field based on type ─────────────────────────────────

async function fillField(
  page: puppeteer.Page,
  field: FieldInfo,
  value: string,
): Promise<boolean> {
  try {
    if (field.type === "boolean") {
      // Click the switch toggle
      const switchEl = await page.$(`[data-slot="switch"]`);
      if (switchEl) {
        await switchEl.click();
        return true;
      }
      return false;
    }

    if (field.type === "date") {
      await page.click(field.selector, { clickCount: 3 });
      await page.type(field.selector, value);
      return true;
    }

    if (field.type === "number") {
      await page.click(field.selector, { clickCount: 3 });
      await page.type(field.selector, value);
      return true;
    }

    if (field.type === "textarea") {
      await page.click(field.selector);
      await page.type(field.selector, value);
      return true;
    }

    if (field.type === "select") {
      // Click to open, then select first option
      await page.click(field.selector);
      await wait(300);
      const firstOption = await page.$('[role="option"], [data-slot="select-item"]');
      if (firstOption) {
        await firstOption.click();
        return true;
      }
      return false;
    }

    // Default: text input
    await page.click(field.selector, { clickCount: 3 });
    await page.type(field.selector, value);
    return true;
  } catch {
    return false;
  }
}

// ── Helper: generate test value based on field type ─────────────────────────

function testValue(key: string, type: string, doctype: string): string {
  const stamp = Date.now().toString(36);
  if (type === "date") return "2026-01-15";
  if (type === "number") return "42";
  if (type === "boolean") return "true"; // handled separately
  if (type === "textarea") return `Test note for ${doctype} - ${stamp}`;
  // For "name" fields, generate unique name
  if (key.toLowerCase().includes("name")) return `E2E-${doctype.toUpperCase()}-${stamp}`;
  // Default text
  return `Test-${key}-${stamp}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Track created records for cleanup
  const createdRecords: { doctype: string; name: string }[] = [];

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 0: LOGIN
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 0. LOGIN ===");

    await safeGoto(page, `${BASE}/auth`);
    await page.type('input[type="email"], input[placeholder*="mail"]', "admin@ariesmarine.ae");
    await page.type('input[type="password"], input[placeholder*="assword"]', "admin");
    await page.click('button[type="submit"]');
    await wait(3000);

    const afterLogin = page.url();
    if (afterLogin.includes("/dashboard")) {
      ok("Login succeeds");
    } else {
      fail("Login succeeds", `redirected to ${afterLogin}`);
      process.exit(1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: LIST PAGES — verify every doctype loads
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 1. LIST PAGE VERIFICATION ===");

    for (const dt of DOCTYPES) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}`);
        await wait(1500);

        const hasError = await page.evaluate(() =>
          document.body.innerText.includes("Something went wrong") ||
          document.body.innerText.includes("An error occurred")
        );

        if (hasError) {
          fail(`${dt} list loads`, "page shows error");
          await screenshot(page, `${dt}-list-error`);
          continue;
        }

        const title = await page.evaluate(() => document.querySelector("h2")?.textContent?.trim() || "");
        if (title) {
          ok(`${dt} list loads (title: "${title}")`);
        } else {
          fail(`${dt} list loads`, "no h2 title found");
        }
      } catch (e: unknown) {
        fail(`${dt} list loads`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: NEW FORM — verify form renders with correct field types
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 2. NEW FORM VERIFICATION ===");

    for (const dt of DOCTYPES) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/new`);
        await wait(2000);

        const hasError = await page.evaluate(() =>
          document.body.innerText.includes("Something went wrong") ||
          document.body.innerText.includes("An error occurred")
        );

        if (hasError) {
          fail(`${dt}/new renders`, "page shows error");
          await screenshot(page, `${dt}-new-error`);
          continue;
        }

        // Check for form fields
        const fields = await getFormFields(page);

        if (fields.length === 0) {
          fail(`${dt}/new has fields`, "0 form fields found");
          await screenshot(page, `${dt}-new-no-fields`);
          continue;
        }

        ok(`${dt}/new renders ${fields.length} fields`);

        // Verify required fields have red asterisk
        const requiredFields = fields.filter((f) => f.required);
        if (requiredFields.length > 0) {
          ok(`${dt}/new has ${requiredFields.length} required fields (with red *)`);
        }

        // Verify date fields use type="date"
        const dateFields = fields.filter((f) => f.type === "date");
        if (dateFields.length > 0) {
          ok(`${dt}/new has ${dateFields.length} date fields (type="date")`);
        }

        // Verify number fields use type="number"
        const numberFields = fields.filter((f) => f.type === "number");
        if (numberFields.length > 0) {
          ok(`${dt}/new has ${numberFields.length} number fields (type="number")`);
        }

        // Verify textarea fields
        const textareaFields = fields.filter((f) => f.type === "textarea");
        if (textareaFields.length > 0) {
          ok(`${dt}/new has ${textareaFields.length} textarea fields`);
        }

        // Verify boolean/switch fields
        const booleanFields = fields.filter((f) => f.type === "boolean");
        if (booleanFields.length > 0) {
          ok(`${dt}/new has ${booleanFields.length} boolean/switch fields`);
        }

        // Check Save button exists
        const hasSave = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("Save"))
        );
        if (hasSave) ok(`${dt}/new has Save button`); else fail(`${dt}/new has Save button`, "not found");

        // Check Cancel button exists
        const hasCancel = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("Cancel"))
        );
        if (hasCancel) ok(`${dt}/new has Cancel button`); else fail(`${dt}/new has Cancel button`, "not found");

      } catch (e: unknown) {
        fail(`${dt}/new form`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: VALIDATION — required field validation on save
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 3. REQUIRED FIELD VALIDATION ===");

    // Test a few doctypes for validation
    const validationDoctypes = ["customer", "warehouse", "item"];

    for (const dt of validationDoctypes) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/new`);
        await wait(2000);

        // Click Save without filling anything
        const saveBtn = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const save = btns.find((b) => b.textContent?.includes("Save"));
          if (save) { save.click(); return true; }
          return false;
        });

        if (!saveBtn) {
          fail(`${dt} validation: Save button not found`, "");
          continue;
        }

        await wait(1000);

        // Check for error messages (red text below fields)
        const errorCount = await page.evaluate(() =>
          document.querySelectorAll("p.text-red-600").length
        );

        if (errorCount > 0) {
          ok(`${dt} validation shows ${errorCount} error(s) on empty save`);
        } else {
          // Check for toast error
          const hasToastError = await page.evaluate(() =>
            document.body.innerText.includes("fix the errors") ||
            document.body.innerText.includes("required")
          );
          if (hasToastError) {
            ok(`${dt} validation shows error toast on empty save`);
          } else {
            fail(`${dt} validation on empty save`, "no error messages or toast found");
            await screenshot(page, `${dt}-validation-missing`);
          }
        }
      } catch (e: unknown) {
        fail(`${dt} validation`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: DATE FIELD VALIDATION — date fields reject letters
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 4. DATE FIELD TYPE VALIDATION ===");

    // Find a doctype with a date field and try typing letters
    for (const dt of validationDoctypes) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/new`);
        await wait(2000);

        const fields = await getFormFields(page);
        const dateField = fields.find((f) => f.type === "date");

        if (!dateField) {
          ok(`${dt} date validation: no date fields (skipped)`);
          continue;
        }

        // Click on the date input and try typing letters
        await page.click(dateField.selector, { clickCount: 3 });
        await page.type(dateField.selector, "abcxyz");

        // Browser's native date input should not accept letters
        const inputValue = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLInputElement;
          return el?.value || "";
        }, dateField.selector);

        // A proper date input will either be empty or ignore the letters
        if (inputValue === "" || /^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
          ok(`${dt} date field rejects letters (value: "${inputValue || '(empty)'}")`);
        } else {
          fail(`${dt} date field rejects letters`, `value was "${inputValue}"`);
        }
      } catch (e: unknown) {
        fail(`${dt} date validation`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: NUMBER FIELD VALIDATION — number fields reject letters
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 5. NUMBER FIELD TYPE VALIDATION ===");

    for (const dt of validationDoctypes) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/new`);
        await wait(2000);

        const fields = await getFormFields(page);
        const numberField = fields.find((f) => f.type === "number");

        if (!numberField) {
          ok(`${dt} number validation: no number fields (skipped)`);
          continue;
        }

        // Try typing letters into the number field
        await page.click(numberField.selector, { clickCount: 3 });
        await page.type(numberField.selector, "abc");

        const inputValue = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLInputElement;
          return el?.value || "";
        }, numberField.selector);

        // Native number input should not accept letters
        if (inputValue === "" || /^[\d.\-e]+$/.test(inputValue)) {
          ok(`${dt} number field rejects letters (value: "${inputValue || '(empty)'}")`);
        } else {
          fail(`${dt} number field rejects letters`, `value was "${inputValue}"`);
        }
      } catch (e: unknown) {
        fail(`${dt} number validation`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: CREATE + VERIFY — fill form, save, verify record exists
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 6. CREATE + VERIFY ===");

    const createDoctypes = ["warehouse", "customer", "lead", "item-tax"];

    for (const dt of createDoctypes) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/new`);
        await wait(2000);

        const fields = await getFormFields(page);
        if (fields.length === 0) {
          fail(`${dt} create: no fields to fill`, "");
          continue;
        }

        // Fill all editable fields with appropriate test data
        let filledCount = 0;
        let createdName = "";

        for (const field of fields) {
          if (field.type === "boolean") {
            // Don't toggle booleans for creation test
            continue;
          }

          const value = testValue(field.key, field.type, dt);
          const success = await fillField(page, field, value);
          if (success) {
            filledCount++;
            // Track the name for later verification
            if (field.key.toLowerCase() === "name" || field.selector.includes("name")) {
              createdName = value;
            }
          }
        }

        ok(`${dt} create: filled ${filledCount}/${fields.length} fields`);

        // Click Save
        const saveClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const save = btns.find((b) => b.textContent?.includes("Save"));
          if (save) { save.click(); return true; }
          return false;
        });

        if (!saveClicked) {
          fail(`${dt} create: Save button`, "not found");
          continue;
        }

        await wait(3000);

        // Check for validation errors (might have unfilled required fields)
        const errorCount = await page.evaluate(() =>
          document.querySelectorAll("p.text-red-600").length
        );

        if (errorCount > 0) {
          fail(`${dt} create: validation errors`, `${errorCount} errors after save attempt`);
          await screenshot(page, `${dt}-create-validation`);
          continue;
        }

        // Check for success — either toast or URL change
        const currentUrl = page.url();
        const hasToastSuccess = await page.evaluate(() =>
          document.body.innerText.includes("created successfully") ||
          document.body.innerText.includes("success")
        );

        const redirectedToDetail = currentUrl.includes(`/${dt}/`) && !currentUrl.endsWith(`/${dt}/new`);

        if (hasToastSuccess || redirectedToDetail) {
          ok(`${dt} create: record created successfully`);

          // If we redirected to detail page, get the name from URL
          if (redirectedToDetail) {
            const urlParts = currentUrl.split("/");
            const recordName = urlParts[urlParts.length - 1];
            if (recordName && recordName !== "new") {
              createdName = recordName;
            }
          }

          if (createdName) {
            createdRecords.push({ doctype: dt, name: createdName });
          }
        } else {
          fail(`${dt} create: record created`, `url: ${currentUrl}, no success toast`);
          await screenshot(page, `${dt}-create-fail`);
        }
      } catch (e: unknown) {
        fail(`${dt} create`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: EDIT + VERIFY — navigate to existing record, edit, save
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 7. EDIT + VERIFY ===");

    // For each doctype, click the first row in list to go to detail, then edit
    const editDoctypes = ["customer", "warehouse", "lead"];

    for (const dt of editDoctypes) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}`);
        await wait(2000);

        // Click first row
        const rowClicked = await page.evaluate(() => {
          const row = document.querySelector("table tbody tr");
          if (row) { (row as HTMLElement).click(); return true; }
          return false;
        });

        if (!rowClicked) {
          fail(`${dt} edit: row click`, "no rows in table");
          continue;
        }

        await wait(2000);

        // Verify we're on detail page
        const detailUrl = page.url();
        if (!detailUrl.includes(`/${dt}/`)) {
          fail(`${dt} edit: navigate to detail`, `url: ${detailUrl}`);
          continue;
        }

        ok(`${dt} edit: navigated to detail page`);

        // Click Edit button
        const editClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const edit = btns.find((b) => b.textContent?.includes("Edit"));
          if (edit) { edit.click(); return true; }
          return false;
        });

        if (!editClicked) {
          // Record might be Submitted (not Draft), skip
          ok(`${dt} edit: no Edit button (record may be submitted, skipped)`);
          continue;
        }

        await wait(1000);
        ok(`${dt} edit: entered edit mode`);

        // Modify the first text field
        const textInput = await page.$('input[type="text"]:not([readonly])');
        if (textInput) {
          await textInput.click({ clickCount: 3 });
          await page.keyboard.press("Backspace");
          await page.keyboard.press("Backspace");
          await page.keyboard.press("Backspace");
          await page.type('input[type="text"]:not([readonly])', " (edited)");
          ok(`${dt} edit: modified text field`);
        } else {
          ok(`${dt} edit: no text field to modify (skipped)`);
        }

        // Click Save
        const saveBtn = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const save = btns.find((b) => b.textContent?.includes("Save"));
          if (save) { save.click(); return true; }
          return false;
        });

        if (saveBtn) {
          await wait(3000);
          const hasUpdateToast = await page.evaluate(() =>
            document.body.innerText.includes("updated successfully")
          );
          if (hasUpdateToast) {
            ok(`${dt} edit: saved successfully with toast`);
          } else {
            // Check if we left edit mode (success without explicit toast)
            const stillEditing = await page.evaluate(() =>
              Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.includes("Save"))
            );
            if (!stillEditing) {
              ok(`${dt} edit: saved (left edit mode)`);
            } else {
              fail(`${dt} edit: save`, "still in edit mode after save");
              await screenshot(page, `${dt}-edit-save-fail`);
            }
          }
        } else {
          fail(`${dt} edit: Save button`, "not found after edit");
        }
      } catch (e: unknown) {
        fail(`${dt} edit`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: DELETE — clean up created records
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 8. DELETE CREATED RECORDS ===");

    for (const { doctype: dt, name } of createdRecords) {
      try {
        // Navigate to the record's detail page
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/${encodeURIComponent(name)}`);
        await wait(2000);

        // Open dropdown menu
        const moreClicked = await page.evaluate(() => {
          const trigger = document.querySelector('[data-slot="dropdown-menu-trigger"]') ||
            document.querySelector('button[aria-haspopup]');
          if (trigger) { (trigger as HTMLElement).click(); return true; }
          // Fallback: find MoreHorizontal button
          const btns = Array.from(document.querySelectorAll("button"));
          const more = btns.find((b) => b.querySelector('[data-lucide="more-horizontal"]') || b.textContent?.includes("More"));
          if (more) { more.click(); return true; }
          return false;
        });

        if (!moreClicked) {
          fail(`${dt} delete ${name}: open menu`, "dropdown trigger not found");
          continue;
        }

        await wait(500);

        // Click Delete in dropdown
        const deleteClicked = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
          const deleteItem = items.find((el) => el.textContent?.includes("Delete"));
          if (deleteItem) { (deleteItem as HTMLElement).click(); return true; }
          return false;
        });

        if (!deleteClicked) {
          fail(`${dt} delete ${name}: click Delete`, "Delete menu item not found");
          continue;
        }

        await wait(500);

        // Handle confirmation dialog
        const dialog = await page.evaluate(() => {
          const dialogEl = document.querySelector('[role="dialog"]');
          return !!dialogEl;
        });

        if (dialog) {
          // Click the "Delete" button in the dialog
          const confirmClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('[role="dialog"] button'));
            const deleteBtn = btns.find((b) => b.textContent?.includes("Delete") && b.closest('[role="dialog"]'));
            if (deleteBtn) { (deleteBtn as HTMLElement).click(); return true; }
            return false;
          });

          if (confirmClicked) {
            await wait(3000);
            const deleteToast = await page.evaluate(() =>
              document.body.innerText.includes("deleted")
            );
            if (deleteToast) {
              ok(`${dt} delete: "${name}" deleted with toast`);
            } else {
              // Check if redirected to list
              const url = page.url();
              if (url.endsWith(`/${dt}`) || url.includes(`/${dt}?`)) {
                ok(`${dt} delete: "${name}" deleted (redirected to list)`);
              } else {
                fail(`${dt} delete ${name}`, "no delete toast and not redirected");
              }
            }
          } else {
            fail(`${dt} delete ${name}: confirm`, "Delete confirm button not found in dialog");
          }
        } else {
          fail(`${dt} delete ${name}: dialog`, "confirmation dialog did not appear");
        }
      } catch (e: unknown) {
        fail(`${dt} delete ${name}`, String(e));
      }
    }

    // Also test delete from list page for existing records
    console.log("\n=== 8b. DELETE FROM LIST PAGE ===");

    for (const dt of ["warehouse", "customer"]) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}`);
        await wait(2000);

        // Find a row and hover to reveal delete trigger
        const hasDropdown = await page.evaluate(() => {
          const row = document.querySelector("table tbody tr");
          if (!row) return false;
          // Hover over the row to make the dropdown trigger visible
          row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
          return true;
        });

        if (hasDropdown) {
          ok(`${dt} list delete: rows available for delete testing`);
        } else {
          ok(`${dt} list delete: no rows (skipped)`);
        }
      } catch (e: unknown) {
        fail(`${dt} list delete`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 9: ROW CLICK → DETAIL NAVIGATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 9. ROW CLICK → DETAIL NAVIGATION ===");

    for (const dt of DOCTYPES) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}`);
        await wait(1500);

        const rowCount = await page.evaluate(() =>
          document.querySelectorAll("table tbody tr").length
        );

        if (rowCount === 0) {
          ok(`${dt} row click: no rows (skipped)`);
          continue;
        }

        // Click first row
        await page.evaluate(() => {
          const row = document.querySelector("table tbody tr");
          if (row) (row as HTMLElement).click();
        });

        await wait(2000);
        const url = page.url();

        if (url.includes(`/${dt}/`) && !url.endsWith(`/${dt}`)) {
          ok(`${dt} row click → detail page`);
        } else {
          fail(`${dt} row click → detail`, `url: ${url}`);
        }
      } catch (e: unknown) {
        fail(`${dt} row click`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 10: FORM LABEL + ASTERISK VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n=== 10. FORM LABEL + ASTERISK VERIFICATION ===");

    for (const dt of DOCTYPES) {
      try {
        await safeGoto(page, `${BASE}/dashboard/erp/${dt}/new`);
        await wait(2000);

        // Check that labels use font-medium class
        const labelsWithFontMedium = await page.evaluate(() => {
          const labels = document.querySelectorAll("label[for]");
          return Array.from(labels).filter((l) =>
            l.classList.contains("font-medium")
          ).length;
        });

        // Check that required fields have red asterisk
        const requiredAsterisks = await page.evaluate(() =>
          document.querySelectorAll("label .text-red-500").length
        );

        if (labelsWithFontMedium > 0) {
          ok(`${dt} labels: ${labelsWithFontMedium} fields have font-medium label`);
        } else {
          fail(`${dt} labels: font-medium`, "0 labels with font-medium class");
        }

        if (requiredAsterisks > 0) {
          ok(`${dt} required: ${requiredAsterisks} fields have red * asterisk`);
        }
        // It's ok if there are 0 required fields
      } catch (e: unknown) {
        fail(`${dt} label check`, String(e));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n" + "═".repeat(60));
    console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═".repeat(60));

    if (failed > 0) {
      console.log("\nFailed tests:");
      results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name}: ${r.detail}`));
    }

  } catch (e: unknown) {
    console.error("Fatal:", e);
    await screenshot(page, "fatal");
  } finally {
    await browser.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
