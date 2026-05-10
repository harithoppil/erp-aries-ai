/**
 * End-to-end test suite for the Aries ERP UI.
 *
 * Phases:
 *   0. Boot a Next.js dev server (or reuse one on BASE_URL).
 *   1. Login + auth verification.
 *   2. Desktop layout — sidebar, header, main content present.
 *   3. Mobile layout — top bar + bottom nav + reflowed content.
 *   4. Click test — every sidebar entry loads without console errors.
 *   5. Form CRUD — create + delete one record per master doctype.
 *   6. Print PDF — open a sales invoice, hit /api/erp-pdf/...
 *   7. AI chat — send a prompt, await response, screenshot before/after.
 *
 * Browser: puppeteer-extra + StealthPlugin + @sparticuz/chromium-min.
 *   - Local: CHROME_EXECUTABLE_PATH=/path/to/chrome
 *   - Sandbox/CI: pulls chromium from sparticuz GitHub release.
 *
 * Usage:
 *   bun run scripts/e2e/run-suite.ts
 *   PHASES=login,desktop bun run scripts/e2e/run-suite.ts
 *   BASE_URL=http://localhost:3000 bun run scripts/e2e/run-suite.ts
 */

import puppeteer from 'puppeteer-extra';
import type { Browser, Page, ElementHandle } from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium-min';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.E2E_EMAIL || 'admin@ariesmarine.com';
const ADMIN_PASSWORD = process.env.E2E_PASSWORD || 'admin123';
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR || 'test-output/e2e';
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

const PHASES = (process.env.PHASES || 'login,desktop,mobile,click,form,print,ai')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

interface TestResult {
  phase: string;
  name: string;
  ok: boolean;
  detail?: string;
  ms?: number;
}

const results: TestResult[] = [];
const consoleErrors: string[] = [];

function pass(phase: string, name: string, detail = '', ms?: number) {
  results.push({ phase, name, ok: true, detail, ms });
  console.log(`  ✓ [${phase}] ${name}${detail ? ` — ${detail}` : ''}${ms != null ? ` (${ms}ms)` : ''}`);
}

function fail(phase: string, name: string, detail: string, ms?: number) {
  results.push({ phase, name, ok: false, detail, ms });
  console.log(`  ✗ [${phase}] ${name} — ${detail}${ms != null ? ` (${ms}ms)` : ''}`);
}

async function snapshot(page: Page, label: string): Promise<void> {
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = join(SCREENSHOT_DIR, `${Date.now()}-${label}.png`);
  const buf = await page.screenshot({ fullPage: true });
  await writeFile(path, buf);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Click the first <button> (or other tag) whose innerText (trimmed) equals or
 * contains `text`. Walks the DOM in document order and stops at the first
 * visible match, avoiding the puppeteer ::-p-text quirks.
 */
async function clickByText(page: Page, text: string, tag = 'button'): Promise<boolean> {
  return await page.evaluate(
    (text, tag) => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(tag === '*' ? '*' : tag),
      );
      for (const n of nodes) {
        const own = (n.innerText ?? '').trim();
        if (!own.includes(text)) continue;
        if (tag === 'button' && n.querySelector('button')) continue;
        const rect = n.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        n.click();
        return true;
      }
      return false;
    },
    text,
    tag,
  );
}

/**
 * Fill a LinkFieldCombobox identified by its associated label text (the field's
 * formatted name, e.g. "Item Group"). Types `value` into the combobox search
 * input then accepts the "Use 'X' as-is" free-entry fallback so the test
 * doesn't depend on seed data for ItemGroup / UOM / etc.
 */
