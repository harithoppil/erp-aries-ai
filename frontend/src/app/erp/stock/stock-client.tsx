"use client";

import { useState, useMemo } from "react";
import { listItems, listWarehouses, listStockEntries, createStockEntry, type ClientSafeItem, type ClientSafeWarehouse, type ClientSafeStockEntry } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Package, CheckCircle, AlertTriangle, ShieldAlert,
  Search, Warehouse, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  "ROV Spares": "bg-blue-100 text-blue-700 border-blue-200",
  "NDT Consumables": "bg-purple-100 text-purple-700 border-purple-200",
  "Diving Equipment": "bg-teal-100 text-teal-700 border-teal-200",
  "Crane Spares": "bg-orange-100 text-orange-700 border-orange-200",
  Communication: "bg-gray-100 text-gray-700 border-gray-200",
  "Survey Equipment": "bg-green-100 text-green-700 border-green-200",
  "Marine Equipment": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Safety Equipment": "bg-red-100 text-red-700 border-red-200",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  adequate: { label: "Adequate", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  low: { label: "Low", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  critical: { label: "Critical", badge: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert },
};

interface StockClientProps {
  initialItems: ClientSafeItem[];
  initialWarehouses: ClientSafeWarehouse[];
  initialEntries: ClientSafeStockEntry[];
}

export default function StockClient({ initialItems, initialWarehouses, initialEntries }: StockClientProps) {
  const [items, setItems] = useState<ClientSafeItem[]>(initialItems);
  const [warehouses, setWarehouses] = useState<ClientSafeWarehouse[]>(initialWarehouses);
  const [entries, setEntries] = useState<ClientSafeStockEntry[]>(initialEntries);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    entry_type: "receipt", item_id: "", quantity: "",
    source_warehouse: "", target_warehouse: "", reference: "",
  });

  // AI page context
  const contextSummary = items.length > 0
    ? `Stock page: ${items.length} items across ${warehouses.length} warehouses. Categories: ${[...new Set(items.map(i => i.item_group).filter(Boolean))].slice(0, 5).join(", ")}.`
    : "Stock page: Loading...";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const [iRes, wRes, eRes] = await Promise.all([
        listItems(),
        listWarehouses(),
        listStockEntries(),
      ]);
      if (iRes.success) setItems(iRes.items);
      if (wRes.success) setWarehouses(wRes.warehouses);
      if (eRes.success) setEntries(eRes.entries);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createStockEntry({
      entry_type: form.entry_type,
      item_id: form.item_id,
      quantity: parseFloat(form.quantity),
      source_warehouse: form.source_warehouse || undefined,
      target_warehouse: form.target_warehouse || undefined,
      reference: form.reference || undefined,
    });
    if (result.success) {
      toast.success("Stock entry created");
      setDialogOpen(false);
      setForm({ entry_type: "receipt", item_id: "", quantity: "", source_warehouse: "", target_warehouse: "", reference: "" });
      load();
    } else {
      toast.error(result.error || "Failed to create stock entry");
    }
    setSaving(false);
  };

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.item_group).filter(Boolean));
    return ["All", ...Array.from(cats)];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const matchesCat = activeCategory === "All" || i.item_group === activeCategory;
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (i.item_name || "").toLowerCase().includes(q) ||
        (i.item_code || "").toLowerCase().includes(q) ||
        (i.item_group || "").toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [items, activeCategory, search]);

  const stats = useMemo(() => {
    const base = activeCategory === "All" ? items : filtered;
    return {
      totalItems: base.length,
      totalWarehouses: warehouses.length,
      totalValue: base.reduce((sum, i) => sum + (i.quantity || 0) * (i.unit_cost || 0), 0),
    };
  }, [items, filtered, activeCategory, warehouses]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Stock &amp; Inventory</h2>
              <p className="text-sm text-[#64748b] mt-1">
                {activeCategory === "All"
                  ? `${items.length} items across ${warehouses.length} warehouses`
                  : `${filtered.length} ${activeCategory} items`}
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Stock Entry
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search items by name, code, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Items</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.totalItems}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Warehouse size={16} className="text-[#0ea5e9]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Warehouses</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.totalWarehouses}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search size={16} className="text-green-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Stock Value</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.totalValue.toLocaleString()}</p>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Package size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No items found</p>
                <p className="text-sm">Try a different filter or search term</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Item</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Code</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Category</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Unit</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((i) => {
                      const catColor = CATEGORY_COLORS[i.item_group] || "bg-gray-100 text-gray-700 border-gray-200";
                      return (
                        <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{i.item_name}</p>
                            <p className="text-xs text-[#94a3b8]">{i.description || "—"}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{i.item_code}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${catColor}`}>
                              {i.item_group}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{i.unit || "Nos"}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#0f172a]">{i.quantity || 0}</span>
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

      {/* Add Stock Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Stock Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Entry Type</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={form.entry_type}
                onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
              >
                <option value="receipt">Receipt</option>
                <option value="delivery">Delivery</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Item</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={form.item_id}
                onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                required
              >
                <option value="">Select item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.item_name} ({i.item_code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input type="number" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Source Warehouse</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.source_warehouse}
                  onChange={(e) => setForm({ ...form, source_warehouse: e.target.value })}
                >
                  <option value="">None</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name || w.warehouse_code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Target Warehouse</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.target_warehouse}
                  onChange={(e) => setForm({ ...form, target_warehouse: e.target.value })}
                >
                  <option value="">None</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name || w.warehouse_code}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Reference</label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. PO-12345" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Entry"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
