"use client";

import { useState, useEffect, useMemo } from "react";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import {
  Users, CheckCircle, AlertTriangle, XCircle,
  Search, ShieldCheck, ShieldAlert, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const DEPARTMENT_COLORS: Record<string, string> = {
  Operations: "bg-[#1e3a5f] text-white",
  Engineering: "bg-blue-100 text-blue-700 border-blue-200",
  Sales: "bg-purple-100 text-purple-700 border-purple-200",
  Inspection: "bg-teal-100 text-teal-700 border-teal-200",
  Finance: "bg-green-100 text-green-700 border-green-200",
  HSE: "bg-red-100 text-red-700 border-red-200",
  Maintenance: "bg-amber-100 text-amber-700 border-amber-200",
  Projects: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Survey: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Procurement: "bg-orange-100 text-orange-700 border-orange-200",
  HR: "bg-pink-100 text-pink-700 border-pink-200",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  active: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  inactive: { label: "Inactive", badge: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
  on_leave: { label: "On Leave", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
};

function getInitials(first?: string, last?: string): string {
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();
}

export default function HRPage() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeDept, setActiveDept] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", first_name: "", last_name: "", email: "",
    designation: "", department: "", day_rate: "",
  });

  const load = async () => {
    try {
      const res = await throttledFetch(`${API_BASE}/erp/personnel`);
      if (res.ok) setPersonnel(unwrapPaginated(await res.json()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await throttledFetch(`${API_BASE}/erp/personnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          day_rate: form.day_rate ? parseFloat(form.day_rate) : undefined,
        }),
      });
      if (res.ok) {
        toast.success("Personnel created");
        setDialogOpen(false);
        setForm({ employee_id: "", first_name: "", last_name: "", email: "", designation: "", department: "", day_rate: "" });
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create personnel");
      }
    } catch (e) {
      toast.error("Network error");
    } finally { setSaving(false); }
  };

  const departments = useMemo(() => {
    const depts = new Set(personnel.map((p) => p.department).filter(Boolean));
    return ["All", ...Array.from(depts)];
  }, [personnel]);

  const filtered = useMemo(() => {
    return personnel.filter((p) => {
      const matchesDept = activeDept === "All" || p.department === activeDept;
      const q = search.toLowerCase();
      const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
      const matchesSearch = !q ||
        fullName.toLowerCase().includes(q) ||
        (p.designation || "").toLowerCase().includes(q) ||
        (p.department || "").toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [personnel, activeDept, search]);

  const stats = useMemo(() => {
    const base = activeDept === "All" ? personnel : filtered;
    return {
      total: base.length,
      active: base.filter((p) => p.status === "active").length,
      onLeave: base.filter((p) => p.status === "on_leave").length,
      inactive: base.filter((p) => p.status === "inactive").length,
    };
  }, [personnel, filtered, activeDept]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading personnel...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">HR &amp; Personnel</h2>
              <p className="text-sm text-[#64748b] mt-1">
                {activeDept === "All"
                  ? `${personnel.length} total personnel`
                  : `${filtered.length} in ${activeDept}`}
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Personnel
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search by name, designation, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Department Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeDept === dept
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Total</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.total}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Active</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.active}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">On Leave</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.onLeave}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} className="text-gray-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Inactive</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.inactive}</p>
            </div>
          </div>

          {/* Personnel Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Users size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No personnel found</p>
                <p className="text-sm">Try a different filter or search term</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Name</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Designation</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Department</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((p) => {
                      const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
                      const StatusIcon = cfg.icon;
                      const deptColor = DEPARTMENT_COLORS[p.department] || "bg-gray-100 text-gray-700 border-gray-200";
                      const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-[10px] font-bold text-[#1e3a5f]">
                                {getInitials(p.first_name, p.last_name)}
                              </div>
                              <div>
                                <p className="font-medium text-[#0f172a]">{fullName || "Unnamed"}</p>
                                <p className="text-xs text-[#94a3b8]">{p.email || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{p.designation || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${deptColor}`}>
                              {p.department || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}>
                              <StatusIcon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Personnel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Personnel</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Employee ID</label><Input required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Day Rate</label><Input type="number" value={form.day_rate} onChange={(e) => setForm({ ...form, day_rate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">First Name</label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Last Name</label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Designation</label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. NDT Inspector" /></div>
              <div><label className="text-sm font-medium">Department</label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Operations" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Personnel"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
