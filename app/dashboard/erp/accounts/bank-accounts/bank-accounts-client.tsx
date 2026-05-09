"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listBankAccounts, createBankAccount, type ClientSafeBankAccount } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { Landmark, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

export default function BankAccountsClient({ initialRecords }: { initialRecords: ClientSafeBankAccount[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeBankAccount[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ account_name: "", bank: "", account_type: "", bank_account_no: "", company: "Aries", is_company_account: false });

  usePageContext(`Bank Accounts: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((ba) => !q || (ba.account_name || "").toLowerCase().includes(q) || (ba.bank || "").toLowerCase().includes(q) || (ba.company || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createBankAccount(form);
    if (result.success) { toast.success("Bank Account created"); setDialogOpen(false); setForm({ account_name: "", bank: "", account_type: "", bank_account_no: "", company: "Aries", is_company_account: false }); const res = await listBankAccounts(); if (res.success) setRecords(res.bankAccounts); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Bank Accounts</h2><p className="text-sm text-[#64748b] mt-1">{records.length} bank accounts</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(ba => ({ name: ba.name, account: ba.account_name, bank: ba.bank, type: ba.account_type, company: ba.company })), 'bank-accounts')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Bank Account</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by account name, bank..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><Landmark size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No bank accounts found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Account Name</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Bank</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Account No</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((ba) => (<tr key={ba.name} onClick={() => router.push(`/dashboard/erp/accounts/bank-accounts/${ba.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{ba.account_name}</td><td className="px-4 py-3 text-[#64748b]">{ba.bank}</td><td className="px-4 py-3 text-[#64748b]">{ba.account_type || "—"}</td><td className="px-4 py-3 font-mono text-xs text-[#64748b]">{ba.bank_account_no || "—"}</td><td className="px-4 py-3 text-[#64748b]">{ba.company || "—"}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${ba.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{ba.disabled ? "Disabled" : "Active"}</span></td></tr>))}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Account Name</label><Input required value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="Account name" /></div>
          <div><label className="text-sm font-medium">Bank</label><Input required value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="Bank name" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Account Type</label><select className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}><option value="">Select...</option><option>Bank</option><option>Cash</option><option>Savings</option><option>Current</option></select></div><div><label className="text-sm font-medium">Account Number</label><Input value={form.bank_account_no} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} placeholder="Account number" /></div></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="is_company_account" checked={form.is_company_account} onChange={(e) => setForm({ ...form, is_company_account: e.target.checked })} className="rounded" /><label htmlFor="is_company_account" className="text-sm font-medium">Is Company Account</label></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
