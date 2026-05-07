"use client";

import { useState, useEffect, useMemo } from "react";
import { listAssets, createAsset, type ClientSafeAsset } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Wrench, CheckCircle, AlertTriangle, XCircle,
  Search, Package, Plus, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_COLORS: Record<string, string> = {
  ROV: "bg-blue-100 text-blue-700 border-blue-200",
  NDT: "bg-purple-100 text-purple-700 border-purple-200",
  Crane: "bg-orange-100 text-orange-700 border-orange-200",
  Diving: "bg-teal-100 text-teal-700 border-teal-200",
  Survey: "bg-green-100 text-green-700 border-green-200",
  Communication: "bg-gray-100 text-gray-700 border-gray-200",
  "Marine Equipment": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Safety Equipment": "bg-red-100 text-red-700 border-red-200",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; icon: React.ElementType }> = {
  available: { label: "Available", badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", icon: CheckCircle },
  active: { label: "In Use", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500", icon: Package },
  maintenance: { label: "Maintenance", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", icon: AlertTriangle },
  retired: { label: "Retired", badge: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-500", icon: XCircle },
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<ClientSafeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_name: "", asset_code: "", asset_category: "", location: "",
    purchase_cost: "", calibration_date: "", next_calibration_date: "",
  });

  // AI page context
  const contextSummary = assets.length > 0
    ? `Assets page: ${assets.length} total assets. Categories: ${[...new Set(assets.map(a => a.asset_category).filter(Boolean))].slice(0, 5).join(", ")}. Status: ${assets.filter(a => a.status === "AVAILABLE").length} available, ${assets.filter(a => a.status === "IN_USE").length} in use.`
    : "Assets page: Loading...";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const result = await listAssets();
      if (result.success) setAssets(result.assets);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createAsset({
      asset_name: form.asset_name,
      asset_code: form.asset_code,
      asset_category: form.asset_category,
      location: form.location || undefined,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : undefined,
      calibration_date: form.calibration_date ? new Date(form.calibration_date) : undefined,
      next_calibration_date: form.next_calibration_date ? new Date(form.next_calibration_date) : undefined,
    });
    if (result.success) {
      toast.success("Asset created");
      setDialogOpen(false);
      setForm({ asset_name: "", asset_code: "", asset_category: "", location: "", purchase_cost: "", calibration_date: "", next_calibration_date: "" });
      load();
    } else {
      toast.error(result.error || "Failed to create asset");
    }
    setSaving(false);
  };

  const categories = useMemo(() => {
    const cats = new Set(assets.map((a) => a.asset_category).filter(Boolean));
    return ["All", ...Array.from(cats)];
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const matchesCat = activeCategory === "All" || a.asset_category === activeCategory;
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (a.asset_name || "").toLowerCase().includes(q) ||
        (a.asset_code || "").toLowerCase().includes(q) ||
        (a.asset_category || "").toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [assets, activeCategory, search]);

  const stats = useMemo(() => {
    const base = activeCategory === "All" ? assets : filtered;
    return {
      total: base.length,
      available: base.filter((a) => a.status === "available").length,
      active: base.filter((a) => a.status === "active").length,
      maintenance: base.filter((a) => a.status === "maintenance").length,
    };
  }, [assets, filtered, activeCategory]);

  if (loading) return <AssetsSkeleton />;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Assets & Equipment</h2>
              <p className="text-sm text-[#64748b] mt-1">
                {activeCategory === "All" ? `${assets.length} total assets` : `${filtered.length} ${activeCategory} assets`}
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Asset
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-[#64748b] hover:bg-gray-200"}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Wrench size={16} className="text-[#64748b]" /><span className="text-xs font-medium text-[#64748b] uppercase">Total</span></div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.total}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2"><CheckCircle size={16} className="text-green-500" /><span className="text-xs font-medium text-[#64748b] uppercase">Available</span></div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.available}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Package size={16} className="text-blue-500" /><span className="text-xs font-medium text-[#64748b] uppercase">In Use</span></div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.active}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-500" /><span className="text-xs font-medium text-[#64748b] uppercase">Maintenance</span></div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.maintenance}</p>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Wrench size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No assets found</p>
                <p className="text-sm">Try a different filter or search term</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Asset</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Code</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Category</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Location</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((a) => {
                      const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.available;
                      const StatusIcon = cfg.icon;
                      const catColor = CATEGORY_COLORS[a.asset_category] || "bg-gray-100 text-gray-700 border-gray-200";
                      return (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3"><p className="font-medium text-[#0f172a]">{a.asset_name}</p></td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{a.asset_code}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${catColor}`}>{a.asset_category}</span></td>
                          <td className="px-4 py-3 text-[#64748b]">{a.location || "—"}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}><StatusIcon size={12} />{cfg.label}</span></td>
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

      {/* Add Asset Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Asset</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className="text-sm font-medium">Asset Name</label><Input required value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Asset Code</label><Input required value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Category</label><Input required value={form.asset_category} onChange={(e) => setForm({ ...form, asset_category: e.target.value })} placeholder="e.g. ROV, NDT, Crane" /></div>
            <div><label className="text-sm font-medium">Location</label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Purchase Cost</label><Input type="number" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Calib. Date</label><Input type="date" value={form.calibration_date} onChange={(e) => setForm({ ...form, calibration_date: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Next Calib.</label><Input type="date" value={form.next_calibration_date} onChange={(e) => setForm({ ...form, next_calibration_date: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Asset"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetsSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-44 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
          {/* Search */}
          <Skeleton className="h-10 w-full rounded-xl" />
          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          {/* Stat cards - 4 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>
          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Asset','Code','Category','Location','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3"><Skeleton className="h-4 w-16" /></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array(4).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
