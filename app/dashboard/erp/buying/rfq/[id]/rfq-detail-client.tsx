"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Calendar, Building2, FileQuestion, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { submitRFQ, cancelRFQ } from "../actions";
import { toast } from "sonner";

interface Item { name: string; item_code: string; item_name: string | null; qty: number; uom: string; schedule_date: string; warehouse: string | null }
interface Supplier { name: string; supplier: string; supplier_name: string | null; quote_status: string | null; email_id: string | null }
interface Record { name: string; company: string; transaction_date: string; status: string; schedule_date: string | null; message_for_supplier: string | null; opportunity: string | null; docstatus: number; items: Item[]; suppliers: Supplier[] }

const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function RfqDetailClient({ record }: { record: Record }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/buying/rfq")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.name}</h1><p className="text-sm text-[#64748b] mt-1">Request for Quotation</p></div>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">{record.status || "Draft"}</span>
        {record.docstatus === 0 && <Button onClick={async () => { setLoading(true); const r = await submitRFQ(record.name); if (r.success) { toast.success("Submitted"); router.push("/dashboard/erp/buying/rfq"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Submit</Button>}
        {record.docstatus === 1 && <Button variant="destructive" onClick={async () => { setLoading(true); const r = await cancelRFQ(record.name); if (r.success) { toast.success("Cancelled"); router.push("/dashboard/erp/buying/rfq"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Cancel</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Building2 size={16} /><span className="text-xs font-medium uppercase">Company</span></div><p className="font-semibold text-[#0f172a]">{record.company}</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Dates</span></div><p className="text-sm">Transaction: <span className="font-medium">{dt(record.transaction_date)}</span></p><p className="text-sm">Schedule: <span className="font-medium">{dt(record.schedule_date)}</span></p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Users size={16} /><span className="text-xs font-medium uppercase">Suppliers</span></div><p className="text-2xl font-bold text-[#0f172a]">{record.suppliers.length}</p></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Items ({record.items.length})</h3></div>
        <Table><TableHeader><TableRow><TableHead className="px-5">Item Code</TableHead><TableHead className="px-5">Name</TableHead><TableHead className="px-5 text-right">Qty</TableHead><TableHead className="px-5">UOM</TableHead><TableHead className="px-5">Schedule Date</TableHead></TableRow></TableHeader>
        <TableBody>{record.items.map((i) => (<TableRow key={i.name}><TableCell className="px-5 font-mono text-xs">{i.item_code}</TableCell><TableCell className="px-5 font-medium">{i.item_name || "—"}</TableCell><TableCell className="px-5 text-right">{i.qty}</TableCell><TableCell className="px-5">{i.uom}</TableCell><TableCell className="px-5">{dt(i.schedule_date)}</TableCell></TableRow>))}</TableBody></Table>
      </div>
      {record.suppliers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Suppliers ({record.suppliers.length})</h3></div>
          <Table><TableHeader><TableRow><TableHead className="px-5">Supplier</TableHead><TableHead className="px-5">Email</TableHead><TableHead className="px-5">Quote Status</TableHead></TableRow></TableHeader>
          <TableBody>{record.suppliers.map((s) => (<TableRow key={s.name}><TableCell className="px-5 font-medium">{s.supplier_name || s.supplier}</TableCell><TableCell className="px-5 text-[#64748b]">{s.email_id || "—"}</TableCell><TableCell className="px-5"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">{s.quote_status || "Pending"}</span></TableCell></TableRow>))}</TableBody></Table>
        </div>
      )}
      {record.message_for_supplier && <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"><p className="text-xs text-[#94a3b8] uppercase mb-1">Message for Suppliers</p><p className="text-sm text-[#64748b]">{record.message_for_supplier}</p></div>}
    </div>
  );
}
