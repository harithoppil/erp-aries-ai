"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Factory, Calendar, Warehouse, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { submitWorkOrder, cancelWorkOrder } from "../actions";
import { toast } from "sonner";

interface ReqItem { name: string; item_code: string | null; item_name: string | null; source_warehouse: string | null; required_qty: number; transferred_qty: number; consumed_qty: number }
interface Operation { name: string; operation: string; workstation: string | null; time_in_mins: number; status: string | null; completed_qty: number | null }
interface WORecord { name: string; production_item: string; item_name: string | null; bom_no: string; status: string; qty: number; produced_qty: number; company: string; planned_start_date: string; actual_start_date: string | null; planned_end_date: string | null; fg_warehouse: string | null; wip_warehouse: string | null; sales_order: string | null; project: string | null; total_operating_cost: number; docstatus: number; description: string | null; stock_uom: string | null; required_items: ReqItem[]; operations: Operation[] }

const STATUS: Record<string, { label: string; badge: string }> = { Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" }, "Not Started": { label: "Not Started", badge: "bg-blue-100 text-blue-700 border-blue-200" }, "In Process": { label: "In Process", badge: "bg-amber-100 text-amber-700 border-amber-200" }, Completed: { label: "Completed", badge: "bg-green-100 text-green-700 border-green-200" }, Stopped: { label: "Stopped", badge: "bg-red-100 text-red-700 border-red-200" }, Cancelled: { label: "Cancelled", badge: "bg-gray-200 text-gray-600 border-gray-300" } };
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function WorkOrderDetailClient({ record }: { record: WORecord }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const cfg = STATUS[record.status] || STATUS.Draft;
  const progress = record.qty > 0 ? Math.round((record.produced_qty / record.qty) * 100) : 0;
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/manufacturing/work-orders")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.name}</h1><p className="text-sm text-[#64748b] mt-1">{record.item_name || record.production_item} | BOM: {record.bom_no}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>{cfg.label}</span>
        {record.docstatus === 0 && <Button onClick={async () => { setLoading(true); const r = await submitWorkOrder(record.name); if (r.success) { toast.success("Submitted"); router.push("/dashboard/erp/manufacturing/work-orders"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Submit</Button>}
        {record.docstatus === 1 && <Button variant="destructive" onClick={async () => { setLoading(true); const r = await cancelWorkOrder(record.name); if (r.success) { toast.success("Cancelled"); router.push("/dashboard/erp/manufacturing/work-orders"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Cancel</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Factory size={16} /><span className="text-xs font-medium uppercase">Production</span></div><p className="font-semibold text-[#0f172a]">{record.production_item}</p><p className="text-sm text-[#64748b]">{record.stock_uom || "Nos"}</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Dates</span></div><p className="text-sm">Planned Start: <span className="font-medium">{dt(record.planned_start_date)}</span></p><p className="text-sm">Planned End: <span className="font-medium">{dt(record.planned_end_date)}</span></p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Warehouse size={16} /><span className="text-xs font-medium uppercase">Warehouses</span></div><p className="text-sm">FG: <span className="font-medium">{record.fg_warehouse || "—"}</span></p><p className="text-sm">WIP: <span className="font-medium">{record.wip_warehouse || "—"}</span></p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Clock size={16} /><span className="text-xs font-medium uppercase">Progress</span></div><p className="text-2xl font-bold text-[#0f172a]">{progress}%</p><p className="text-sm text-[#64748b]">{record.produced_qty} / {record.qty} produced</p><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-[#1e3a5f] h-2 rounded-full" style={{ width: `${progress}%` }} /></div></div>
      </div>
      {record.required_items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Required Items ({record.required_items.length})</h3></div>
          <Table><TableHeader><TableRow><TableHead className="px-5">Item Code</TableHead><TableHead className="px-5 text-right">Required</TableHead><TableHead className="px-5 text-right">Transferred</TableHead><TableHead className="px-5 text-right">Consumed</TableHead><TableHead className="px-5">Source</TableHead></TableRow></TableHeader>
          <TableBody>{record.required_items.map((i) => (<TableRow key={i.name}><TableCell className="px-5 font-mono text-xs">{i.item_code || "—"}</TableCell><TableCell className="px-5 text-right">{i.required_qty}</TableCell><TableCell className="px-5 text-right">{i.transferred_qty}</TableCell><TableCell className="px-5 text-right">{i.consumed_qty}</TableCell><TableCell className="px-5 text-xs">{i.source_warehouse || "—"}</TableCell></TableRow>))}</TableBody></Table>
        </div>
      )}
      {record.operations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Operations ({record.operations.length})</h3></div>
          <Table><TableHeader><TableRow><TableHead className="px-5">Operation</TableHead><TableHead className="px-5">Workstation</TableHead><TableHead className="px-5 text-right">Time (mins)</TableHead><TableHead className="px-5">Status</TableHead></TableRow></TableHeader>
          <TableBody>{record.operations.map((o) => (<TableRow key={o.name}><TableCell className="px-5 font-medium">{o.operation}</TableCell><TableCell className="px-5 text-[#64748b]">{o.workstation || "—"}</TableCell><TableCell className="px-5 text-right">{o.time_in_mins}</TableCell><TableCell className="px-5"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">{o.status || "Pending"}</span></TableCell></TableRow>))}</TableBody></Table>
        </div>
      )}
    </div>
  );
}
