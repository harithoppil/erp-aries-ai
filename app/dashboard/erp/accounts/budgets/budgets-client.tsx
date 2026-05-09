"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listBudgets, createBudget, type ClientSafeBudget } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { PiggyBank, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

const DOCTYPE: Record<number, { label: string; badge: string }> = {
  0: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  1: { label: "Submitted", badge: "bg-green-100 text-green-700 border-green-200" },
  2: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });

export default function BudgetsClient({ initialRecords }: { initialRecords: ClientSafeBudget[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeBudget[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ budget_against: "Cost Center", company: "Aries", cost_center: "", project: "", account: "", budget_amount: "", from_fiscal_year: "", to_fiscal_year: "" });

  usePageContext(`Budgets: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((b) => !q || (b.company || "").toLowerCase().includes(q) || (b.account || "").toLowerCase().includes(q) || (b.cost_center || "").toLowerCase().includes(q) || (b.budget_against || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createBudget({ ...form, budget_amount: parseFloat(form.budget_amount) });
    if (result.success) { toast.success("Budget created"); setDialogOpen(false); setForm({ budget_against: "Cost Center", company: "Aries", cost_center: "", project: "", account: "", budget_amount: "", from_fiscal_year: "", to_fiscal_year: "" }); const res = await listBudgets(); if (res.success) setRecords(res.budgets); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Budgets</h2><p className="text-sm text-[#64748b] mt-1">{records.length} budgets</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(b => ({ name: b.name, against: b.budget_against, company: b.company, account: b.account, amount: b.budget_amount, fiscal_year: b.from_fiscal_year })), 'budgets')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Budget</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by company, account, cost center..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><PiggyBank size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No budgets found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Budget Against</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Account</th><th className="text-right px-4 py-3 text-gray-700 font-semibold">Amount</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Fiscal Year</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((b) => { const dc = DOCTYPE[b.docstatus] || DOCTYPE[0]; return (<tr key={b.name} onClick={() => router.push(`/dashboard/erp/accounts/budgets/${b.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 text-[#64748b]">{b.budget_against}</td><td className="px-4 py-3 text-[#64748b]">{b.company}</td><td className="px-4 py-3 font-medium text-[#0f172a]">{b.account}</td><td className="px-4 py-3 text-right font-medium text-[#0f172a]">{fmt(b.budget_amount)}</td><td className="px-4 py-3 text-[#64748b] text-xs">{b.from_fiscal_year} — {b.to_fiscal_year}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${dc.badge}`}>{dc.label}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Budget Against</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.budget_against} onChange={(e) => setForm({ ...form, budget_against: e.target.value })}><option>Cost Center</option><option>Project</option></select></div><div><label className="text-sm font-medium">Company</label><Input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Cost Center</label><Input value={form.cost_center} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} placeholder="Cost center" /></div><div><label className="text-sm font-medium">Project</label><Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="Project" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Account</label><Input required value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder="Account" /></div><div><label className="text-sm font-medium">Budget Amount</label><Input type="number" required min="0" step="0.01" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} placeholder="0.00" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">From Fiscal Year</label><Input required value={form.from_fiscal_year} onChange={(e) => setForm({ ...form, from_fiscal_year: e.target.value })} placeholder="FY name" /></div><div><label className="text-sm font-medium">To Fiscal Year</label><Input required value={form.to_fiscal_year} onChange={(e) => setForm({ ...form, to_fiscal_year: e.target.value })} placeholder="FY name" /></div></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
