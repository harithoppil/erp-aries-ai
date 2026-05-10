// Module-settings auto-redirector.
//
// Frappe-style settings doctypes (AccountsSettings, SellingSettings,
// BuyingSettings, StockSettings, ManufacturingSettings, ...) are singletons —
// one row per site, conventionally named the same as the doctype. This page
// finds the lone row (or creates an empty one named after the display label)
// and forwards to the standard /dashboard/erp/[doctype]/[name] detail flow,
// which already handles scalar field editing via GenericDetailClient.

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  toAccessor,
  toDisplayLabel,
  getDelegate,
  type PrismaDelegate,
} from '@/lib/erpnext/prisma-delegate';

interface PageParams {
  doctype: string;
}

// Whitelist of settings doctypes we expose via this page. Each maps the URL
// slug to its expected doctype label (used as the singleton row name).
const SETTINGS_DOCTYPES: Record<string, string> = {
  'accounts-settings': 'Accounts Settings',
  'selling-settings': 'Selling Settings',
  'buying-settings': 'Buying Settings',
  'stock-settings': 'Stock Settings',
  'manufacturing-settings': 'Manufacturing Settings',
};

export default async function SettingsRedirector({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { doctype } = await params;

  if (!(doctype in SETTINGS_DOCTYPES)) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Unknown settings module</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No settings module is registered for "{doctype}".
        </p>
      </div>
    );
  }

  const expectedName = SETTINGS_DOCTYPES[doctype];
  const delegate = getDelegate(prisma, doctype) as PrismaDelegate | null;

  if (!delegate) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Schema mismatch</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Settings model "{doctype}" was not found in the Prisma schema.
        </p>
      </div>
    );
  }

  // Find the singleton row. Frappe convention: name equals the display label.
  // Fall back to "the first row" in case an older instance was created with a
  // different name.
  let row = (await delegate.findUnique({ where: { name: expectedName } })) as
    | { name: string }
    | null;
  if (!row) {
    const rows = (await delegate.findMany({ take: 1 })) as { name: string }[];
    row = rows[0] ?? null;
  }

  if (!row) {
    // Auto-create the singleton with the conventional name + minimal defaults
    // so the user lands directly on a populated form they can edit.
    const accessor = toAccessor(doctype);
    await (prisma as unknown as Record<string, PrismaDelegate>)[accessor].create({
      data: {
        name: expectedName,
        docstatus: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    row = { name: expectedName };
  }

  // Hand off to the standard generic detail flow — it has all the editing UX.
  // Render-time redirect: never returns.
  redirect(
    `/dashboard/erp/${encodeURIComponent(doctype)}/${encodeURIComponent(row.name)}`,
  );
}

// Don't try to statically render — needs the DB.
export const dynamic = 'force-dynamic';

// Avoid an unused-import lint by referencing toDisplayLabel below if needed
// in future enhancements (e.g. friendlier error pages).
void toDisplayLabel;
