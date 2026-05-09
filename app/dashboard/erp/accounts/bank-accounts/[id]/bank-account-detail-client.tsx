"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Landmark, Hash, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBankAccount } from "../actions";
import { toast } from "sonner";

interface BARecord {
  name: string; account_name: string; bank: string; account_type: string | null;
  bank_account_no: string | null; company: string | null; is_default: boolean;
  is_company_account: boolean; disabled: boolean; docstatus: number;
  account: string | null; account_subtype: string | null;
  party_type: string | null; party: string | null;
  iban: string | null; branch_code: string | null;
}

export default function BankAccountDetailClient({ record }: { record: BARecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/accounts/bank-accounts")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.account_name}</h1><p className="text-sm text-[#64748b] mt-1">{record.bank} | {record.name}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${record.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{record.disabled ? "Disabled" : "Active"}</span>
        {record.is_default && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Default</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Landmark size={16} /><span className="text-xs font-medium uppercase">Bank Account</span></div>
          <p className="font-semibold text-[#0f172a]">{record.account_name}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Bank: <span className="font-medium text-[#0f172a]">{record.bank}</span></p>
            <p className="text-sm text-[#64748b]">Type: {record.account_type || "—"}</p>
            <p className="text-sm text-[#64748b]">Subtype: {record.account_subtype || "—"}</p>
            <p className="text-sm text-[#64748b]">Company Account: {record.is_company_account ? "Yes" : "No"}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Hash size={16} /><span className="text-xs font-medium uppercase">Account Details</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Account No: <span className="font-mono font-medium text-[#0f172a]">{record.bank_account_no || "—"}</span></p>
            <p className="text-sm text-[#64748b]">IBAN: <span className="font-mono text-xs">{record.iban || "—"}</span></p>
            <p className="text-sm text-[#64748b]">Branch Code: {record.branch_code || "—"}</p>
            <p className="text-sm text-[#64748b]">GL Account: {record.account || "—"}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Building2 size={16} /><span className="text-xs font-medium uppercase">Party</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Company: <span className="font-medium text-[#0f172a]">{record.company || "—"}</span></p>
            <p className="text-sm text-[#64748b]">Party Type: {record.party_type || "—"}</p>
            <p className="text-sm text-[#64748b]">Party: {record.party || "—"}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={async () => { if (!confirm("Delete this bank account?")) return; setLoading(true); const r = await deleteBankAccount(record.name); if (r.success) { toast.success("Deleted"); router.push("/dashboard/erp/accounts/bank-accounts"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Delete</Button>
      </div>
    </div>
  );
}
