"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listTasks, createTask, type ClientSafeTask } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { CheckSquare, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

const STATUS: Record<string, { label: string; badge: string }> = {
  Open: { label: "Open", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Working: { label: "Working", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  "In Progress": { label: "In Progress", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Completed: { label: "Completed", badge: "bg-green-100 text-green-700 border-green-200" },
  Cancelled: { label: "Cancelled", badge: "bg-gray-200 text-gray-600 border-gray-300" },
  Overdue: { label: "Overdue", badge: "bg-red-100 text-red-700 border-red-200" },
  "Review Needed": { label: "Review", badge: "bg-purple-100 text-purple-700 border-purple-200" },
};
const PRIORITY: Record<string, string> = { Low: "bg-gray-100 text-gray-600", Medium: "bg-blue-100 text-blue-600", High: "bg-amber-100 text-amber-600", Urgent: "bg-red-100 text-red-600" };
const dt = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function TasksClient({ initialRecords }: { initialRecords: ClientSafeTask[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeTask[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", project: "", priority: "Medium", type: "", description: "" });

  usePageContext(`Tasks: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((t) => !q || (t.subject || "").toLowerCase().includes(q) || (t.project || "").toLowerCase().includes(q) || (t.status || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createTask(form);
    if (result.success) { toast.success("Task created"); setDialogOpen(false); setForm({ subject: "", project: "", priority: "Medium", type: "", description: "" }); const res = await listTasks(); if (res.success) setRecords(res.tasks); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Tasks</h2><p className="text-sm text-[#64748b] mt-1">{records.length} tasks</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(t => ({ name: t.name, subject: t.subject, status: t.status, priority: t.priority, project: t.project, progress: t.progress })), 'tasks')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Task</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by subject, project, status..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><CheckSquare size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No tasks found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Subject</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Project</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Priority</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Due Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Progress</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((t) => { const sc = STATUS[t.status] || STATUS.Open; const pc = PRIORITY[t.priority || "Medium"] || PRIORITY.Medium; return (<tr key={t.name} onClick={() => router.push(`/dashboard/erp/projects/tasks/${t.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{t.subject}</td><td className="px-4 py-3 text-[#64748b]">{t.project || "—"}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pc}`}>{t.priority || "Medium"}</span></td><td className="px-4 py-3 text-[#64748b]">{dt(t.exp_end_date)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-16 bg-gray-200 rounded-full h-2"><div className="bg-[#1e3a5f] h-2 rounded-full" style={{ width: `${t.progress || 0}%` }} /></div><span className="text-xs text-[#64748b]">{t.progress || 0}%</span></div></td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${sc.badge}`}>{sc.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Subject</label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Task subject" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Project</label><Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="Project" /></div><div><label className="text-sm font-medium">Priority</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></div></div>
          <div><label className="text-sm font-medium">Type</label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Task type" /></div>
          <div><label className="text-sm font-medium">Description</label><textarea className="w-full min-h-[80px] rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description..." /></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
