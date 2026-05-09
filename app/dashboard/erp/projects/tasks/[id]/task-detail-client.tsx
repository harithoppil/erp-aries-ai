"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckSquare, Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTask, deleteTask } from "../actions";
import { toast } from "sonner";

interface TaskRecord {
  name: string; subject: string; status: string; priority: string | null;
  project: string | null; exp_start_date: string | null; exp_end_date: string | null;
  progress: number | null; is_milestone: boolean; assigned_to: string | null;
  docstatus: number; type: string | null; is_group: boolean;
  description: string | null; actual_time: number | null;
  act_start_date: string | null; act_end_date: string | null;
  department: string | null; company: string | null;
}

const STATUS: Record<string, { label: string; badge: string }> = {
  Open: { label: "Open", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Working: { label: "Working", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Completed: { label: "Completed", badge: "bg-green-100 text-green-700 border-green-200" },
  Cancelled: { label: "Cancelled", badge: "bg-gray-200 text-gray-600 border-gray-300" },
  Overdue: { label: "Overdue", badge: "bg-red-100 text-red-700 border-red-200" },
};
const PRIORITY: Record<string, string> = { Low: "bg-gray-100 text-gray-600", Medium: "bg-blue-100 text-blue-600", High: "bg-amber-100 text-amber-600", Urgent: "bg-red-100 text-red-600" };
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function TaskDetailClient({ record }: { record: TaskRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const sc = STATUS[record.status] || STATUS.Open;
  const pc = PRIORITY[record.priority || "Medium"] || PRIORITY.Medium;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/projects/tasks")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.subject}</h1><p className="text-sm text-[#64748b] mt-1">{record.name} | {record.project || "No Project"}</p></div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${pc}`}>{record.priority || "Medium"}</span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${sc.badge}`}>{sc.label}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><CheckSquare size={16} /><span className="text-xs font-medium uppercase">Task</span></div>
          <p className="font-semibold text-[#0f172a]">{record.subject}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Type: {record.type || "—"}</p>
            <p className="text-sm text-[#64748b]">Milestone: {record.is_milestone ? "Yes" : "No"}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Dates</span></div>
          <div className="space-y-1">
            <p className="text-sm">Expected Start: <span className="font-medium">{dt(record.exp_start_date)}</span></p>
            <p className="text-sm">Expected End: <span className="font-medium">{dt(record.exp_end_date)}</span></p>
            <p className="text-sm">Actual Start: <span className="font-medium">{dt(record.act_start_date)}</span></p>
            <p className="text-sm">Actual End: <span className="font-medium">{dt(record.act_end_date)}</span></p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Clock size={16} /><span className="text-xs font-medium uppercase">Progress</span></div>
          <p className="text-2xl font-bold text-[#0f172a]">{record.progress || 0}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-[#1e3a5f] h-2 rounded-full" style={{ width: `${record.progress || 0}%` }} /></div>
          {record.actual_time != null && <p className="text-sm text-[#64748b]">Actual Time: {record.actual_time} hrs</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><User size={16} /><span className="text-xs font-medium uppercase">Assignment</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Assigned: {record.assigned_to || "—"}</p>
            <p className="text-sm text-[#64748b]">Department: {record.department || "—"}</p>
            <p className="text-sm text-[#64748b]">Company: {record.company || "—"}</p>
          </div>
        </div>
      </div>
      {record.description && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Description</h3>
          <p className="text-sm text-[#64748b] whitespace-pre-wrap">{record.description}</p>
        </div>
      )}
      <div className="flex gap-2">
        {record.status !== "Completed" && <Button onClick={async () => { setLoading(true); const r = await updateTask(record.name, { status: "Completed", progress: 100 }); if (r.success) { toast.success("Task completed"); router.push("/dashboard/erp/projects/tasks"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-green-600 hover:bg-green-700">Mark Complete</Button>}
        {record.status === "Open" && <Button onClick={async () => { setLoading(true); const r = await updateTask(record.name, { status: "Working" }); if (r.success) { toast.success("Started working"); router.push("/dashboard/erp/projects/tasks"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Start Working</Button>}
        <Button variant="destructive" onClick={async () => { if (!confirm("Delete this task?")) return; setLoading(true); const r = await deleteTask(record.name); if (r.success) { toast.success("Deleted"); router.push("/dashboard/erp/projects/tasks"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Delete</Button>
      </div>
    </div>
  );
}
