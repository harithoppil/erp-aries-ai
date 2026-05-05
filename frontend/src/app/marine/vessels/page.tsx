"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Plus, Search, ChevronLeft, ChevronRight, Eye, Anchor, CalendarDays } from "lucide-react";

const DEMO_VESSELS = [
  {"id":"1","vessel_name":"ARIES DP-1","vessel_code":"ARS-001","vessel_type":"DP Vessel","imo_number":"9612345","flag":"UAE","status":"Active","current_location":"Zayed Port, Abu Dhabi","last_inspection_date":"2026-01-15","next_inspection_date":"2026-07-15","length_m":85,"max_speed":14},
  {"id":"2","vessel_name":"ARIES DIVER","vessel_code":"ARS-002","vessel_type":"Dive Support Vessel","imo_number":"9612346","flag":"UAE","status":"Active","current_location":"Upper Zakum Field","last_inspection_date":"2026-02-20","next_inspection_date":"2026-08-20","length_m":62,"max_speed":12},
  {"id":"3","vessel_name":"ARIES TUG-7","vessel_code":"ARS-007","vessel_type":"Anchor Handling Tug","imo_number":"9612351","flag":"UAE","status":"Maintenance","current_location":"Jebel Ali Dry Dock","last_inspection_date":"2025-12-01","next_inspection_date":"2026-06-01","length_m":45,"max_speed":10},
  {"id":"4","vessel_name":"ARIES CREW-3","vessel_code":"ARS-003","vessel_type":"Crew Boat","imo_number":"9612347","flag":"UAE","status":"Active","current_location":"Das Island","last_inspection_date":"2026-03-10","next_inspection_date":"2026-09-10","length_m":32,"max_speed":22},
  {"id":"5","vessel_name":"ARIES BARGE-5","vessel_code":"ARS-005","vessel_type":"Flat Top Barge","imo_number":"9612349","flag":"Marshall Islands","status":"Active","current_location":"Zirku Island","last_inspection_date":"2026-01-28","next_inspection_date":"2026-07-28","length_m":120,"max_speed":0},
];

export default function VesselsPage() {
  const [items, setItems] = useState<any[]>(DEMO_VESSELS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  const filtered = items.filter(v => {
    const matchSearch = !search || v.vessel_name.toLowerCase().includes(search.toLowerCase()) || v.vessel_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filter || v.status === filter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Vessel Register</h1>
          <p className="text-sm text-gray-500">Fleet management — {filtered.length} vessels</p>
        </div>
        <a href="/marine/vessels/new" className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-[#B08D2F] text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Vessel
        </a>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vessels..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold/50">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Decommissioned">Decommissioned</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map((v) => (
          <div key={v.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy text-sm">{v.vessel_name}</h3>
                  <p className="text-xs text-gray-500">{v.vessel_code} · {v.imo_number}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(v.status)}`}>{v.status}</span>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between"><span>Type</span><span className="font-medium text-navy">{v.vessel_type}</span></div>
              <div className="flex justify-between"><span>Flag</span><span className="font-medium">{v.flag}</span></div>
              <div className="flex justify-between"><span>Length</span><span className="font-medium">{v.length_m}m</span></div>
              <div className="flex justify-between"><span>Speed</span><span className="font-medium">{v.max_speed} knots</span></div>
              <div className="flex justify-between"><span>Location</span><span className="font-medium text-right max-w-[150px] truncate">{v.current_location}</span></div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-100 mt-2">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Next inspection</span>
                <span className={`font-medium ${new Date(v.next_inspection_date) < new Date("2026-06-01") ? "text-warning" : "text-success"}`}>
                  {formatDate(v.next_inspection_date)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
