// PDF generation for ERP documents.
//
// Loads the print page (/print/erp/<doctype>/<name>) in headless Chrome with
// the caller's auth cookie attached, then captures a PDF.
//
// Pattern adapted from the user's existing app/api/pdf/route.ts:
// puppeteer-extra + StealthPlugin + @sparticuz/chromium-min, with a local
// override via CHROME_EXECUTABLE_PATH for development.

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-extra';
import chromium from '@sparticuz/chromium-min';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Public chromium-min binary URL (override with CHROMIUM_PACK_URL if needed,
// e.g. you've mirrored the tarball to your own GCS/S3 bucket).
const DEFAULT_CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

interface RouteParams {
  doctype: string;
  name: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  const { doctype, name } = await params;

  const isLocal = !!process.env.CHROME_EXECUTABLE_PATH;
  puppeteer.use(StealthPlugin());

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      args: isLocal
        ? [
            ...puppeteer.defaultArgs(),
            '--hide-scrollbars',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ]
        : [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: { width: 1280, height: 1696 },
      executablePath: isLocal
        ? process.env.CHROME_EXECUTABLE_PATH
        : await chromium.executablePath(
            process.env.CHROMIUM_PACK_URL || DEFAULT_CHROMIUM_URL,
          ),
      headless: true,
    });

    const page = await browser.newPage();

    // Forward the caller's auth cookies so the print page (which sits behind
    // the JWT middleware) renders for the same user.
    const origin = request.nextUrl.origin;
    const url = new URL(origin);
    const cookies = request.headers.get('cookie');
    if (cookies) {
      const parsed = cookies.split(';').map((c) => {
        const [n, ...rest] = c.trim().split('=');
        return {
          name: n,
          value: rest.join('='),
          domain: url.hostname,
          path: '/',
        };
      });
      await page.setCookie(...parsed);
    }

    const printUrl = `${origin}/print/erp/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait briefly for fonts/CSS to settle
    await page.evaluateHandle('document.fonts.ready');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doctype}-${name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[erp-pdf] generation failed:', errorMessage(err));
    return NextResponse.json(
      { error: errorMessage(err, 'PDF generation failed') },
      { status: 500 },
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
  }
}
