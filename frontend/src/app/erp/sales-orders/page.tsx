"use client";

import { useState, useEffect, useMemo } from "react";
import { listSalesOrders, createSalesOrder } from "./actions";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Package, Search, Plus, X, DollarSign, Calendar, CheckCircle,
  Clock, Truck, FileText, XCircle, TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  to_deliver: { label: "To Deliver", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Truck },
  to_bill: { label: "To Bill", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: DollarSign },
  completed: { label: "Completed", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  cancelled: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

interface SOItem {
  description: string;
  quantity: string;
  rate: string;
  item_code: string;
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: "", customer_name: "", project_type: "",
    quotation_id: "", tax_rate: "5", delivery_date: "", notes: "",
  });
  const [items, setItems] = useState<SOItem[]>([{ description: "", quantity: "1", rate: "", item_code: "" }]);

  // AI page context
  const contextSummary = orders.length > 0
    ? `Sales Orders page: ${orders.length} orders. Total value: AED ${orders.reduce((s, o) => s + (o.total || 0), 0).toLocaleString()}. Status: ${orders.filter(o => o.status === "DRAFT").length} draft, ${orders.filter(o => o.status === "TO_DELIVER").length} to deliver, ${orders.filter(o => o.status === "COMPLETED").length} completed.`
    : "Sales Orders page: Loading...";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const [oRes, cRes, qRes] = await Promise.all([
        listSalesOrders(),
        throttledFetch(`${API_BASE}/erp/customers`),
        throttledFetch(`${API_BASE}/erp/quotations`),
      ]);
      if (oRes.success) setOrders(oRes.orders);
      if (cRes.ok) setCustomers(unwrapPaginated(await cRes.json()));
      if (qRes.ok) setQuotations(unwrapPaginated(await qRes.json()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { description: "", quantity: "1", rate: "", item_code: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof SOItem, value: string) => {
    const next = [...items];
    next[idx][field] = value;
    setItems(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createSalesOrder({
      customer_id: form.customer_id || undefined,
      customer_name: form.customer_name,
      project_type: form.project_type || undefined,
      quotation_id: form.quotation_id || undefined,
      tax_rate: parseFloat(form.tax_rate),
      delivery_date: form.delivery_date ? new Date(form.delivery_date) : undefined,
      notes: form.notes || undefined,
      items: items.filter((i) => i.description && i.rate).map((i) => ({
        description: i.description,
        quantity: parseInt(i.quantity) || 1,
        rate: parseFloat(i.rate),
        item_code: i.item_code || undefined,
      })),
    });
    if (result.success) {
      toast.success("Sales order created");
      setDialogOpen(false);
      setForm({ customer_id: "", customer_name: "", project_type: "", quotation_id: "", tax_rate: "5", delivery_date: "", notes: "" });
      setItems([{ description: "", quantity: "1", rate: "", item_code: "" }]);
      load();
    } else {
      toast.error(result.error || "Failed to create sales order");
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.project_type || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      totalValue: orders.reduce((s, o) => s + (o.total || 0), 0),
      toDeliver: orders.filter((o) => o.status === "to_deliver").length,
      toBill: orders.filter((o) => o.status === "to_bill").length,
      completed: orders.filter((o) => o.status === "completed").length,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading sales orders...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Sales Orders</h2>
              <p className="text-sm text-[#64748b] mt-1">{orders.length} total orders</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> New Sales Order
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search orders by number, customer, or project type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={Package} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={TrendingUp} label="Total Value" value={`AED ${stats.totalValue.toLocaleString()}`} color="text-blue-600" />
            <StatCard icon={Truck} label="To Deliver" value={stats.toDeliver} color="text-blue-600" />
            <StatCard icon={DollarSign} label="To Bill" value={stats.toBill} color="text-amber-600" />
            <StatCard icon={CheckCircle} label="Completed" value={stats.completed} color="text-green-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Package size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No sales orders found</p>
                <p className="text-sm">Create your first sales order to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Order</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Customer</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Project Type</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Delivery</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Total</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((o) => {
                      const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.draft;
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{o.order_number}</p>
                            {o.notes && <p className="text-xs text-[#94a3b8] truncate max-w-[200px]">{o.notes}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{o.customer_name}</td>
                          <td className="px-4 py-3 text-[#64748b]">{o.project_type || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#64748b]">
                              <Calendar size={12} />
                              {o.delivery_date ? new Date(o.delivery_date).toLocaleDateString() : "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[#0f172a] font-medium">
                              <DollarSign size={12} />
                              {o.total?.toLocaleString()}
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
        </div>
      </div>

      {/* New Sales Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Order</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Customer</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.customer_id}
                  onChange={(e) => {
                    const cid = e.target.value;
                    const cust = customers.find((c) => c.id === cid);
                    setForm({ ...form, customer_id: cid, customer_name: cust?.customer_name || "" });
                  }}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.customer_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Or Enter Name</label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required={!form.customer_id} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">From Quotation</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.quotation_id}
                  onChange={(e) => {
                    const qid = e.target.value;
                    const q = quotations.find((qt) => qt.id === qid);
                    if (q) {
                      setForm({ ...form, quotation_id: qid, customer_name: q.customer_name, project_type: q.project_type || "" });
                    } else {
                      setForm({ ...form, quotation_id: qid });
                    }
                  }}
                >
                  <option value="">None</option>
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>{q.quotation_number} — {q.customer_name}</option>
                  ))}
                </select>
              </div>
              <div><label className="text-sm font-medium">Project Type</label><Input value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Delivery Date</label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Tax Rate (%)</label><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
            </div>

            {/* Items */}
            <div>
              <label className="text-sm font-medium">Line Items</label>
              <div className="space-y-2 mt-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-5"><Input placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} /></div>
                    <div className="col-span-2"><Input placeholder="Qty" type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} /></div>
                    <div className="col-span-3"><Input placeholder="Rate (AED)" type="number" value={item.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} /></div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-sm font-medium text-[#0f172a]">AED {((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toLocaleString()}</span>
                      {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>}
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2">+ Add Item</Button>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Subtotal</span>
                <span className="font-medium">AED {items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[#64748b]">Tax ({form.tax_rate}%)</span>
                <span className="font-medium">AED {(items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0) * (parseFloat(form.tax_rate) || 0) / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-[#0f172a]">AED {(items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0) * (1 + (parseFloat(form.tax_rate) || 0) / 100)).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Sales Order"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs font-medium text-[#64748b] uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
