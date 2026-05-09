"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRightLeft, Calendar, Warehouse, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { submitStockEntry, cancelStockEntry } from "../actions";
import { toast } from "sonner";

interface Item { name: string; item_code: string; item_name: string | null; qty: number; uom: string; basic_rate: number; basic_amount: number; s_warehouse: string | null; t_warehouse: string | null; serial_no: string | null; batch_no: string | null }
interface SERecord { name: string; stock_entry_type: string; purpose: string | null; posting_date: string | null; from_warehouse: string | null; to_warehouse: string | null; total_incoming_value: number; total_outgoing_value: number; value_difference: number; docstatus: number; company: string; work_order: string | null; remarks: string | null; items: Item[] }

const TYPE_COLORS: Record<string, string> = { "Material Receipt": "bg-green-100 text-green-700", "Material Issue": "bg-red-100 text-red-700", "Material Transfer": "bg-blue-100 text-blue-700", Manufacture: "bg-purple-100 text-purple-700", Repack: "bg-amber-100 text-amber-700" };
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function StockEntryDetailClient({ record }: { record: SERecord }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const tc = TYPE_COLORS[record.stock_entry_type] || "bg-gray-100 text-gray-700";
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/stock/entries")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.name}</h1><p className="text-sm text-[#64748b] mt-1">Stock Entry</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${tc}`}>{record.stock_entry_type}</span>
        {record.docstatus === 0 && <Button onClick={async () => { setLoading(true); const r = await submitStockEntry(record.name); if (r.success) { toast.success("Submitted"); router.push("/dashboard/erp/stock/entries"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Submit</Button>}
        {record.docstatus === 1 && <Button variant="destructive" onClick={async () => { setLoading(true); const r = await cancelStockEntry(record.name); if (r.success) { toast.success("Cancelled"); router.push("/dashboard/erp/stock/entries"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Cancel</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><ArrowRightLeft size={16} /><span className="text-xs font-medium uppercase">Type & Purpose</span></div><p className="font-semibold text-[#0f172a]">{record.stock_entry_type}</p><p className="text-sm text-[#64748b]">Purpose: {record.purpose || "—"}</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Warehouse size={16} /><span className="text-xs font-medium uppercase">Warehouses</span></div><p className="text-sm">From: <span className="font-medium">{record.from_warehouse || "—"}</span></p><p className="text-sm">To: <span className="font-medium">{record.to_warehouse || "—"}</span></p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><FileText size={16} /><span className="text-xs font-medium uppercase">Values</span></div><p className="text-sm">Incoming: <span className="font-medium">{fmt(record.total_incoming_value)}</span></p><p className="text-sm">Outgoing: <span className="font-medium">{fmt(record.total_outgoing_value)}</span></p><p className="text-sm font-bold">Difference: <span className={record.value_difference >= 0 ? "text-green-700" : "text-red-700"}>{fmt(record.value_difference)}</span></p></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Items ({record.items.length})</h3></div>
        <Table><TableHeader><TableRow><TableHead className="px-5">Item Code</TableHead><TableHead className="px-5">Name</TableHead><TableHead className="px-5 text-right">Qty</TableHead><TableHead className="px-5">Source → Target</TableHead><TableHead className="px-5 text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>{record.items.map((item) => (<TableRow key={item.name}><TableCell className="px-5 font-mono text-xs">{item.item_code}</TableCell><TableCell className="px-5 font-medium">{item.item_name || "—"}</TableCell><TableCell className="px-5 text-right">{item.qty} {item.uom}</TableCell><TableCell className="px-5 text-xs">{item.s_warehouse || "—"} → {item.t_warehouse || "—"}</TableCell><TableCell className="px-5 text-right font-medium">{fmt(item.basic_amount)}</TableCell></TableRow>))}</TableBody></Table>
      </div>
      {record.remarks && <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"><p className="text-xs text-[#94a3b8] uppercase mb-1">Remarks</p><p className="text-sm text-[#64748b]">{record.remarks}</p></div>}
    </div>
  );
}