async function fillLinkField(page: Page, labelText: string, value: string): Promise<boolean> {
  // Find the popover trigger nearest to a label whose text matches `labelText`.
  const opened = await page.evaluate((labelText) => {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((l) => (l as HTMLLabelElement).innerText.trim().startsWith(labelText));
    if (!label) return false;
    const container = label.parentElement;
    if (!container) return false;
    // The combobox button sits next to the label
    const btn = container.querySelector<HTMLButtonElement>('button[aria-haspopup], button[role="combobox"]') ||
      container.querySelector<HTMLButtonElement>('button');
    if (!btn) return false;
    btn.click();
    return true;
  }, labelText);
  if (!opened) return false;
  await sleep(300);

  // Find the visible CommandInput and type the value
  const input = await page.$('[data-slot="command-input"], input[placeholder^="Search"], div[role="dialog"] input[type="text"]');
  if (!input) return false;
  await input.type(value, { delay: 20 });
  await sleep(400);

  // Click the "Use 'X' as-is" item, or the first matching command item
  const clicked = await page.evaluate((value) => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], [data-slot="command-item"]'));
    const free = items.find((i) => (i.innerText ?? '').includes(`Use "${value}"`));
    const target = free ?? items[0];
    if (!target) return false;
    target.click();
    return true;
  }, value);
  return clicked;
}

// ── Server boot helper ──────────────────────────────────────────────────────

async function startDevServer(): Promise<ChildProcess | null> {
  try {
    const res = await fetch(BASE_URL, { redirect: 'manual' });
    if (res.status < 500) {
      console.log(`Reusing server at ${BASE_URL} (status ${res.status})`);
      return null;
    }
  } catch {
    // not reachable — start one
  }
  console.log('Starting dev server (bun run dev)…');
  const child = spawn('bun', ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '3000' },
  });
  // Surface startup logs so failures aren't silent
  child.stdout?.on('data', (d) => process.stdout.write(`[dev] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[dev] ${d}`));

  // Poll BASE_URL until it returns any HTTP status; that's the real readiness
  // signal. Turbopack often prints "Ready" before /auth is actually compiled.
  const deadline = Date.now() + 180000; // 3 min
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/auth`, { redirect: 'manual' });
      if (res.status < 500) {
        console.log(`Dev server reachable (${res.status} on /auth)`);
        return child;
      }
    } catch {
      // not yet
    }
    await sleep(1500);
  }
  child.kill('SIGTERM');
  throw new Error('dev server did not become reachable within 3min');
}

// ── Browser launch ──────────────────────────────────────────────────────────

async function launch(): Promise<Browser> {
  puppeteer.use(StealthPlugin());

  const localPath = process.env.CHROME_EXECUTABLE_PATH;
  const isLocal = !!localPath;

  return puppeteer.launch({
    args: isLocal
      ? [
          ...puppeteer.defaultArgs(),
          '--hide-scrollbars',
          '--disable-web-security',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ]
      : [
          ...chromium.args,
          '--hide-scrollbars',
          '--disable-web-security',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
    defaultViewport: { width: 1440, height: 900 },
    executablePath: isLocal ? localPath : await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  });
}

// ── Phases ──────────────────────────────────────────────────────────────────

async function phaseLogin(page: Page): Promise<boolean> {
  console.log('\n=== Phase: login ===');
  const t0 = Date.now();
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  const email = await page.$('input[type="email"], input[name="email"]');
  const pw = await page.$('input[type="password"]');
  if (!email || !pw) {
    fail('login', 'login form renders', 'email or password input missing');
    return false;
  }
  pass('login', 'login form renders');

  await email.type(ADMIN_EMAIL, { delay: 30 });
  await pw.type(ADMIN_PASSWORD, { delay: 30 });
  await sleep(300); // let React state settle before submitting

  const submit = await page.$('button[type="submit"]');
  await submit?.click();

  // The auth page uses router.push('/dashboard') from a React effect after
  // the server action resolves — there's no full navigation, so poll the
  // URL until it changes (or timeout).
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (!page.url().includes('/auth')) break;
    await sleep(300);
  }

  const currentUrl = page.url();
  if (currentUrl.includes('/auth')) {
    await snapshot(page, 'login-failed');
    fail('login', 'login redirects to dashboard', `still on ${currentUrl}`);
    return false;
  }
  // Wait for dashboard to fully load before subsequent phases use page
  await page.waitForSelector('main, header', { timeout: 15000 }).catch(() => null);
  pass('login', 'login redirects to dashboard', currentUrl, Date.now() - t0);
  await snapshot(page, 'after-login');
  return true;
}

async function phaseDesktop(page: Page) {
  console.log('\n=== Phase: desktop layout ===');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });

  const sidebar = await page.$('aside, nav[aria-label*="idebar"], [class*="ide-bar"]');
  sidebar ? pass('desktop', 'sidebar visible') : fail('desktop', 'sidebar visible', 'not found');

  const header = await page.$('header');
  header ? pass('desktop', 'header visible') : fail('desktop', 'header visible', 'not found');

  const main = await page.$('main');
  main ? pass('desktop', 'main visible') : fail('desktop', 'main visible', 'not found');

  await snapshot(page, 'desktop-dashboard');
}

async function phaseMobile(page: Page) {
  console.log('\n=== Phase: mobile layout ===');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(800); // useResponsive needs a tick to settle after hydration

  const topBar = await page.$('header, [class*="MobileTopBar"]');
  topBar ? pass('mobile', 'top bar visible') : fail('mobile', 'top bar visible', 'not found');

  const bottomNav = await page.$('nav[class*="bottom"], [class*="MobileBottomNav"], .fixed.bottom-0');
  bottomNav
    ? pass('mobile', 'bottom nav visible')
    : fail('mobile', 'bottom nav visible', 'not found');

  await snapshot(page, 'mobile-dashboard');
  await page.setViewport({ width: 1440, height: 900 });
}

async function phaseClick(page: Page) {
  console.log('\n=== Phase: click test ===');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });

  // The sidebar uses div+Link not <aside>; just collect every dashboard link
  // from within the leftmost sidebar-shaped container.
  const links = await page.$$eval('a[href^="/dashboard"]', (as) =>
    Array.from(
      new Set(
        as
          .map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
          .filter((h) => h && h !== '/dashboard' && !h.includes('?')),
      ),
    ),
  );
  console.log(`  found ${links.length} sidebar links`);

  const sample = links.slice(0, 25);
  for (const href of sample) {
    const t0 = Date.now();
    try {
      const before = consoleErrors.length;
      const res = await page.goto(`${BASE_URL}${href}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      const newErrors = consoleErrors.length - before;
      if (res && res.ok()) {
        pass('click', href, newErrors > 0 ? `${newErrors} console err(s)` : '', Date.now() - t0);
      } else {
        fail('click', href, `status ${res?.status() ?? '?'}`, Date.now() - t0);
      }
    } catch (e) {
      fail('click', href, e instanceof Error ? e.message : 'goto failed', Date.now() - t0);
    }
  }
}

