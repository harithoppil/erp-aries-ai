"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listTimesheets, createTimesheet, type ClientSafeTimesheet } from "./actions";
import { listProjects, type ClientSafeProject } from "@/app/erp/projects/actions";
import { listPersonnel, type ClientSafePersonnel } from "@/app/erp/hr/actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Clock, Search, Plus, Calendar, Briefcase, User, CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TimesheetsClient({ initialTimesheets }: { initialTimesheets: ClientSafeTimesheet[] }) {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<ClientSafeTimesheet[]>(initialTimesheets);
  const [projects, setProjects] = useState<ClientSafeProject[]>([]);
  const [personnel, setPersonnel] = useState<ClientSafePersonnel[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_id: "", personnel_id: "", date: "", hours: "8", activity_type: "", description: "", billable: true,
  });

  // AI page context
  const contextSummary = timesheets.length > 0
    ? `Timesheets page: ${timesheets.length} entries, ${timesheets.reduce((s, t) => s + (t.hours || 0), 0)} total hours. Billable: ${timesheets.filter(t => t.billable).reduce((s, t) => s + (t.hours || 0), 0)} hours.`
    : "Timesheets page: Loading...";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const [tRes, pRes, perRes] = await Promise.all([
        listTimesheets(),
        listProjects(),
        listPersonnel(),
      ]);
      if (tRes.success) setTimesheets(tRes.timesheets);
      if (pRes.success) setProjects(pRes.projects);
      if (perRes.success) setPersonnel(perRes.personnel);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createTimesheet({
      project_id: form.project_id,
      personnel_id: form.personnel_id,
      date: new Date(form.date),
      hours: parseFloat(form.hours) || 8,
      activity_type: form.activity_type,
      description: form.description || undefined,
      billable: form.billable,
    });
    if (result.success) {
      toast.success("Timesheet entry created");
      setDialogOpen(false);
      setForm({ project_id: "", personnel_id: "", date: "", hours: "8", activity_type: "", description: "", billable: true });
      load();
    } else {
      toast.error(result.error || "Failed to create timesheet");
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    if (!search) return timesheets;
    const q = search.toLowerCase();
    return timesheets.filter((t) =>
      (t.description || "").toLowerCase().includes(q) ||
      (t.activity_type || "").toLowerCase().includes(q)
    );
  }, [timesheets, search]);

  const stats = useMemo(() => ({
    totalHours: timesheets.reduce((s, t) => s + (t.hours || 0), 0),
    billableHours: timesheets.filter((t) => t.billable).reduce((s, t) => s + (t.hours || 0), 0),
    count: timesheets.length,
  }), [timesheets]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Timesheets</h2>
              <p className="text-sm text-[#64748b] mt-1">{timesheets.length} entries · {stats.totalHours} total hours</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Entry
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search timesheets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Total Hours</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.totalHours}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Billable</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.billableHours}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={16} className="text-[#0ea5e9]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Entries</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.count}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Clock size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No timesheets yet</p>
                <p className="text-sm">Add your first timesheet entry</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Activity</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Hours</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Billable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((t) => (
                      <tr key={t.id} onClick={() => router.push(`/erp/timesheets/${t.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-[#64748b]">
                          {t.date ? new Date(t.date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0f172a]">{t.activity_type || "—"}</p>
                          {t.description && <p className="text-xs text-[#94a3b8]">{t.description}</p>}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0f172a]">{t.hours}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            t.billable
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}>
                            {t.billable ? "Billable" : "Non-billable"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Timesheet Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Timesheet Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Project</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  required
                >
                  <option value="">Select...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Personnel</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.personnel_id}
                  onChange={(e) => setForm({ ...form, personnel_id: e.target.value })}
                  required
                >
                  <option value="">Select...</option>
                  {personnel.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Hours</label>
                <Input type="number" step="0.5" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Activity Type</label>
              <Input required value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })} placeholder="e.g. NDT Inspection, Rope Access" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={form.billable}
                onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="billable" className="text-sm">Billable hours</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">
                {saving ? "Saving..." : "Add Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
