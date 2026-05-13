// Generic print template for transactional doctypes:
// Sales Invoice / Purchase Invoice / Sales Order / Purchase Order / Quotation /
// Delivery Note / Purchase Receipt. Renders header + party + line items + totals.

import { formatNumber, formatDate as localeFormatDate, formatCurrency } from '@/lib/erpnext/locale';

interface PrintDocumentProps {
  doctype: string;
  doctypeLabel: string;
  record: Record<string, unknown>;
}

function getPartyInfo(record: Record<string, unknown>): {
  partyType: string;
  partyName: string;
  partyDisplayName: string;
} {
  if (record.customer) {
    return {
      partyType: 'Customer',
      partyName: String(record.customer),
      partyDisplayName: String(record.customer_name ?? record.customer),
    };
  }
  if (record.supplier) {
    return {
      partyType: 'Supplier',
      partyName: String(record.supplier),
      partyDisplayName: String(record.supplier_name ?? record.supplier),
    };
  }
  if (record.party) {
    return {
      partyType: String(record.party_type ?? 'Party'),
      partyName: String(record.party),
      partyDisplayName: String(record.party_name ?? record.party),
    };
  }
  return { partyType: '—', partyName: '—', partyDisplayName: '—' };
}

function findLineItemsKey(record: Record<string, unknown>): string | null {
  // Common ERPNext child-table fieldnames for line items, in order of priority
  const candidates = ['items', 'taxes', 'sales_team', 'payment_schedule'];
  for (const k of candidates) {
    const v = record[k];
    if (Array.isArray(v) && v.length > 0) return k;
  }
  // Fallback: first array field with length > 0
  for (const [k, v] of Object.entries(record)) {
    if (Array.isArray(v) && v.length > 0) return k;
  }
  return null;
}

export function PrintDocument({ doctype, doctypeLabel, record }: PrintDocumentProps) {
  const party = getPartyInfo(record);
  const itemsKey = findLineItemsKey(record);
  const items = (itemsKey ? record[itemsKey] : []) as Record<string, unknown>[];
  const currency = String(record.currency ?? 'AED');
  const company = String(record.company ?? 'Aries Marine');

  const grandTotal = formatNumber(record.grand_total ?? record.total ?? 0);
  const netTotal = formatNumber(record.net_total ?? record.total ?? 0);
  const totalTax = formatNumber(record.total_taxes_and_charges ?? 0);
  const outstanding = formatNumber(record.outstanding_amount ?? 0);

  return (
    <div
      className="mx-auto max-w-[210mm] bg-white p-10 text-sm text-gray-900"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <header className="mb-8 flex items-start justify-between border-b-2 border-gray-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{company}</h1>
          <p className="mt-1 text-xs text-gray-600">Marine Enterprise Solutions</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-gray-500">{doctypeLabel}</p>
          <p className="mt-1 text-xl font-semibold">{String(record.name ?? '')}</p>
          <p className="mt-1 text-xs text-gray-600">
            Date:{' '}
            {localeFormatDate(
              record.posting_date ?? record.transaction_date ?? record.creation,
            )}
          </p>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-gray-500">
            {party.partyType}
          </h2>
          <p className="font-semibold">{party.partyDisplayName}</p>
          <p className="text-xs text-gray-600">{party.partyName}</p>
        </div>
        <div className="text-right">
          {record.due_date != null && (
            <>
              <h2 className="mb-1 text-xs uppercase tracking-widest text-gray-500">
                Due Date
              </h2>
              <p className="font-medium">{localeFormatDate(record.due_date)}</p>
            </>
          )}
          {record.delivery_date != null && (
            <>
              <h2 className="mt-2 mb-1 text-xs uppercase tracking-widest text-gray-500">
                Delivery Date
              </h2>
              <p className="font-medium">{localeFormatDate(record.delivery_date)}</p>
            </>
          )}
        </div>
      </section>

      {items.length > 0 && (
        <section className="mb-6">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Item</th>
                <th className="px-2 py-2 text-left font-semibold">Description</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">UOM</th>
                <th className="px-2 py-2 text-right font-semibold">Rate</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-2 py-2 align-top text-gray-500">{i + 1}</td>
                  <td className="px-2 py-2 align-top font-mono text-xs">
                    {String(row.item_code ?? row.item ?? '')}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="font-medium">
                      {String(row.item_name ?? row.description ?? row.item_code ?? '')}
                    </div>
                    {Boolean(row.description) && Boolean(row.item_name) && (
                      <div className="text-xs text-gray-500">{String(row.description)}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right align-top">
                    {formatNumber(row.qty ?? row.quantity ?? 0, 2)}
                  </td>
                  <td className="px-2 py-2 text-right align-top text-gray-500">
                    {String(row.uom ?? row.stock_uom ?? '')}
                  </td>
                  <td className="px-2 py-2 text-right align-top">
                    {formatNumber(row.rate ?? 0, 2)}
                  </td>
                  <td className="px-2 py-2 text-right align-top font-medium">
                    {formatNumber(row.amount ?? 0, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-6 ml-auto w-72 text-xs">
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Net Total</span>
          <span className="font-medium">{currency} {netTotal}</span>
        </div>
        {Number(record.total_taxes_and_charges ?? 0) > 0 && (
          <div className="flex justify-between border-b border-gray-200 py-1">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{currency} {totalTax}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-y-2 border-gray-900 py-2">
          <span className="font-semibold">Grand Total</span>
          <span className="text-base font-bold">{currency} {grandTotal}</span>
        </div>
        {Number(record.outstanding_amount ?? 0) > 0 && (
          <div className="mt-1 flex justify-between py-1 text-red-700">
            <span className="font-semibold">Outstanding</span>
            <span className="font-semibold">{currency} {outstanding}</span>
          </div>
        )}
      </section>

      {record.terms ? (
        <section className="mb-6 border-t border-gray-200 pt-4">
          <h3 className="mb-2 text-xs uppercase tracking-widest text-gray-500">
            Terms & Conditions
          </h3>
          <p className="whitespace-pre-wrap text-xs text-gray-700">
            {String(record.terms)}
          </p>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
        <p>{company}</p>
        <p className="mt-1">{doctypeLabel} {String(record.name ?? '')}</p>
      </footer>
    </div>
  );
}
