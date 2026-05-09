"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listCompanies, createCompany, type ClientSafeCompany } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { Building2, Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";

export default function CompanyClient({ initialRecords }: { initialRecords: ClientSafeCompany[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeCompany[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ company_name: "", abbr: "", default_currency: "AED", country: "United Arab Emirates", domain: "", tax_id: "" });

  usePageContext(`Companies: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((c) => !q || (c.company_name || "").toLowerCase().includes(q) || (c.abbr || "").toLowerCase().includes(q) || (c.country || "").toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createCompany(form);
    if (result.success) { toast.success("Company created"); setDialogOpen(false); setForm({ company_name: "", abbr: "", default_currency: "AED", country: "United Arab Emirates", domain: "", tax_id: "" }); const res = await listCompanies(); if (res.success) setRecords(res.companies); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Companies</h2><p className="text-sm text-[#64748b] mt-1">{records.length} companies</p></div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(c => ({ name: c.name, company: c.company_name, abbr: c.abbr, currency: c.default_currency, country: c.country })), 'companies')}><Download size={16} />Export</Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Company</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by name, abbr, country..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><Building2 size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No companies found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Company Name</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Abbr</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Currency</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Country</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Tax ID</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((c) => (<tr key={c.name} onClick={() => router.push(`/dashboard/erp/setup/company/${c.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{c.company_name}</td><td className="px-4 py-3"><span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">{c.abbr}</span></td><td className="px-4 py-3 text-[#64748b]">{c.default_currency}</td><td className="px-4 py-3 text-[#64748b]">{c.country}</td><td className="px-4 py-3 text-[#64748b]">{c.tax_id || "—"}</td></tr>))}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Company</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Company Name</label><Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Company name" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Abbreviation</label><Input required value={form.abbr} onChange={(e) => setForm({ ...form, abbr: e.target.value })} placeholder="ABBR" maxLength={10} /></div><div><label className="text-sm font-medium">Default Currency</label><Input value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value })} placeholder="AED" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Country</label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" /></div><div><label className="text-sm font-medium">Domain</label><Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="Distribution" /></div></div>
          <div><label className="text-sm font-medium">Tax ID</label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="Tax ID" /></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
