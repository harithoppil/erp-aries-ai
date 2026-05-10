/**
 * Browser click test — verifies row clicks, sidebar, and detail pages work.
 * Uses local Chrome + puppeteer-core.
 *
 * Usage: bun run scripts/browser-click-test.ts
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";

const BASE = "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: TestResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}`);
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("webpack-hmr")) {
      errors.push(msg.text().slice(0, 200));
    }
  });

  // ── 1. Login ────────────────────────────────────────────────────────────────
  console.log("\n=== 1. LOGIN ===");
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Fill login form
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  const passInput = await page.$('input[type="password"]');

  if (emailInput && passInput) {
    pass("Login form renders", "Email + password inputs found");
    await emailInput.type("admin@ariesmarine.com");
    await passInput.type("admin123");

    // Click Sign In
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});

    const afterLoginUrl = page.url();
    if (afterLoginUrl.includes("/dashboard")) {
      pass("Login succeeds", `Redirected to ${afterLoginUrl}`);
    } else {
      fail("Login succeeds", `URL after login: ${afterLoginUrl}`);
    }
  } else {
    fail("Login form renders", "Could not find email/password inputs");
  }

  await page.screenshot({ path: "/tmp/test-01-login.png" });

  // ── 2. Dashboard ────────────────────────────────────────────────────────────
  console.log("\n=== 2. DASHBOARD ===");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));

  const dashboardLoading = await page.evaluate(() =>
    document.body.innerText.includes("Loading Aries")
  );
  if (dashboardLoading) {
    fail("Dashboard renders", "Stuck on 'Loading Aries...'");
  } else {
    const kpiCards = await page.$$eval("a[href*='/dashboard/erp/']", (els) => els.length);
    pass("Dashboard renders", `${kpiCards} KPI/module cards visible`);
  }
  await page.screenshot({ path: "/tmp/test-02-dashboard.png" });

  // ── 3. Customer List ────────────────────────────────────────────────────────
  console.log("\n=== 3. CUSTOMER LIST ===");
  await page.goto(`${BASE}/dashboard/erp/customer`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("table tbody tr", { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  const customerRows = await page.$$eval("table tbody tr", (rows) => rows.length);
  if (customerRows > 0) {
    pass("Customer list has rows", `${customerRows} rows`);
  } else {
    fail("Customer list has rows", "0 rows found");
  }

  // Check display label
  const heading = await page.$eval("h2", (el) => el.innerText.trim()).catch(() => "");
  if (heading === "Customer") {
    pass("Display label is Title Case", `"${heading}"`);
  } else {
    fail("Display label is Title Case", `Got "${heading}" instead of "Customer"`);
  }
  await page.screenshot({ path: "/tmp/test-03-customer-list.png" });

  // ── 4. Row Click → Detail Page ──────────────────────────────────────────────
  console.log("\n=== 4. ROW CLICK → DETAIL ===");
  if (customerRows > 0) {
    const beforeUrl = page.url();
    // Click the first table row
    await page.click("table tbody tr", { delay: 50 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));

    const afterUrl = page.url();
    if (afterUrl !== beforeUrl && afterUrl.includes("/TEST-CUST")) {
      pass("Row click navigates to detail", afterUrl);
    } else {
      fail("Row click navigates to detail", `URL unchanged: ${afterUrl}`);
    }
  }
  await page.screenshot({ path: "/tmp/test-04-detail.png" });

  // ── 5. Direct Detail Page Navigation ────────────────────────────────────────
  console.log("\n=== 5. DIRECT DETAIL PAGE ===");
  await page.goto(`${BASE}/dashboard/erp/customer/TEST-CUST-001`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await new Promise((r) => setTimeout(r, 3000));

  const detailError = await page.evaluate(() =>
    document.body.innerText.includes("Failed to load")
  );
  if (detailError) {
    fail("Detail page loads record", '"Failed to load" shown');
  } else {
    const fields = await page.$$eval("input, select, textarea", (els) => els.length);
    const detailH1 = await page.$eval("h1", (el) => el.innerText.trim()).catch(() => "");
    pass("Detail page loads record", `${fields} form fields, heading: "${detailH1}"`);
  }
  await page.screenshot({ path: "/tmp/test-05-direct-detail.png" });

  // ── 6. More List Pages ──────────────────────────────────────────────────────
  console.log("\n=== 6. LIST PAGE SWEEP ===");
  const listPages = [
    { doctype: "supplier", label: "Supplier" },
    { doctype: "item", label: "Item" },
    { doctype: "sales-order", label: "Sales Order" },
    { doctype: "employee", label: "Employee" },
    { doctype: "bom", label: "BOM" },
    { doctype: "lead", label: "Lead" },
    { doctype: "account", label: "Account" },
    { doctype: "warehouse", label: "Warehouse" },
  ];

  for (const { doctype, label } of listPages) {
    await page.goto(`${BASE}/dashboard/erp/${doctype}`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForSelector("table tbody tr", { timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    const rows = await page.$$eval("table tbody tr", (els) => els.length);
    const headingText = await page.$eval("h2", (el) => el.innerText.trim()).catch(() => "");

    if (rows > 0 && headingText === label) {
      pass(`${label} list`, `${rows} rows, heading "${headingText}"`);
    } else {
      fail(`${label} list`, `rows=${rows} heading="${headingText}" (expected "${label}")`);
    }
  }

  // ── 7. Sidebar Accordion ────────────────────────────────────────────────────
  console.log("\n=== 7. SIDEBAR ACCORDION ===");
  await page.goto(`${BASE}/dashboard/erp/customer`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Find and click the "Stock" module header
  const stockClicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("aside *")) as HTMLElement[];
    const stockItem = items.find((i) => i.innerText.trim() === "Stock" && i.offsetWidth > 10);
    if (stockItem) {
      stockItem.click();
      return true;
    }
    return false;
  });

  if (stockClicked) {
    await new Promise((r) => setTimeout(r, 1000));
    // Check if sub-items are now visible
    const itemLinkVisible = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("aside a")) as HTMLAnchorElement[];
      return links.some(
        (l) => l.href.includes("/dashboard/erp/item") && l.offsetWidth > 10
      );
    });
    if (itemLinkVisible) {
      pass("Sidebar accordion expands", "Item sub-link visible after clicking Stock");
    } else {
      fail("Sidebar accordion expands", "Item sub-link not visible after clicking Stock");
    }
  } else {
    fail("Sidebar accordion expands", "Could not find Stock module header");
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    results
      .filter((r) => !r.pass)
      .forEach((r) => console.log(`  ✗ ${r.name}: ${r.detail}`));
  }
  if (errors.length > 0) {
    console.log(`\nBrowser errors (${errors.length}):`);
    errors.slice(0, 5).forEach((e) => console.log(`  ${e}`));
  }

  await browser.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
