import {
  fetchDoctypeList,
  type ListMeta,
} from './actions';
import GenericListClient from './GenericListClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ doctype: string }>;
}

export default async function GenericListPage({ params }: PageProps) {
  const { doctype } = await params;

  const result = await fetchDoctypeList(doctype);

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-bold text-[#0f172a] mb-2">
          Failed to load {doctype}
        </h2>
        <p className="text-sm text-[#64748b] max-w-md">
          {result.error}
        </p>
      </div>
    );
  }

  const meta: ListMeta = result.meta;

  return (
    <GenericListClient
      doctype={doctype}
      initialData={result.records}
      meta={meta}
    />
  );
}