async function phaseForm(page: Page) {
  console.log('\n=== Phase: form CRUD ===');

  const stamp = Date.now().toString(36).toUpperCase();
  const cases: Array<{
    doctype: string;
    pk: string;
    payload: Record<string, string>;
    linkFields?: Array<{ label: string; value: string }>;
  }> = [
    {
      doctype: 'customer',
      pk: `E2E-CUST-${stamp}`,
      payload: { customer_name: `E2E Customer ${stamp}` },
    },
    {
      doctype: 'item',
      pk: `E2E-ITEM-${stamp}`,
      payload: { item_code: `E2E-ITEM-${stamp}`, item_name: `E2E Item ${stamp}` },
      linkFields: [
        { label: 'Item Group', value: 'All Item Groups' },
        { label: 'Stock Uom', value: 'Nos' },
      ],
    },
    {
      doctype: 'supplier',
      pk: `E2E-SUPP-${stamp}`,
      payload: { supplier_name: `E2E Supplier ${stamp}` },
    },
  ];

  for (const c of cases) {
    const t0 = Date.now();
    const newUrl = `${BASE_URL}/dashboard/erp/${c.doctype}/new`;
    await page.goto(newUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);
    await snapshot(page, `form-${c.doctype}-new`);

    // Fill payload fields by id
    for (const [key, value] of Object.entries(c.payload)) {
      const sel = `#${key}`;
      const el = await page.$(sel);
      if (!el) {
        fail('form', `${c.doctype} field #${key} present`, 'not found');
        continue;
      }
      await el.click({ clickCount: 3 });
      await el.type(String(value));
    }

    // Fill any link fields via the combobox + free-entry fallback
    for (const lf of c.linkFields ?? []) {
      const ok = await fillLinkField(page, lf.label, lf.value);
      if (!ok) console.log(`    (link "${lf.label}" not filled)`);
      await sleep(300);
    }

    // Set the PK (name)
    const nameInput = await page.$('#name');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(c.pk);
    }

    // Click Save / Create
    const saved = (await clickByText(page, 'Save')) || (await clickByText(page, 'Create'));
    if (!saved) {
      fail('form', `${c.doctype} save button`, 'no Save/Create button found');
      continue;
    }

    await sleep(3500);
    await snapshot(page, `form-${c.doctype}-after-save`);
    // Capture any visible toast text for diagnostics
    const toastText = await page
      .evaluate(() => {
        const t = document.querySelector(
          '[data-sonner-toast], [role="status"], [role="alert"]',
        );
        return t ? (t as HTMLElement).innerText : '';
      })
      .catch(() => '');
    if (toastText) console.log(`    toast: ${toastText.slice(0, 200)}`);
    const afterUrl = page.url();
    // Server may auto-derive `name` from the label field, so the redirect URL
    // won't necessarily contain c.pk. Just confirm we left /new and landed on
    // a record detail URL under this doctype.
    const onNewPath = afterUrl.endsWith(`/${c.doctype}/new`);
    const onDetail = afterUrl.match(new RegExp(`/dashboard/erp/${c.doctype}/[^/?#]+$`));
    if (onNewPath || !onDetail) {
      fail('form', `${c.doctype} create`, `redirect went to ${afterUrl}`, Date.now() - t0);
      continue;
    }
    const actualPk = decodeURIComponent(onDetail[0].split('/').pop() ?? '');
    pass('form', `${c.doctype} created`, actualPk, Date.now() - t0);
    await snapshot(page, `form-${c.doctype}-created`);

    // Delete via dropdown
    const detailUrl = `${BASE_URL}/dashboard/erp/${c.doctype}/${encodeURIComponent(actualPk)}`;
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    // Open the more-actions dropdown
    const dropdownOpened = await page.evaluate(() => {
      const triggers = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button[aria-haspopup="menu"], button[data-slot="dropdown-menu-trigger"]',
        ),
      );
      const visible = triggers.find((t) => {
        const r = t.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!visible) return false;
      visible.click();
      return true;
    });
    if (!dropdownOpened) {
      fail('form', `${c.doctype} dropdown open`, 'no menu trigger found');
      continue;
    }
    await sleep(500);

    // Click the Delete menu item
    const menuClicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const del = items.find((i) => (i.innerText ?? '').trim().includes('Delete'));
      if (!del) return false;
      del.click();
      return true;
    });
    if (!menuClicked) {
      fail('form', `${c.doctype} delete menu`, 'no Delete menu item');
      continue;
    }
    await sleep(700);
    await snapshot(page, `form-${c.doctype}-delete-confirm`);

    // Confirm in dialog: click the destructive Delete button INSIDE the dialog
    const confirmed = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) return false;
      const btns = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
      const del = btns.find((b) => (b.innerText ?? '').trim() === 'Delete');
      if (!del) return false;
      del.click();
      return true;
    });
    if (!confirmed) {
      fail('form', `${c.doctype} delete confirm`, 'no destructive Delete button in dialog');
      continue;
    }
    await sleep(2000);

    // Verify deletion
    const verify = await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    if (!verify || !verify.ok() || page.url().endsWith(`/${c.doctype}`)) {
      pass('form', `${c.doctype} deleted`, c.pk, Date.now() - t0);
    } else {
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (bodyText.toLowerCase().includes('not found')) {
        pass('form', `${c.doctype} deleted (404)`, c.pk);
      } else {
        fail('form', `${c.doctype} deleted`, 'record still resolves');
      }
    }
  }
}

