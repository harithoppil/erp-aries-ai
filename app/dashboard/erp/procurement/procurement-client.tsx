"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listSuppliers, listPurchaseOrders, createSupplier, type ClientSafeSupplier, type ClientSafePurchaseOrder } from "@/app/dashboard/erp/procurement/actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  ShoppingCart, Search, Truck, FileText, Plus, Download,
  Wand2, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";
import { useActionDispatcher, defineAction } from "@/store/useActionDispatcher";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  submitted: { label: "Submitted", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  received: { label: "Received", badge: "bg-green-100 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};

interface ProcurementClientProps {
  initialSuppliers: ClientSafeSupplier[];
  initialPurchaseOrders: ClientSafePurchaseOrder[];
}

export default function ProcurementClient({ initialSuppliers, initialPurchaseOrders }: ProcurementClientProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<ClientSafeSupplier[]>(initialSuppliers);
  const [orders, setOrders] = useState<ClientSafePurchaseOrder[]>(initialPurchaseOrders);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">("suppliers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", supplier_code: "" });

  // Register AI UI actions for this page
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    registerActions(
      [
        defineAction({
          name: "create_supplier",
          description: "Open and fill the create supplier form with the provided details. Opens dialog and fills all fields in one shot.",
          parameters: {
            type: "object",
            required: ["supplier_name", "supplier_code"],
            properties: {
              supplier_name: { type: "string", description: "Supplier name (required)" },
              supplier_code: { type: "string", description: "Unique supplier code (required)" },
            },
          },
        }),
        defineAction({
          name: "set_procurement_search",
          description: "Filter the procurement list by search term",
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
        create_supplier: (args: Record<string, unknown>) => {
          const a = args as Record<string, string | undefined>;
          setDialogOpen(true);
          setForm((prev) => ({
            ...prev,
            supplier_name: a.supplier_name || prev.supplier_name,
            supplier_code: a.supplier_code || prev.supplier_code,
          }));
          toast.info("AI opened and filled the supplier form", { icon: <Wand2 size={14} /> });
        },
        set_procurement_search: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          setSearch(a.term);
          toast.info(`AI filtered procurement by "${a.term}"`, { icon: <Sparkles size={14} /> });
        },
      }
    );
    return () => unregisterActions();
  }, [registerActions, unregisterActions]);

  // AI page context
  const contextSummary = suppliers.length > 0
    ? `Procurement page: ${suppliers.length} suppliers, ${orders.length} purchase orders. Categories: ${[...new Set(suppliers.map(s => s.category).filter(Boolean))].slice(0, 5).join(", ")}.`
    : "Procurement page: Loading...";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const [sRes, oRes] = await Promise.all([
        listSuppliers(),
        listPurchaseOrders(),
      ]);
      if (sRes.success) setSuppliers(sRes.suppliers);
      if (oRes.success) setOrders(oRes.orders);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createSupplier({
      supplier_name: form.supplier_name,
      supplier_code: form.supplier_code,
    });
    if (result.success) {
      toast.success("Supplier created");
      setDialogOpen(false);
      setForm({ supplier_name: "", supplier_code: "" });
      load();
    } else {
      toast.error(result.error || "Failed to create supplier");
    }
    setSaving(false);
  };

  const filteredSuppliers = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) =>
      (s.supplier_name || "").toLowerCase().includes(q) ||
      (s.supplier_code || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Procurement</h2>
              <p className="text-sm text-[#64748b] mt-1">{suppliers.length} suppliers · {orders.length} purchase orders</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(activeTab === "suppliers" ? filteredSuppliers.map(s => ({ supplier_name: s.supplier_name, supplier_code: s.supplier_code, category: s.category, email: s.email })) : orders.map(o => ({ po_number: o.po_number, supplier_name: o.supplier_name, status: o.status, total: o.total })), `procurement-${activeTab}`)}>
                <Download size={16} /> Export CSV
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
                <Plus size={16} /> Add Supplier
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Suppliers</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{suppliers.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-[#0ea5e9]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Purchase Orders</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{orders.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={16} className="text-amber-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Material Requests</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">0</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "suppliers" ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
              }`}
            >
              Suppliers
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "orders" ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
              }`}
            >
              Purchase Orders
            </button>
          </div>

          {/* Suppliers Table */}
          {activeTab === "suppliers" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {filteredSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                  <Truck size={48} className="mb-4 opacity-40" />
                  <p className="text-lg font-medium">No suppliers found</p>
                  <p className="text-sm">{search ? "Try a different search term" : "Suppliers will appear here"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">Supplier</th>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">Code</th>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">Category</th>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSuppliers.map((s) => (
                        <tr key={s.id} onClick={() => router.push(`/dashboard/erp/procurement/${s.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{s.supplier_name}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{s.supplier_code}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                              {s.category || "General"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{s.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Purchase Orders Table */}
          {activeTab === "orders" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                  <FileText size={48} className="mb-4 opacity-40" />
                  <p className="text-lg font-medium">No purchase orders yet</p>
                  <p className="text-sm">Orders will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">PO Number</th>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">Supplier</th>
                        <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                        <th className="text-right px-4 py-3 text-gray-700 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((o) => {
                        const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.draft;
                        return (
                          <tr key={o.id} onClick={() => router.push(`/dashboard/erp/procurement/${o.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{o.po_number || "—"}</td>
                            <td className="px-4 py-3 text-[#0f172a] font-medium">{o.supplier_name || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-[#0f172a]">AED {o.total?.toLocaleString() || 0}</td>
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

      {/* Add Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Supplier</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Supplier Name</label>
              <Input required value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Supplier Code</label>
              <Input required value={form.supplier_code} onChange={(e) => setForm({ ...form, supplier_code: e.target.value })} placeholder="e.g. SUP-001" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Supplier"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
