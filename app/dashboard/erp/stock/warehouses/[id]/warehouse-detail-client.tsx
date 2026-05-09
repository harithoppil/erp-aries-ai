"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Warehouse as WarehouseIcon, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateWarehouse, deleteWarehouse } from "../actions";
import { toast } from "sonner";

interface WHRecord {
  name: string; warehouse_name: string; warehouse_type: string | null; is_group: boolean;
  parent_warehouse: string | null; company: string; disabled: boolean; docstatus: number;
  account: string | null; email_id: string | null; phone_no: string | null;
  address_line_1: string | null; city: string | null; state: string | null; pin: string | null;
  is_rejected_warehouse: boolean;
}

export default function WarehouseDetailClient({ record }: { record: WHRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/stock/warehouses")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.warehouse_name}</h1><p className="text-sm text-[#64748b] mt-1">{record.name} | {record.company}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${record.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{record.disabled ? "Disabled" : "Active"}</span>
        {record.is_group && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Group</span>}
        {record.is_rejected_warehouse && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">Rejected</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><WarehouseIcon size={16} /><span className="text-xs font-medium uppercase">Warehouse</span></div>
          <p className="font-semibold text-[#0f172a]">{record.warehouse_name}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Type: {record.warehouse_type || "—"}</p>
            <p className="text-sm text-[#64748b]">Parent: {record.parent_warehouse || "—"}</p>
            <p className="text-sm text-[#64748b]">Account: {record.account || "—"}</p>
            <p className="text-sm text-[#64748b]">Company: {record.company}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><MapPin size={16} /><span className="text-xs font-medium uppercase">Address</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">{record.address_line_1 || "—"}</p>
            <p className="text-sm text-[#64748b]">{[record.city, record.state].filter(Boolean).join(", ") || "—"}</p>
            <p className="text-sm text-[#64748b]">PIN: {record.pin || "—"}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Phone size={16} /><span className="text-xs font-medium uppercase">Contact</span></div>
          <div className="space-y-1">
            {record.phone_no && <p className="text-sm flex items-center gap-1.5"><Phone size={14} />{record.phone_no}</p>}
            {record.email_id && <p className="text-sm flex items-center gap-1.5"><Mail size={14} />{record.email_id}</p>}
            {!record.phone_no && !record.email_id && <p className="text-sm text-[#64748b]">No contact info</p>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={async () => { setLoading(true); const r = await updateWarehouse(record.name, { disabled: !record.disabled }); if (r.success) { toast.success(record.disabled ? "Enabled" : "Disabled"); router.push("/dashboard/erp/stock/warehouses"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>{record.disabled ? "Enable" : "Disable"}</Button>
        <Button variant="destructive" onClick={async () => { if (!confirm("Delete this warehouse?")) return; setLoading(true); const r = await deleteWarehouse(record.name); if (r.success) { toast.success("Deleted"); router.push("/dashboard/erp/stock/warehouses"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Delete</Button>
      </div>
    </div>
  );
}
