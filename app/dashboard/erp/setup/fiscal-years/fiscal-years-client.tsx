"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listFiscalYears, createFiscalYear, type ClientSafeFiscalYear } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { Calendar, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

const dt = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function FiscalYearsClient({ initialRecords }: { initialRecords: ClientSafeFiscalYear[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeFiscalYear[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ year: "", year_start_date: "", year_end_date: "" });

  usePageContext(`Fiscal Years: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((fy) => !q || (fy.year || "").toLowerCase().includes(q) || (fy.name || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createFiscalYear(form);
    if (result.success) { toast.success("Fiscal Year created"); setDialogOpen(false); setForm({ year: "", year_start_date: "", year_end_date: "" }); const res = await listFiscalYears(); if (res.success) setRecords(res.fiscalYears); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Fiscal Years</h2><p className="text-sm text-[#64748b] mt-1">{records.length} fiscal years</p></div>
          <div className="flex gap-2">
            <ExportButton data={filtered.map(fy => ({ name: fy.name, year: fy.year, start: dt(fy.year_start_date), end: dt(fy.year_end_date), disabled: fy.disabled }))} filename="fiscal-years" />
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Fiscal Year</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by year..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><Calendar size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No fiscal years found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Year</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Start Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">End Date</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((fy) => (<tr key={fy.name} onClick={() => router.push(`/dashboard/erp/setup/fiscal-years/${fy.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{fy.year}</td><td className="px-4 py-3 text-[#64748b]">{dt(fy.year_start_date)}</td><td className="px-4 py-3 text-[#64748b]">{dt(fy.year_end_date)}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${fy.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{fy.disabled ? "Disabled" : "Active"}</span></td></tr>))}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Fiscal Year</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Year</label><Input required value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2026" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Start Date</label><Input type="date" required value={form.year_start_date} onChange={(e) => setForm({ ...form, year_start_date: e.target.value })} /></div><div><label className="text-sm font-medium">End Date</label><Input type="date" required value={form.year_end_date} onChange={(e) => setForm({ ...form, year_end_date: e.target.value })} /></div></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
