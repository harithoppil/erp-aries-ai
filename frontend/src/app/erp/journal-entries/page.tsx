"use client";

import { useState, useEffect, useMemo } from "react";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import {
  BookOpen, Search, Plus, ArrowDownLeft, ArrowUpRight,
  DollarSign, Calendar, TrendingUp, TrendingDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account: "", entry_type: "debit", amount: "",
    party_type: "", party_name: "", reference: "", notes: "",
  });

  const load = async () => {
    try {
      const res = await throttledFetch(`${API_BASE}/erp/journal-entries`);
      if (res.ok) setEntries(unwrapPaginated(await res.json()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await throttledFetch(`${API_BASE}/erp/journal-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
        }),
      });
      if (res.ok) {
        toast.success("Journal entry created");
        setDialogOpen(false);
        setForm({ account: "", entry_type: "debit", amount: "", party_type: "", party_name: "", reference: "", notes: "" });
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create entry");
      }
    } catch (e) {
      toast.error("Network error");
    } finally { setSaving(false); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      (e.entry_number || "").toLowerCase().includes(q) ||
      (e.account || "").toLowerCase().includes(q) ||
      (e.party_name || "").toLowerCase().includes(q) ||
      (e.reference || "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  const stats = useMemo(() => {
    const debits = entries.filter((e) => e.entry_type === "debit").reduce((s, e) => s + (e.amount || 0), 0);
    const credits = entries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + (e.amount || 0), 0);
    return {
      total: entries.length,
      debits,
      credits,
      net: debits - credits,
    };
  }, [entries]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading journal entries...</div>
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
              <h2 className="text-2xl font-bold text-[#0f172a]">Journal Entries</h2>
              <p className="text-sm text-[#64748b] mt-1">{entries.length} total entries</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> New Entry
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search by entry number, account, party, or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={BookOpen} label="Total Entries" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={TrendingUp} label="Total Debits" value={`AED ${stats.debits.toLocaleString()}`} color="text-green-600" />
            <StatCard icon={TrendingDown} label="Total Credits" value={`AED ${stats.credits.toLocaleString()}`} color="text-red-600" />
            <StatCard icon={DollarSign} label="Net" value={`AED ${stats.net.toLocaleString()}`} color="text-blue-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <BookOpen size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No journal entries found</p>
                <p className="text-sm">Create your first entry to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Entry #</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Account</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Party</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Reference</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{e.entry_number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-[#64748b]">
                            <Calendar size={12} />
                            {new Date(e.posting_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0f172a]">{e.account}</td>
                        <td className="px-4 py-3 text-[#64748b]">{e.party_name || "—"}</td>
                        <td className="px-4 py-3 text-[#64748b]">{e.reference || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            e.entry_type === "debit"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }`}>
                            {e.entry_type === "debit" ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                            {e.entry_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0f172a]">
                          AED {e.amount?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Journal Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className="text-sm font-medium">Account *</label><Input required value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder="e.g. Bank Account" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Entry Type *</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.entry_type}
                  onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                >
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Amount (AED) *</label><Input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Party Type</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.party_type}
                  onChange={(e) => setForm({ ...form, party_type: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Party Name</label><Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Reference</label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Notes</label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