async function phasePrint(page: Page) {
  console.log('\n=== Phase: print PDF ===');
  await page.goto(`${BASE_URL}/dashboard/erp/sales-invoice`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await sleep(800);

  const firstName = await page
    .$eval('a[href^="/dashboard/erp/sales-invoice/"]', (a) => {
      const href = (a as HTMLAnchorElement).getAttribute('href') ?? '';
      return decodeURIComponent(href.split('/').pop() ?? '');
    })
    .catch(() => null);

  if (!firstName || firstName === 'new') {
    fail('print', 'sales invoice exists', 'no rows on /dashboard/erp/sales-invoice');
    return;
  }

  const cookies = await page.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const t0 = Date.now();
  const url = `${BASE_URL}/api/erp-pdf/sales-invoice/${encodeURIComponent(firstName)}`;
  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader } });
    const ct = res.headers.get('content-type') ?? '';
    const len = res.headers.get('content-length') ?? '?';
    if (res.ok && ct.includes('application/pdf')) {
      pass('print', 'sales invoice PDF', `${ct} (${len} bytes)`, Date.now() - t0);
    } else {
      fail('print', 'sales invoice PDF', `status ${res.status} ct=${ct}`, Date.now() - t0);
    }
  } catch (e) {
    fail('print', 'sales invoice PDF', e instanceof Error ? e.message : 'fetch failed', Date.now() - t0);
  }
}

