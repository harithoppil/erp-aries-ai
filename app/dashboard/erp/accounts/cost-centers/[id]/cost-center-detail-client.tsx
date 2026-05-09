"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, GitBranch, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCostCenter } from "../actions";
import { toast } from "sonner";

interface CCRecord {
  name: string; cost_center_name: string; cost_center_number: string | null;
  is_group: boolean; parent_cost_center: string; company: string;
  disabled: boolean; docstatus: number; lft: number | null; rgt: number | null;
  old_parent: string | null;
}

export default function CostCenterDetailClient({ record }: { record: CCRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/accounts/cost-centers")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.cost_center_name}</h1><p className="text-sm text-[#64748b] mt-1">{record.name}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${record.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{record.disabled ? "Disabled" : "Active"}</span>
        {record.is_group && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Group</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><GitBranch size={16} /><span className="text-xs font-medium uppercase">Hierarchy</span></div>
          <p className="font-semibold text-[#0f172a]">{record.cost_center_name}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Number: {record.cost_center_number || "—"}</p>
            <p className="text-sm text-[#64748b]">Parent: <span className="font-medium text-[#0f172a]">{record.parent_cost_center}</span></p>
            {record.old_parent && <p className="text-sm text-[#64748b]">Old Parent: {record.old_parent}</p>}
            <p className="text-sm text-[#64748b]">Lft/Rgt: {record.lft} / {record.rgt}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Building2 size={16} /><span className="text-xs font-medium uppercase">Company</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Company: <span className="font-medium text-[#0f172a]">{record.company}</span></p>
            <p className="text-sm text-[#64748b]">DocStatus: {record.docstatus}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={async () => { if (!confirm("Delete this cost center?")) return; setLoading(true); const r = await deleteCostCenter(record.name); if (r.success) { toast.success("Deleted"); router.push("/dashboard/erp/accounts/cost-centers"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Delete</Button>
      </div>
    </div>
  );
}
