"use client";

import { useState, useEffect, useMemo } from "react";
import { listAccounts, listInvoices, createInvoice, type ClientSafeAccount, type ClientSafeInvoice } from "./actions";
import {
  DollarSign, FileText, TrendingUp, TrendingDown,
  Search, Wallet, Plus, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  paid: { label: "Paid", badge: "bg-green-100 text-green-700 border-green-200" },
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  overdue: { label: "Overdue", badge: "bg-red-100 text-red-700 border-red-200" },
  draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
};

interface InvoiceItem {
  description: string;
  quantity: string;
  rate: string;
  item_code: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ClientSafeAccount[]>([]);
  const [invoices, setInvoices] = useState<ClientSafeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    tax_rate: "5",
    due_date_days: "30",
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: "1", rate: "", item_code: "" }]);

  const load = async () => {
    try {
      const [accResult, invResult] = await Promise.all([
        listAccounts(),
        listInvoices(),
      ]);
      if (accResult.success) setAccounts(accResult.accounts);
      if (invResult.success) setInvoices(invResult.invoices);
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createInvoice({
        customer_name: form.customer_name,
        customer_email: form.customer_email || undefined,
        tax_rate: parseFloat(form.tax_rate) || 5,
        due_date_days: parseInt(form.due_date_days) || 30,
        items: items
          .filter((i) => i.description.trim() && parseFloat(i.rate) > 0)
          .map((i) => ({
            description: i.description,
            quantity: parseInt(i.quantity) || 1,
            rate: parseFloat(i.rate),
            item_code: i.item_code || undefined,
          })),
      });
      if (result.success) {
        toast.success("Invoice created");
        setDialogOpen(false);
        setForm({ customer_name: "", customer_email: "", tax_rate: "5", due_date_days: "30" });
        setItems([{ description: "", quantity: "1", rate: "", item_code: "" }]);
        load();
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Network error");
    } finally { setSaving(false); }
  };

  const addItem = () => setItems([...items, { description: "", quantity: "1", rate: "", item_code: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof InvoiceItem, value: string) => {
    const next = [...items];
    next[idx][field] = value;
    setItems(next);
  };

  const filteredAccounts = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((a) =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.account_type || "").toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const totalReceivable = useMemo(() =>
    invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0),
  [invoices]);

  const totalInvoiced = useMemo(() =>
    invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
  [invoices]);

  if (loading) return <AccountsSkeleton />;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Accounts &amp; Finance</h2>
              <p className="text-sm text-[#64748b] mt-1">{accounts.length} accounts · {invoices.length} invoices</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Invoice
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Accounts</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{accounts.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-[#0ea5e9]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Invoices</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{invoices.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-green-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Invoiced</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">AED {totalInvoiced.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={16} className="text-amber-500" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Receivable</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">AED {totalReceivable.toLocaleString()}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Accounts Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">Chart of Accounts</h3>
            </div>
            {filteredAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Wallet size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No accounts found</p>
                <p className="text-sm">{search ? "Try a different search term" : "Accounts will appear here"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Account</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Balance</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Currency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAccounts.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0f172a]">{a.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                            {a.account_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0f172a]">{a.balance || 0}</td>
                        <td className="px-4 py-3 text-[#64748b]">{a.currency || "AED"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Invoices Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">Recent Invoices</h3>
            </div>
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <FileText size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No invoices yet</p>
                <p className="text-sm">Invoices will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Customer</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Total</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.slice(0, 10).map((inv) => {
                      const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{inv.customer_name || "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#0f172a]">AED {inv.total?.toLocaleString() || 0}</td>
                          <td className="px-4 py-3 text-right text-[#64748b]">AED {inv.outstanding_amount?.toLocaleString() || 0}</td>
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

      {/* Add Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Customer Name *</label><Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Customer Email</label><Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Tax Rate (%)</label><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Due Days</label><Input type="number" value={form.due_date_days} onChange={(e) => setForm({ ...form, due_date_days: e.target.value })} /></div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Line Items</span>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-end">
                    <div>
                      <label className="text-xs text-[#64748b]">Description</label>
                      <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Service description" />
                    </div>
                    <div>
                      <label className="text-xs text-[#64748b]">Qty</label>
                      <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-[#64748b]">Rate (AED)</label>
                      <Input type="number" value={item.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Invoice"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-52 mb-2" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
          {/* Stat cards - 4 cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-28" />
              </div>
            ))}
          </div>
          {/* Search */}
          <Skeleton className="h-10 w-full rounded-xl" />
          {/* Chart of Accounts Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Account', 'Type', 'Balance', 'Currency'].map(h => (
                      <th key={h} className="text-left px-4 py-3"><Skeleton className="h-4 w-16" /></th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Recent Invoices Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Customer', 'Status', 'Total', 'Outstanding'].map(h => (
                      <th key={h} className="text-left px-4 py-3"><Skeleton className="h-4 w-16" /></th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
