"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Plus, Search, ChevronLeft, ChevronRight, Eye, Anchor, CalendarDays, RefreshCw } from "lucide-react";


export default function VesselsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  const filtered = items.filter(v => {
    const matchSearch = !search || v.vessel_name.toLowerCase().includes(search.toLowerCase()) || v.vessel_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filter || v.status === filter;
    return matchSearch && matchStatus;
  });

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true); setError("");
    try {
      const res = await apiFetch(`/marine/vessels`);
      setItems(res.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load vessels");
      setItems([]);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Vessel Register</h1>
          <p className="text-sm text-muted-foreground">Fleet management — {filtered.length} vessels</p>
        </div>
        <a href="/marine/vessels/new" className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Vessel
        </a>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vessels..."
            className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Decommissioned">Decommissioned</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadItems} className="flex items-center gap-1 underline hover:no-underline">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {loading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-3 py-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">No vessels found</p>
            <button onClick={loadItems} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        ) : (
          filtered.map((v) => (

          <div key={v.id} className="bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{v.vessel_name}</h3>
                  <p className="text-xs text-muted-foreground">{v.vessel_code} · {v.imo_number}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(v.status)}`}>{v.status}</span>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Type</span><span className="font-medium text-foreground">{v.vessel_type}</span></div>
              <div className="flex justify-between"><span>Flag</span><span className="font-medium">{v.flag}</span></div>
              <div className="flex justify-between"><span>Length</span><span className="font-medium">{v.length_m}m</span></div>
              <div className="flex justify-between"><span>Speed</span><span className="font-medium">{v.max_speed} knots</span></div>
              <div className="flex justify-between"><span>Location</span><span className="font-medium text-right max-w-[150px] truncate">{v.current_location}</span></div>
              <div className="flex justify-between items-center pt-1 border-t border-border mt-2">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Next inspection</span>
                <span className={`font-medium ${new Date(v.next_inspection_date) < new Date() ? "text-yellow-600" : "text-green-600"}`}>
                  {formatDate(v.next_inspection_date)}
                </span>
              </div>
            </div>
          </div>
        ))}
        )}
      </div>
    </div>
  );
}
