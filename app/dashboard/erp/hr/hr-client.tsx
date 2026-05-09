"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPersonnel, type ClientSafePersonnel } from "@/app/dashboard/erp/hr/actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Users, CheckCircle, AlertTriangle, XCircle,
  Search, Plus, Download, Wand2, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";
import { useActionDispatcher, defineAction } from "@/store/useActionDispatcher";

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

interface HRClientProps {
  initialPersonnel: ClientSafePersonnel[];
}

export default function HRClient({ initialPersonnel }: HRClientProps) {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<ClientSafePersonnel[]>(initialPersonnel);
  const [search, setSearch] = useState("");
  const [activeDept, setActiveDept] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", first_name: "", last_name: "", email: "",
    designation: "", department: "", day_rate: "",
  });

  // Register AI UI actions for this page
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    registerActions(
      [
        defineAction({
          name: "create_personnel",
          description: "Open and fill the create personnel form with the provided details. Opens dialog and fills all fields in one shot.",
          parameters: {
            type: "object",
            required: ["first_name", "last_name", "designation"],
            properties: {
              employee_id: { type: "string", description: "Employee ID" },
              first_name: { type: "string", description: "First name (required)" },
              last_name: { type: "string", description: "Last name (required)" },
              email: { type: "string", description: "Email address" },
              designation: { type: "string", description: "Designation/role (required)" },
              department: { type: "string", description: "Department", enum: ["marine_operations", "engineering", "hse", "finance", "hr", "logistics", "management", "other"] },
              day_rate: { type: "number", description: "Day rate in AED" },
            },
          },
        }),
        defineAction({
          name: "set_personnel_search",
          description: "Filter the personnel list by search term",
          parameters: {
            type: "object",
            required: ["term"],
            properties: {
              term: { type: "string", description: "Search term to filter by" },
            },
          },
        }),
      ],
      {
        create_personnel: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          setDialogOpen(true);
          setForm((prev) => ({
            ...prev,
            employee_id: a.employee_id || prev.employee_id,
            first_name: a.first_name || prev.first_name,
            last_name: a.last_name || prev.last_name,
            email: a.email || prev.email,
            designation: a.designation || prev.designation,
            department: a.department || prev.department,
            day_rate: a.day_rate != null ? String(a.day_rate) : prev.day_rate,
          }));
          toast.info("AI opened and filled the personnel form", { icon: <Wand2 size={14} /> });
        },
        set_personnel_search: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          setSearch(a.term);
          toast.info(`AI filtered personnel by "${a.term}"`, { icon: <Sparkles size={14} /> });
        },
      }
    );
    return () => unregisterActions();
  }, [registerActions, unregisterActions]);

  // AI page context
  const contextSummary = personnel.length > 0
    ? `HR page: ${personnel.length} personnel. Departments: ${[...new Set(personnel.map(p => p.department).filter(Boolean))].slice(0, 5).join(", ")}. Active: ${personnel.filter(p => p.status === "ACTIVE").length}.`
    : "HR page: No personnel loaded.";
  usePageContext(contextSummary);

  const load = async () => {
    const { listPersonnel } = await import("@/app/dashboard/erp/hr/actions");
    try {
      const result = await listPersonnel();
      if (result.success) setPersonnel(result.personnel);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createPersonnel({
      employee_id: form.employee_id,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || undefined,
      designation: form.designation || undefined,
      department: form.department || undefined,
      day_rate: form.day_rate ? parseFloat(form.day_rate) : undefined,
    });
    if (result.success) {
      toast.success("Personnel created");
      setDialogOpen(false);
      setForm({ employee_id: "", first_name: "", last_name: "", email: "", designation: "", department: "", day_rate: "" });
      load();
    } else {
      toast.error(result.error || "Failed to create personnel");
    }
    setSaving(false);
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
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(p => ({ first_name: p.first_name, last_name: p.last_name, email: p.email, designation: p.designation, department: p.department, status: p.status })), 'hr-personnel')}>
                <Download size={16} /> Export CSV
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
                <Plus size={16} /> Add Personnel
              </Button>
            </div>
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
                onClick={() => setActiveDept(dept || "")}
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
                      const deptColor = DEPARTMENT_COLORS[(p.department ?? "")] || "bg-gray-100 text-gray-700 border-gray-200";
                      const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
                      return (
                        <tr key={p.id} onClick={() => router.push(`/dashboard/erp/hr/${p.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-[10px] font-bold text-[#1e3a5f]">
                                {getInitials(p.first_name, p.last_name ?? undefined)}
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
