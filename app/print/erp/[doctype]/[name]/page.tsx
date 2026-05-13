export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { fetchDoctypeRecord } from '@/app/dashboard/erp/[doctype]/[name]/actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { PrintDocument } from '@/app/print/erp/[doctype]/[name]/print-document';

interface PageParams {
  doctype: string;
  name: string;
}

export default async function PrintPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { doctype, name } = await params;
  const result = await fetchDoctypeRecord(doctype, decodeURIComponent(name));
  if (!result.success) {
    if (result.error === 'NOT_FOUND') notFound();
    return (
      <div className="p-8 text-red-600">Failed to load: {result.error}</div>
    );
  }

  return (
    <PrintDocument
      doctype={doctype}
      doctypeLabel={toDisplayLabel(doctype)}
      record={result.data as Record<string, unknown>}
    />
  );
}
