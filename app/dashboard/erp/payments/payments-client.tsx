"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listPayments, createPayment, type ClientSafePayment } from "@/app/dashboard/erp/payments/actions";
import { listInvoices, type ClientSafeInvoice } from "@/app/dashboard/erp/accounts/actions";
import { usePageContext } from "@/hooks/usePageContext";
import {
  Wallet, Search, Plus, ArrowRightLeft, User, Download, Wand2, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";
import { useActionDispatcher, defineAction } from "@/store/useActionDispatcher";

export default function PaymentsClient({ initialPayments, initialInvoices }: { initialPayments: ClientSafePayment[]; initialInvoices: ClientSafeInvoice[] }) {
  const router = useRouter();
  const [payments, setPayments] = useState<ClientSafePayment[]>(initialPayments);
  const [invoices, setInvoices] = useState<ClientSafeInvoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoice_id: "", amount: "", reference_number: "",
  });

  // Register AI UI actions for this page
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    registerActions(
      [
        defineAction({
          name: "create_payment",
          description: "Open and fill the create payment form with the provided details. Opens dialog and fills all fields in one shot.",
          parameters: {
            type: "object",
            required: ["amount"],
            properties: {
              amount: { type: "number", description: "Payment amount in AED (required)" },
              reference_number: { type: "string", description: "Payment reference number" },
            },
          },
        }),
        defineAction({
          name: "set_payment_search",
          description: "Filter the payment list by search term",
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
        create_payment: (args: Record<string, any>) => {
          setDialogOpen(true);
          setForm((prev) => ({
            ...prev,
            amount: args.amount != null ? String(args.amount) : prev.amount,
            reference_number: args.reference_number || prev.reference_number,
          }));
          toast.info("AI opened and filled the payment form", { icon: <Wand2 size={14} /> });
        },
        set_payment_search: (args: Record<string, any>) => {
          setSearch(args.term);
          toast.info(`AI filtered payments by "${args.term}"`, { icon: <Sparkles size={14} /> });
        },
      }
    );
    return () => unregisterActions();
  }, [registerActions, unregisterActions]);

  // AI page context
  const contextSummary = payments.length > 0
    ? `Payments page: ${payments.length} payments. Total received: AED ${payments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}.`
    : "Payments page: Loading...";
  usePageContext(contextSummary);

  const load = async () => {
    try {
      const [pRes, iRes] = await Promise.all([
        listPayments(),
        listInvoices(),
      ]);
      if (pRes.success) setPayments(pRes.payments);
      if (iRes.success) setInvoices(iRes.invoices);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createPayment({
      invoice_id: form.invoice_id || undefined,
      amount: parseFloat(form.amount),
      reference_number: form.reference_number || undefined,
      party_name: invoices.find((i) => i.id === form.invoice_id)?.customer_name || undefined,
    });
    if (result.success) {
      toast.success("Payment recorded");
      setDialogOpen(false);
      setForm({ invoice_id: "", amount: "", reference_number: "" });
      load();
    } else {
      toast.error(result.error || "Failed to record payment");
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    if (!search) return payments;
    const q = search.toLowerCase();
    return payments.filter((p) =>
      (p.party_name || "").toLowerCase().includes(q) ||
      (p.reference_number || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  const stats = useMemo(() => ({
    total: payments.reduce((s, p) => s + (p.amount || 0), 0),
    count: payments.length,
  }), [payments]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Payments</h2>
              <p className="text-sm text-[#64748b] mt-1">{payments.length} payment entries</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(p => ({ posting_date: p.posting_date, party_name: p.party_name, payment_type: p.payment_type, reference_number: p.reference_number, amount: p.amount })), 'payments')}>
                <Download size={16} /> Export CSV
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
                <Plus size={16} /> Record Payment
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search payments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className="text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Total Received</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">AED {stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft size={16} className="text-[#0ea5e9]" />
                <span className="text-xs font-medium text-[#64748b] uppercase">Entries</span>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{stats.count}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Wallet size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No payments yet</p>
                <p className="text-sm">Record your first payment entry</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Party</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Reference</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((p) => (
                      <tr key={p.id} onClick={() => router.push(`/erp/payments/${p.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-[#64748b]">
                          {p.posting_date ? new Date(p.posting_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-[#94a3b8]" />
                            <span className="font-medium text-[#0f172a]">{p.party_name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            p.payment_type === "receive"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}>
                            {p.payment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{p.reference_number || "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-[#0f172a]">AED {p.amount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Invoice</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={form.invoice_id}
                onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}
                required
              >
                <option value="">Select invoice...</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number || "—"} — {inv.customer_name} (AED {inv.outstanding_amount?.toLocaleString()} outstanding)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Amount (AED)</label>
                <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Reference</label>
                <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="e.g. TRN-123" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">
                {saving ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
