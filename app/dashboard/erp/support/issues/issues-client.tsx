"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listIssues, createIssue, type ClientSafeIssue } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { AlertCircle, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

const STATUS: Record<string, { label: string; badge: string }> = {
  Open: { label: "Open", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Replied: { label: "Replied", badge: "bg-teal-100 text-teal-700 border-teal-200" },
  Resolved: { label: "Resolved", badge: "bg-green-100 text-green-700 border-green-200" },
  Closed: { label: "Closed", badge: "bg-gray-100 text-gray-700 border-gray-200" },
};
const PRIORITY: Record<string, string> = { Urgent: "bg-red-100 text-red-700", High: "bg-orange-100 text-orange-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-green-100 text-green-700" };
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function IssuesClient({ initialIssues }: { initialIssues: ClientSafeIssue[] }) {
  const router = useRouter();
  const [issues, setIssues] = useState<ClientSafeIssue[]>(initialIssues);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", customer: "", raised_by: "", priority: "Medium", issue_type: "", description: "" });

  usePageContext(`Issues: ${issues.length} issues, ${issues.filter(i => i.status === "Open").length} open`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return issues.filter((i) => !q || (i.subject || "").toLowerCase().includes(q) || (i.customer || "").toLowerCase().includes(q) || (i.raised_by || "").toLowerCase().includes(q) || (i.name || "").toLowerCase().includes(q));
  }, [issues, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createIssue(form);
    if (result.success) { toast.success("Issue created"); setDialogOpen(false); setForm({ subject: "", customer: "", raised_by: "", priority: "Medium", issue_type: "", description: "" }); const res = await listIssues(); if (res.success) setIssues(res.issues); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Issues</h2><p className="text-sm text-[#64748b] mt-1">{issues.length} issues</p></div>
          <div className="flex gap-2">
            <ExportButton data={filtered.map(i => ({ name: i.name, subject: i.subject, customer: i.customer, priority: i.priority, status: i.status }))} filename="issues" />
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Issue</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by subject, customer, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><AlertCircle size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No issues found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Subject</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Raised By</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Priority</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((i) => { const sc = STATUS[i.status] || STATUS.Open; const pc = PRIORITY[i.priority || ""] || "bg-gray-100"; return (<tr key={i.name} onClick={() => router.push(`/dashboard/erp/support/issues/${i.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-mono text-xs text-[#64748b]">{i.name}</td><td className="px-4 py-3 font-medium text-[#0f172a]">{i.subject}</td><td className="px-4 py-3 text-[#64748b]">{i.raised_by || "—"}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${pc}`}>{i.priority}</span></td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${sc.badge}`}>{sc.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Issue</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Subject</label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of the issue" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Customer</label><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></div><div><label className="text-sm font-medium">Raised By</label><Input type="email" value={form.raised_by} onChange={(e) => setForm({ ...form, raised_by: e.target.value })} placeholder="Email" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Priority</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option></select></div><div><label className="text-sm font-medium">Issue Type</label><Input value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })} placeholder="Bug, Feature..." /></div></div>
          <div><label className="text-sm font-medium">Description</label><textarea className="w-full h-24 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
