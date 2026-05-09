"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, User, Clock, MessageSquare, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateIssueStatus } from "../actions";
import { toast } from "sonner";

interface IssueRecord { name: string; subject: string; customer: string | null; raised_by: string | null; status: string; priority: string | null; issue_type: string | null; opening_date: string | null; resolution_time: number | null; company: string | null; project: string | null; docstatus: number; description: string | null; resolution_details: string | null; contact: string | null; lead: string | null; first_responded_on: string | null; avg_response_time: number | null; customer_name: string | null; via_customer_portal: boolean; agreement_status: string | null }

const STATUS: Record<string, { label: string; badge: string }> = { Open: { label: "Open", badge: "bg-blue-100 text-blue-700 border-blue-200" }, Replied: { label: "Replied", badge: "bg-teal-100 text-teal-700 border-teal-200" }, Resolved: { label: "Resolved", badge: "bg-green-100 text-green-700 border-green-200" }, Closed: { label: "Closed", badge: "bg-gray-100 text-gray-700 border-gray-200" } };
const PRIORITY: Record<string, { color: string }> = { Urgent: { color: "text-red-700 bg-red-50 border-red-200" }, High: { color: "text-orange-700 bg-orange-50 border-orange-200" }, Medium: { color: "text-amber-700 bg-amber-50 border-amber-200" }, Low: { color: "text-green-700 bg-green-50 border-green-200" } };
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const mins = (s: number | null) => s != null ? `${Math.round(s / 60)} min` : "—";

export default function IssueDetailClient({ record }: { record: IssueRecord }) {
  const router = useRouter();
  const cfg = STATUS[record.status] || STATUS.Open;
  const pc = PRIORITY[record.priority || ""] || PRIORITY.Medium;
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/support/issues")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.subject}</h1><p className="text-sm text-[#64748b] mt-1">{record.name} | {record.issue_type || "General"}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>{cfg.label}</span>
        {record.status === "Open" && <Button onClick={async () => { const r = await updateIssueStatus(record.name, "Resolved"); if (r.success) { toast.success("Resolved"); router.push("/dashboard/erp/support/issues"); } else toast.error(r.error); }} className="bg-green-600 hover:bg-green-700">Resolve</Button>}
        {record.status === "Resolved" && <Button onClick={async () => { const r = await updateIssueStatus(record.name, "Closed"); if (r.success) { toast.success("Closed"); router.push("/dashboard/erp/support/issues"); } else toast.error(r.error); }}>Close</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><User size={16} /><span className="text-xs font-medium uppercase">Contact</span></div><p className="font-semibold text-[#0f172a]">{record.customer_name || record.customer || "—"}</p><p className="text-sm text-[#64748b]">{record.raised_by || "—"}</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><AlertCircle size={16} /><span className="text-xs font-medium uppercase">Priority</span></div><span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${pc.color}`}>{record.priority || "Medium"}</span></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Clock size={16} /><span className="text-xs font-medium uppercase">Time</span></div><p className="text-sm">Opened: <span className="font-medium">{dt(record.opening_date)}</span></p><p className="text-sm">Avg Response: <span className="font-medium">{mins(record.avg_response_time)}</span></p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><CheckCircle size={16} /><span className="text-xs font-medium uppercase">SLA</span></div><p className="text-sm text-[#64748b]">{record.agreement_status || "—"}</p></div>
      </div>
      {record.description && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"><div className="flex items-center gap-2 text-[#64748b] mb-2"><MessageSquare size={16} /><span className="text-xs font-medium uppercase">Description</span></div><div className="text-sm text-[#0f172a] whitespace-pre-wrap">{record.description}</div></div>
      )}
      {record.resolution_details && (
        <div className="bg-green-50 rounded-2xl border border-green-100 p-5"><div className="flex items-center gap-2 text-green-600 mb-2"><CheckCircle size={16} /><span className="text-xs font-medium uppercase">Resolution</span></div><div className="text-sm text-green-800 whitespace-pre-wrap">{record.resolution_details}</div></div>
      )}
    </div>
  );
}
