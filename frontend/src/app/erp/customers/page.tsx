"use client";

import { useState, useEffect, useMemo } from "react";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import {
  Building2, Search, Plus, Mail, Phone, MapPin, TrendingUp,
  CheckCircle, XCircle, DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const INDUSTRY_COLORS: Record<string, string> = {
  oil_gas: "bg-blue-100 text-blue-700 border-blue-200",
  marine: "bg-cyan-100 text-cyan-700 border-cyan-200",
  renewable: "bg-green-100 text-green-700 border-green-200",
  construction: "bg-orange-100 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", customer_code: "", contact_person: "",
    email: "", phone: "", address: "", industry: "", tax_id: "", credit_limit: "",
  });

  const load = async () => {
    try {
      const res = await throttledFetch(`${API_BASE}/erp/customers`);
      if (res.ok) setCustomers(unwrapPaginated(await res.json()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await throttledFetch(`${API_BASE}/erp/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : undefined,
        }),
      });
      if (res.ok) {
        toast.success("Customer created");
        setDialogOpen(false);
        setForm({ customer_name: "", customer_code: "", contact_person: "", email: "", phone: "", address: "", industry: "", tax_id: "", credit_limit: "" });
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create customer");
      }
    } catch (e) {
      toast.error("Network error");
    } finally { setSaving(false); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.customer_name || "").toLowerCase().includes(q) ||
      (c.customer_code || "").toLowerCase().includes(q) ||
      (c.contact_person || "").toLowerCase().includes(q) ||
      (c.industry || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((c) => c.status === "active").length,
      inactive: customers.filter((c) => c.status === "inactive").length,
      withCredit: customers.filter((c) => c.credit_limit).length,
    };
  }, [customers]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading customers...</div>
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
              <h2 className="text-2xl font-bold text-[#0f172a]">Customers</h2>
              <p className="text-sm text-[#64748b] mt-1">{customers.length} total customers</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Customer
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search customers by name, code, or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={CheckCircle} label="Active" value={stats.active} color="text-green-600" />
            <StatCard icon={XCircle} label="Inactive" value={stats.inactive} color="text-gray-500" />
            <StatCard icon={DollarSign} label="With Credit Limit" value={stats.withCredit} color="text-blue-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Building2 size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No customers found</p>
                <p className="text-sm">Add your first customer to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Customer</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Code</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Industry</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Contact</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Tax ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Credit Limit</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((c) => {
                      const indColor = INDUSTRY_COLORS[c.industry] || INDUSTRY_COLORS.other;
                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{c.customer_name}</p>
                            {c.address && (
                              <p className="text-xs text-[#94a3b8] flex items-center gap-1">
                                <MapPin size={10} /> {c.address}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{c.customer_code}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${indColor}`}>
                              {c.industry?.replace(/_/g, " ") || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {c.contact_person && <p className="text-[#64748b]">{c.contact_person}</p>}
                              {c.email && <p className="text-xs text-[#94a3b8] flex items-center gap-1"><Mail size={10} /> {c.email}</p>}
                              {c.phone && <p className="text-xs text-[#94a3b8] flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{c.tax_id || "—"}</td>
                          <td className="px-4 py-3 text-[#0f172a] font-medium">
                            {c.credit_limit ? `AED ${c.credit_limit.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                              c.status === "active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}>
                              {c.status === "active" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                              {c.status}
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

      {/* Add Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Customer Name *</label><Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Customer Code *</label><Input required value={form.customer_code} onChange={(e) => setForm({ ...form, customer_code: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium">Contact Person</label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium">Address</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Industry</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="oil_gas">Oil &amp; Gas</option>
                  <option value="marine">Marine</option>
                  <option value="renewable">Renewable Energy</option>
                  <option value="construction">Construction</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Tax ID (TRN)</label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Credit Limit (AED)</label>
              <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Customer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs font-medium text-[#64748b] uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
