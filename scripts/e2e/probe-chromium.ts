// Sanity probe: download chromium-min from the sparticuz GitHub release and
// verify we can launch puppeteer-extra with it. Prints the resolved binary
// path and Chrome version on success.
//
// Usage: bun run scripts/e2e/probe-chromium.ts

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium-min';

const PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

async function main() {
  console.log(`Resolving chromium binary from: ${PACK_URL}`);
  puppeteer.use(StealthPlugin());

  const t0 = Date.now();
  const exe = await chromium.executablePath(PACK_URL);
  console.log(`Resolved to: ${exe} (${Date.now() - t0}ms)`);

  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: exe,
    headless: true,
  });

  const version = await browser.version();
  console.log(`Chrome: ${version}`);

  const page = await browser.newPage();
  await page.goto('about:blank');
  console.log('about:blank loaded ok');

  await browser.close();
  console.log('OK');
}

main().catch((e) => {
  console.error('FAIL:', e?.message || e);
  process.exit(1);
});
