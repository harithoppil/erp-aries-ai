"use client";

import { useState, useEffect, useMemo } from "react";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import {
  FolderKanban, CheckCircle, Clock, PauseCircle, Search,
  MapPin, DollarSign, Plus, ListTodo, User, CheckSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  active: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  planning: { label: "Planning", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  completed: { label: "Completed", badge: "bg-gray-100 text-gray-700 border-gray-200", icon: CheckCircle },
  on_hold: { label: "On Hold", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: PauseCircle },
};

const TYPE_COLORS: Record<string, string> = {
  "Offshore Survey": "bg-blue-100 text-blue-700 border-blue-200",
  "ROV Operations": "bg-purple-100 text-purple-700 border-purple-200",
  "NDT Inspection": "bg-teal-100 text-teal-700 border-teal-200",
  "Diving Support": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Crane Operations": "bg-orange-100 text-orange-700 border-orange-200",
  "Marine": "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_name: "", project_type: "", customer_name: "",
    project_location: "", vessel_name: "", estimated_cost: "", day_rate: "",
    expected_start: "", expected_end: "",
  });
  const [activeTab, setActiveTab] = useState<"projects" | "tasks">("projects");
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    project_id: "", subject: "", description: "", assigned_to: "", start_date: "", end_date: "",
  });
  const [taskSaving, setTaskSaving] = useState(false);

  const load = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        throttledFetch(`${API_BASE}/erp/projects`),
        throttledFetch(`${API_BASE}/erp/tasks`),
      ]);
      if (pRes.ok) setProjects(unwrapPaginated(await pRes.json()));
      if (tRes.ok) setTasks(unwrapPaginated(await tRes.json()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await throttledFetch(`${API_BASE}/erp/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : undefined,
          day_rate: form.day_rate ? parseFloat(form.day_rate) : undefined,
        }),
      });
      if (res.ok) {
        toast.success("Project created");
        setDialogOpen(false);
        setForm({ project_name: "", project_type: "", customer_name: "", project_location: "", vessel_name: "", estimated_cost: "", day_rate: "", expected_start: "", expected_end: "" });
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create project");
      }
    } catch (e) {
      toast.error("Network error");
    } finally { setSaving(false); }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskSaving(true);
    try {
      const res = await throttledFetch(`${API_BASE}/erp/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskForm),
      });
      if (res.ok) {
        toast.success("Task created");
        setTaskDialogOpen(false);
        setTaskForm({ project_id: "", subject: "", description: "", assigned_to: "", start_date: "", end_date: "" });
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create task");
      }
    } catch (e) {
      toast.error("Network error");
    } finally { setTaskSaving(false); }
  };

  const statuses = useMemo(() => {
    const sts = new Set(projects.map((p) => p.status).filter(Boolean));
    return ["All", ...Array.from(sts)];
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesStatus = activeStatus === "All" || p.status === activeStatus;
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (p.project_name || "").toLowerCase().includes(q) ||
        (p.project_code || "").toLowerCase().includes(q) ||
        (p.customer_name || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [projects, activeStatus, search]);

  const stats = useMemo(() => {
    const base = activeStatus === "All" ? projects : filtered;
    return {
      total: base.length,
      active: base.filter((p) => p.status === "active").length,
      planning: base.filter((p) => p.status === "planning").length,
      completed: base.filter((p) => p.status === "completed").length,
    };
  }, [projects, filtered, activeStatus]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading projects...</div>
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
              <h2 className="text-2xl font-bold text-[#0f172a]">Projects &amp; Operations</h2>
              <p className="text-sm text-[#64748b] mt-1">
                {activeStatus === "All"
                  ? `${projects.length} total projects`
                  : `${filtered.length} ${activeStatus} projects`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setTaskDialogOpen(true)} variant="outline" className="gap-2 rounded-xl">
                <ListTodo size={16} /> Add Task
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
                <Plus size={16} /> Add Project
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search projects by name, code, or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setActiveStatus(st)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeStatus === st
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FolderKanban size={16} className="text-[#64748b]" />
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
                <Clock size={16} className="text-blue-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Planning</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.planning}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-gray-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Completed</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.completed}</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "projects" ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "tasks" ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
              }`}
            >
              Tasks ({tasks.length})
            </button>
          </div>

          {/* Projects Table Card */}
          {activeTab === "projects" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <FolderKanban size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No projects found</p>
                <p className="text-sm">Try a different filter or search term</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Project</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Code</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Client</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Location</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Day Rate</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((p) => {
                      const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.planning;
                      const StatusIcon = cfg.icon;
                      const typeColor = TYPE_COLORS[p.project_type] || "bg-gray-100 text-gray-700 border-gray-200";
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{p.project_name}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{p.project_code}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${typeColor}`}>
                              {p.project_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{p.customer_name || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#64748b]">
                              <MapPin size={12} />
                              {p.project_location || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#0f172a] font-medium">
                              <DollarSign size={12} />
                              {p.day_rate?.toLocaleString() || "TBD"}
                            </div>
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
          )}

          {/* Tasks Table */}
          {activeTab === "tasks" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <ListTodo size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No tasks yet</p>
                <p className="text-sm">Tasks will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Task</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Project</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Assigned</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((t) => {
                      const statusCfg: Record<string, string> = {
                        todo: "bg-gray-100 text-gray-700 border-gray-200",
                        in_progress: "bg-blue-100 text-blue-700 border-blue-200",
                        review: "bg-amber-100 text-amber-700 border-amber-200",
                        done: "bg-green-100 text-green-700 border-green-200",
                      };
                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{t.subject}</p>
                            {t.description && <p className="text-xs text-[#94a3b8]">{t.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{projects.find((p) => p.id === t.project_id)?.project_name || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#64748b]">
                              <User size={12} />
                              {t.assigned_to || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${statusCfg[t.status] || statusCfg.todo}`}>
                              {t.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#0ea5e9] rounded-full" style={{ width: `${t.progress || 0}%` }} />
                            </div>
                            <span className="text-[10px] text-[#94a3b8]">{t.progress || 0}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Project</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={taskForm.project_id}
                onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
                required
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Subject *</label>
              <Input required value={taskForm.subject} onChange={(e) => setTaskForm({ ...taskForm, subject: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Assigned To</label>
              <Input value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })} placeholder="e.g. Troy Khan" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Start Date</label><Input type="date" value={taskForm.start_date} onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })} /></div>
              <div><label className="text-sm font-medium">End Date</label><Input type="date" value={taskForm.end_date} onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={taskSaving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{taskSaving ? "Saving..." : "Create Task"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Project</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className="text-sm font-medium">Project Name</label><Input required value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Project Type</label><Input required value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} placeholder="e.g. Offshore Survey" /></div>
              <div><label className="text-sm font-medium">Client Name</label><Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Location</label><Input value={form.project_location} onChange={(e) => setForm({ ...form, project_location: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Vessel</label><Input value={form.vessel_name} onChange={(e) => setForm({ ...form, vessel_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Est. Cost</label><Input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Day Rate</label><Input type="number" value={form.day_rate} onChange={(e) => setForm({ ...form, day_rate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Start Date</label><Input type="date" value={form.expected_start} onChange={(e) => setForm({ ...form, expected_start: e.target.value })} /></div>
              <div><label className="text-sm font-medium">End Date</label><Input type="date" value={form.expected_end} onChange={(e) => setForm({ ...form, expected_end: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Project"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
