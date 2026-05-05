"use client";
export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-2xl font-bold text-navy mb-2">Stock Ledger</h1>
      <p className="text-sm text-gray-500">This module is ready for use. Data will appear here once records are created.</p>
      <a href="/inventory/stock-ledger/new" className="mt-4 px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-[#B08D2F] transition-colors">
        + Create First Stock Entry
      </a>
    </div>
  );
}
