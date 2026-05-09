"use client";

import { useState, useEffect, useMemo } from "react";
import {
  listMaterialRequests,
  createMaterialRequest,
  type ClientSafeMaterialRequest,
} from "@/app/dashboard/erp/material-requests/actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  PackageCheck,
  XCircle,
  Search,
  Plus,
  User,
  FolderKanban,
  Wand2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useActionDispatcher, defineAction } from "@/store/useActionDispatcher";

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    badge: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  fulfilled: {
    label: "Fulfilled",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    icon: PackageCheck,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
};

interface MaterialRequestsClientProps {
  initialRequests: ClientSafeMaterialRequest[];
}

export default function MaterialRequestsClient({
  initialRequests,
}: MaterialRequestsClientProps) {
  const [requests, setRequests] =
    useState<ClientSafeMaterialRequest[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requested_by: "",
    project_id: "",
    purpose: "",
  });

  // Register AI UI actions for this page
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    registerActions(
      [
        defineAction({
          name: "create_material_request",
          description: "Open and fill the create material request form with the provided details. Opens dialog and fills all fields in one shot.",
          parameters: {
            type: "object",
            required: ["purpose"],
            properties: {
              requested_by: { type: "string", description: "Name of the requester" },
              project_id: { type: "string", description: "Project ID" },
              purpose: { type: "string", description: "Purpose of the request (required)" },
            },
          },
        }),
        defineAction({
          name: "set_material_request_search",
          description: "Filter the material request list by search term",
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
        create_material_request: (args: Record<string, unknown>) => {
          const a = args as Record<string, string | undefined>;
          setDialogOpen(true);
          setForm((prev) => ({
            ...prev,
            requested_by: a.requested_by || prev.requested_by,
            project_id: a.project_id || prev.project_id,
            purpose: a.purpose || prev.purpose,
          }));
          toast.info("AI opened and filled the material request form", { icon: <Wand2 size={14} /> });
        },
        set_material_request_search: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          setSearch(a.term);
          toast.info(`AI filtered material requests by "${a.term}"`, { icon: <Sparkles size={14} /> });
        },
      }
    );
    return () => unregisterActions();
  }, [registerActions, unregisterActions]);

  // AI page context
  const contextSummary =
    requests.length > 0
      ? `Material Requests page: ${requests.length} requests. Status: ${requests.filter((r) => r.status === "pending").length} pending, ${requests.filter((r) => r.status === "approved").length} approved, ${requests.filter((r) => r.status === "fulfilled").length} fulfilled, ${requests.filter((r) => r.status === "cancelled").length} cancelled.`
      : "Material Requests page: No requests found.";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const res = await listMaterialRequests();
      if (res.success) setRequests(res.requests);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createMaterialRequest({
      requested_by: form.requested_by,
      project_id: form.project_id || undefined,
      purpose: form.purpose || undefined,
    });
    if (result.success) {
      toast.success("Material request created");
      setDialogOpen(false);
      setForm({ requested_by: "", project_id: "", purpose: "" });
      load();
    } else {
      toast.error(result.error || "Failed to create material request");
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter((r) => {
      const matchesSearch =
        !q ||
        (r.request_number || "").toLowerCase().includes(q) ||
        (r.requested_by || "").toLowerCase().includes(q) ||
        (r.purpose || "").toLowerCase().includes(q) ||
        (r.project_id || "").toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [requests, search]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    };
  }, [requests]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">
                Material Requests
              </h2>
              <p className="text-sm text-[#64748b] mt-1">
                {requests.length} total requests
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"
            >
              <Plus size={16} /> New Request
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search by MR number, requestor, or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Total
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {stats.total}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-amber-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Pending
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {stats.pending}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Approved
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {stats.approved}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <PackageCheck size={16} className="text-blue-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">
                  Fulfilled
                </span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">
                {stats.fulfilled}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <ClipboardList size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No material requests found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        MR Number
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        Item
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        Project
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        Requested By
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((r) => {
                      const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                      const StatusIcon = cfg.icon;
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[#1e3a5f] font-semibold">
                            {r.request_number}
                          </td>
                          <td className="px-4 py-3 text-[#0f172a]">
                            {r.purpose || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#64748b]">
                              <FolderKanban size={12} />
                              {r.project_id ? (
                                <span className="font-mono text-xs">
                                  {r.project_id.slice(0, 8)}...
                                </span>
                              ) : (
                                "—"
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#64748b]">
                              <User size={12} />
                              {r.requested_by}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}
                            >
                              <StatusIcon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">
                            {new Date(r.created_at).toLocaleDateString()}
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

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Material Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                Requested By <span className="text-red-500">*</span>
              </label>
              <Input
                required
                value={form.requested_by}
                onChange={(e) =>
                  setForm({ ...form, requested_by: e.target.value })
                }
                placeholder="e.g. John Smith"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Project ID</label>
              <Input
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
                placeholder="Optional project reference"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Purpose / Item</label>
              <Input
                value={form.purpose}
                onChange={(e) =>
                  setForm({ ...form, purpose: e.target.value })
                }
                placeholder="e.g. ROV spare parts"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                {saving ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
