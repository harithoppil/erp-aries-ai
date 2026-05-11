// Take a screenshot of the Supplier detail page using the new ERPFormClient
// so we can visually compare against the localhost:8000 mockup.

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium-min';
import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PACK = process.env.CHROMIUM_PACK_URL ??
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
const OUT = 'test-output/parity';

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1600,1800',
    ],
    defaultViewport: { width: 1600, height: 1800, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(PACK),
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1800, deviceScaleFactor: 1 });
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  );
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console-err]', m.text());
  });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  // Login — wait for inputs to be attached & React hydrated before typing
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', 'admin@ariesmarine.com', { delay: 40 });
  await page.click('input[type="password"]');
  await page.type('input[type="password"]', 'admin123', { delay: 40 });
  await new Promise((r) => setTimeout(r, 500));
  await page.click('button[type="submit"]');
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (!page.url().includes('/auth')) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log('After login:', page.url());

  // Find any supplier — try the known ID first, else first row from the list
  const candidates = [
    `${BASE}/dashboard/erp/supplier/S-CATERPILLAR-MARINE-UAE-004`,
  ];
  // List page → first supplier link
  await page.goto(`${BASE}/dashboard/erp/supplier`, { waitUntil: 'networkidle2', timeout: 30000 });
  const firstHref = await page
    .$eval('a[href^="/dashboard/erp/supplier/"]', (a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
    .catch(() => '');
  if (firstHref && !firstHref.endsWith('/new')) {
    candidates.push(`${BASE}${firstHref}`);
  }

  let success = false;
  for (const url of candidates) {
    console.log('Trying', url);
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (res && res.ok()) {
      await new Promise((r) => setTimeout(r, 1500));
      const tabs = await page.$$eval(
        '[role="tab"]',
        (els) => els.map((e) => (e as HTMLElement).innerText.trim()),
      );
      console.log('Tabs rendered:', tabs);
      const buf = await page.screenshot({ fullPage: true });
      const name = url.split('/').pop();
      const out = join(OUT, `supplier-3000-${name}.png`);
      await writeFile(out, buf);
      console.log('Saved', out);
      success = true;
      break;
    } else {
      console.log('  status', res?.status());
    }
  }
  if (!success) console.log('No supplier detail page rendered.');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
