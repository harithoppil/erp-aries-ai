"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listCostCenters, createCostCenter, type ClientSafeCostCenter } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { GitBranch, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

export default function CostCentersClient({ initialRecords }: { initialRecords: ClientSafeCostCenter[] }) {
  const router = useRouter();
  const [records, setRecords] = useState<ClientSafeCostCenter[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cost_center_name: "", parent_cost_center: "", company: "Aries", is_group: false, cost_center_number: "" });

  usePageContext(`Cost Centers: ${records.length}`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((cc) => !q || (cc.cost_center_name || "").toLowerCase().includes(q) || (cc.company || "").toLowerCase().includes(q) || (cc.parent_cost_center || "").toLowerCase().includes(q));
  }, [records, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const result = await createCostCenter(form);
    if (result.success) { toast.success("Cost Center created"); setDialogOpen(false); setForm({ cost_center_name: "", parent_cost_center: "", company: "Aries", is_group: false, cost_center_number: "" }); const res = await listCostCenters(); if (res.success) setRecords(res.costCenters); }
    else toast.error(result.error || "Failed"); setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2"><div className="space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-[#0f172a]">Cost Centers</h2><p className="text-sm text-[#64748b] mt-1">{records.length} cost centers</p></div>
          <div className="flex gap-2">
            <ExportButton data={filtered.map(cc => ({ name: cc.name, cost_center: cc.cost_center_name, parent: cc.parent_cost_center, company: cc.company, is_group: cc.is_group, disabled: cc.disabled }))} filename="cost-centers" />
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"><Plus size={16} />New Cost Center</Button>
          </div>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" /><Input placeholder="Search by name, company, parent..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-gray-200" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]"><GitBranch size={48} className="mb-4 opacity-40" /><p className="text-lg font-medium">No cost centers found</p></div>) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-700 font-semibold">Cost Center</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Parent</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Type</th><th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map((cc) => (<tr key={cc.name} onClick={() => router.push(`/dashboard/erp/accounts/cost-centers/${cc.name}`)} className="cursor-pointer hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-[#0f172a]">{cc.cost_center_name}</td><td className="px-4 py-3 text-[#64748b] text-xs">{cc.parent_cost_center}</td><td className="px-4 py-3 text-[#64748b]">{cc.company}</td><td className="px-4 py-3">{cc.is_group ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Group</span> : <span className="text-xs text-[#64748b]">Leaf</span>}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cc.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{cc.disabled ? "Disabled" : "Active"}</span></td></tr>))}</tbody></table></div>
          )}
        </div>
      </div></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Cost Center</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div><label className="text-sm font-medium">Cost Center Name</label><Input required value={form.cost_center_name} onChange={(e) => setForm({ ...form, cost_center_name: e.target.value })} placeholder="Cost center name" /></div>
          <div><label className="text-sm font-medium">Parent Cost Center</label><Input required value={form.parent_cost_center} onChange={(e) => setForm({ ...form, parent_cost_center: e.target.value })} placeholder="Parent cost center" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Company</label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div><div><label className="text-sm font-medium">Number</label><Input value={form.cost_center_number} onChange={(e) => setForm({ ...form, cost_center_number: e.target.value })} placeholder="Optional" /></div></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="is_group" checked={form.is_group} onChange={(e) => setForm({ ...form, is_group: e.target.checked })} className="rounded" /><label htmlFor="is_group" className="text-sm font-medium">Is Group</label></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create"}</Button></div>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}
