"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Plus, Search, UserCircle, RefreshCw } from "lucide-react";

export default function EmployeesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 20;

  useEffect(() => { loadItems(); }, [page, search]);

  async function loadItems() {
    setLoading(true); setError("");
    try {
      const res = await apiFetch(`/hr/employees?page=${page}&page_size=${pageSize}${search ? `&search=${search}` : ""}${dept ? `&department=${dept}` : ""}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load employees");
      setItems([]);
      setTotal(0);
    }
    setLoading(false);
  }

  const departments = [...new Set(items.map((e: any) => e.department))];
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        <a href="/hr/employees/new" className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Employee
        </a>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadItems} className="flex items-center gap-1 underline hover:no-underline">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employees..."
            className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background" />
        </div>
        <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted"><tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Department</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Designation</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Join Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">No employees found</p>
                <button onClick={loadItems} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </td></tr>
            ) : (
              items.map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3"><div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center"><UserCircle className="w-4 h-4 text-primary-foreground" /></div>
                    <div><p className="text-sm font-medium text-foreground">{e.full_name}</p><p className="text-xs text-muted-foreground">{e.email}</p></div>
                  </div></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.employee_number}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.department}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.designation}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(e.date_of_joining)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(e.status)}`}>{e.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {((page-1)*pageSize)+1}-{Math.min(page*pageSize, total)} of {total}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-1.5 hover:bg-muted rounded disabled:opacity-30"><RefreshCw className="w-4 h-4 hidden" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