async function phaseAi(page: Page) {
  console.log('\n=== Phase: AI chat ===');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);

  const opened = await clickByText(page, 'AI Assistant', 'button');
  if (!opened) {
    fail('ai', 'AI Assistant toggle present', 'not found');
    return;
  }
  await sleep(500);
  await snapshot(page, 'ai-panel-open');

  const input = await page.$('textarea, [contenteditable="true"]');
  if (!input) {
    fail('ai', 'chat input present', 'no textarea/contenteditable');
    return;
  }
  await input.type('Hello — reply with the single word OK.');

  const before = await page.evaluate(() => document.body.innerText);
  await page.keyboard.press('Enter');

  const t0 = Date.now();
  let after = before;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    after = await page.evaluate(() => document.body.innerText);
    if (after.length > before.length + 20) break;
  }
  await snapshot(page, 'ai-after-response');
  if (after.length > before.length + 20) {
    pass('ai', 'AI responded', `${after.length - before.length} new chars`, Date.now() - t0);
  } else {
    fail('ai', 'AI responded', 'no visible response within 30s', Date.now() - t0);
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  const dev = await startDevServer();
  const browser = await launch();
  const page = await browser.newPage();

  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('webpack-hmr')) {
      consoleErrors.push(m.text().slice(0, 200));
    }
  });

  try {
    if (PHASES.includes('login')) {
      const ok = await phaseLogin(page);
      if (!ok) throw new Error('login failed — aborting subsequent phases');
    }
    if (PHASES.includes('desktop')) await phaseDesktop(page);
    if (PHASES.includes('mobile')) await phaseMobile(page);
    if (PHASES.includes('click')) await phaseClick(page);
    if (PHASES.includes('form')) await phaseForm(page);
    if (PHASES.includes('print')) await phasePrint(page);
    if (PHASES.includes('ai')) await phaseAi(page);
  } catch (e) {
    console.error('\nSuite aborted:', e instanceof Error ? e.message : e);
  } finally {
    await browser.close();
    if (dev) dev.kill('SIGTERM');
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (consoleErrors.length > 0) {
    console.log(`Captured ${consoleErrors.length} console error(s) during run:`);
    for (const e of consoleErrors.slice(0, 10)) console.log(`  - ${e}`);
  }

  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await writeFile(
    join(SCREENSHOT_DIR, 'report.json'),
    JSON.stringify({ results, consoleErrors }, null, 2),
  );
  console.log(`Report: ${SCREENSHOT_DIR}/report.json`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Suite crashed:', e);
  process.exit(2);
});
