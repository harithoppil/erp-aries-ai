"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Calendar, TrendingUp, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { updateOpportunityStatus } from "../actions";
import { toast } from "sonner";

interface Item { name: string; item_code: string | null; item_name: string | null; qty: number; rate: number; amount: number; uom: string | null }
interface OppRecord { name: string; opportunity_from: string; party_name: string; customer_name: string | null; opportunity_type: string | null; status: string; sales_stage: string | null; opportunity_amount: number; probability: number | null; currency: string | null; transaction_date: string; company: string; expected_closing: string | null; contact_person: string | null; contact_email: string | null; territory: string | null; industry: string | null; market_segment: string | null; annual_revenue: number | null; order_lost_reason: string | null; items: Item[] }

const STATUS: Record<string, { label: string; badge: string }> = { Open: { label: "Open", badge: "bg-blue-100 text-blue-700 border-blue-200" }, Quoted: { label: "Quoted", badge: "bg-purple-100 text-purple-700 border-purple-200" }, Won: { label: "Won", badge: "bg-green-100 text-green-700 border-green-200" }, Lost: { label: "Lost", badge: "bg-red-100 text-red-700 border-red-200" } };
const fmt = (v: number, c = "AED") => v.toLocaleString("en-AE", { style: "currency", currency: c });
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function OpportunityDetailClient({ record }: { record: OppRecord }) {
  const router = useRouter();
  const cfg = STATUS[record.status] || STATUS.Open;
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/crm/opportunities")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.name}</h1><p className="text-sm text-[#64748b] mt-1">Opportunity from {record.opportunity_from}: {record.party_name}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>{cfg.label}</span>
        {record.status === "Open" && <Button onClick={async () => { const r = await updateOpportunityStatus(record.name, "Won"); if (r.success) { toast.success("Marked as Won"); router.push("/dashboard/erp/crm/opportunities"); } else toast.error(r.error); }} className="bg-green-600 hover:bg-green-700">Mark Won</Button>}
        {record.status === "Open" && <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={async () => { const r = await updateOpportunityStatus(record.name, "Lost"); if (r.success) { toast.success("Marked as Lost"); router.push("/dashboard/erp/crm/opportunities"); } else toast.error(r.error); }}>Mark Lost</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><User size={16} /><span className="text-xs font-medium uppercase">Party</span></div><p className="font-semibold text-[#0f172a]">{record.customer_name || record.party_name}</p>{record.contact_email && <p className="text-sm text-[#64748b]">{record.contact_email}</p>}</div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Target size={16} /><span className="text-xs font-medium uppercase">Pipeline</span></div><p className="text-sm">Stage: <span className="font-medium">{record.sales_stage}</span></p><p className="text-sm">Probability: <span className="font-medium">{record.probability}%</span></p><p className="text-sm">Closing: <span className="font-medium">{dt(record.expected_closing)}</span></p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><TrendingUp size={16} /><span className="text-xs font-medium uppercase">Amount</span></div><p className="text-2xl font-bold text-[#0f172a]">{fmt(record.opportunity_amount, record.currency || "AED")}</p>{record.annual_revenue != null && <p className="text-sm text-[#64748b]">Company Revenue: {fmt(record.annual_revenue)}</p>}</div>
      </div>
      {record.items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Items ({record.items.length})</h3></div>
          <Table><TableHeader><TableRow><TableHead className="px-5">Item Code</TableHead><TableHead className="px-5">Name</TableHead><TableHead className="px-5 text-right">Qty</TableHead><TableHead className="px-5 text-right">Rate</TableHead><TableHead className="px-5 text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>{record.items.map((item) => (<TableRow key={item.name}><TableCell className="px-5 font-mono text-xs">{item.item_code || "—"}</TableCell><TableCell className="px-5 font-medium">{item.item_name || "—"}</TableCell><TableCell className="px-5 text-right">{item.qty}</TableCell><TableCell className="px-5 text-right">{fmt(item.rate, record.currency || "AED")}</TableCell><TableCell className="px-5 text-right font-medium">{fmt(item.amount, record.currency || "AED")}</TableCell></TableRow>))}</TableBody></Table>
        </div>
      )}
      {record.order_lost_reason && <div className="bg-red-50 rounded-2xl border border-red-100 p-5"><p className="text-xs text-red-500 uppercase mb-1">Lost Reason</p><p className="text-sm text-red-700">{record.order_lost_reason}</p></div>}
    </div>
  );
}
