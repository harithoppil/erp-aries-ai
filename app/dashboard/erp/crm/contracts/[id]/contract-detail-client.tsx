"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, FileText, User, Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitContract, cancelContract, deleteContract } from "../actions";
import { toast } from "sonner";

interface ContractRecord {
  name: string; party_type: string; party_name: string; status: string;
  contract_template: string | null; start_date: string | null; end_date: string | null;
  is_signed: boolean; docstatus: number; party_user: string | null;
  fulfilment_status: string | null; signee: string | null; signed_on: string | null;
  contract_terms: string; requires_fulfilment: boolean;
  fulfilment_deadline: string | null; document_type: string | null;
  document_name: string | null; party_full_name: string | null;
  signed_by_company: string | null;
}

const STATUS: Record<string, { label: string; badge: string }> = {
  Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  Active: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200" },
  Expired: { label: "Expired", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  Cancelled: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const DOCTYPE: Record<number, { label: string; badge: string }> = {
  0: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  1: { label: "Submitted", badge: "bg-green-100 text-green-700 border-green-200" },
  2: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function ContractDetailClient({ record }: { record: ContractRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const sc = STATUS[record.status] || STATUS.Draft;
  const dc = DOCTYPE[record.docstatus] || DOCTYPE[0];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/crm/contracts")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.party_full_name || record.party_name}</h1><p className="text-sm text-[#64748b] mt-1">{record.name} | {record.party_type}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${sc.badge}`}>{sc.label}</span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${dc.badge}`}>{dc.label}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><FileText size={16} /><span className="text-xs font-medium uppercase">Contract</span></div>
          <p className="font-semibold text-[#0f172a]">{record.party_name}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Type: {record.party_type}</p>
            <p className="text-sm text-[#64748b]">Template: {record.contract_template || "—"}</p>
            <p className="text-sm text-[#64748b]">Signed: {record.is_signed ? "Yes" : "No"}</p>
            {record.document_type && <p className="text-sm text-[#64748b]">Ref: {record.document_type} - {record.document_name}</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Dates</span></div>
          <div className="space-y-1">
            <p className="text-sm">Start: <span className="font-medium">{dt(record.start_date)}</span></p>
            <p className="text-sm">End: <span className="font-medium">{dt(record.end_date)}</span></p>
            {record.signed_on && <p className="text-sm text-[#64748b]">Signed On: {dt(record.signed_on)}</p>}
            {record.fulfilment_deadline && <p className="text-sm text-[#64748b]">Fulfilment By: {dt(record.fulfilment_deadline)}</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><User size={16} /><span className="text-xs font-medium uppercase">Signee</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Signee: {record.signee || "—"}</p>
            <p className="text-sm text-[#64748b]">Signed By Company: {record.signed_by_company || "—"}</p>
            <p className="text-sm text-[#64748b]">Party User: {record.party_user || "—"}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><CheckCircle size={16} /><span className="text-xs font-medium uppercase">Fulfilment</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Required: {record.requires_fulfilment ? "Yes" : "No"}</p>
            <p className="text-sm text-[#64748b]">Status: {record.fulfilment_status || "—"}</p>
          </div>
        </div>
      </div>
      {record.contract_terms && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Contract Terms</h3>
          <p className="text-sm text-[#64748b] whitespace-pre-wrap">{record.contract_terms}</p>
        </div>
      )}
      <div className="flex gap-2">
        {record.docstatus === 0 && <Button onClick={async () => { setLoading(true); const r = await submitContract(record.name); if (r.success) { toast.success("Submitted"); router.push("/dashboard/erp/crm/contracts"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Submit</Button>}
        {record.docstatus === 1 && <Button variant="destructive" onClick={async () => { setLoading(true); const r = await cancelContract(record.name); if (r.success) { toast.success("Cancelled"); router.push("/dashboard/erp/crm/contracts"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Cancel</Button>}
        {record.docstatus === 0 && <Button variant="destructive" onClick={async () => { if (!confirm("Delete this contract?")) return; setLoading(true); const r = await deleteContract(record.name); if (r.success) { toast.success("Deleted"); router.push("/dashboard/erp/crm/contracts"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Delete</Button>}
      </div>
    </div>
  );
}
