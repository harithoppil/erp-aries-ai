"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe, DollarSign, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanyRecord {
  name: string; company_name: string; abbr: string; default_currency: string; country: string;
  tax_id: string | null; domain: string | null; is_group: boolean; parent_company: string | null;
  docstatus: number; default_finance_book: string | null; company_logo: string | null;
  company_description: string | null; default_bank_account: string | null;
  default_cash_account: string | null; default_receivable_account: string | null;
  default_payable_account: string | null; default_expense_account: string | null;
  default_income_account: string | null; default_inventory_account: string | null;
  cost_center: string | null; phone_no: string | null; email: string | null;
  website: string | null; date_of_establishment: string | null;
}

const DOCTYPE: Record<number, { label: string; badge: string }> = {
  0: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  1: { label: "Submitted", badge: "bg-green-100 text-green-700 border-green-200" },
  2: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function CompanyDetailClient({ record }: { record: CompanyRecord }) {
  const router = useRouter();
  const dc = DOCTYPE[record.docstatus] || DOCTYPE[0];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/setup/company")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.company_name}</h1><p className="text-sm text-[#64748b] mt-1">{record.name} | {record.abbr}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${dc.badge}`}>{dc.label}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Building2 size={16} /><span className="text-xs font-medium uppercase">Company</span></div>
          <p className="font-semibold text-[#0f172a]">{record.company_name}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Abbreviation: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{record.abbr}</span></p>
            <p className="text-sm text-[#64748b]">Domain: {record.domain || "—"}</p>
            <p className="text-sm text-[#64748b]">Tax ID: {record.tax_id || "—"}</p>
            <p className="text-sm text-[#64748b]">Is Group: {record.is_group ? "Yes" : "No"}</p>
            {record.parent_company && <p className="text-sm text-[#64748b]">Parent: {record.parent_company}</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Globe size={16} /><span className="text-xs font-medium uppercase">Location</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Country: <span className="font-medium text-[#0f172a]">{record.country}</span></p>
            <p className="text-sm text-[#64748b]">Est.: {dt(record.date_of_establishment)}</p>
            {record.phone_no && <p className="text-sm flex items-center gap-1.5"><Phone size={14} />{record.phone_no}</p>}
            {record.email && <p className="text-sm flex items-center gap-1.5"><Mail size={14} />{record.email}</p>}
            {record.website && <p className="text-sm text-[#64748b]">Website: {record.website}</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><DollarSign size={16} /><span className="text-xs font-medium uppercase">Finance</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Currency: <span className="font-medium text-[#0f172a]">{record.default_currency}</span></p>
            <p className="text-sm text-[#64748b]">Cost Center: {record.cost_center || "—"}</p>
            <p className="text-sm text-[#64748b]">Bank Account: {record.default_bank_account || "—"}</p>
            <p className="text-sm text-[#64748b]">Cash Account: {record.default_cash_account || "—"}</p>
            <p className="text-sm text-[#64748b]">Receivable: {record.default_receivable_account || "—"}</p>
            <p className="text-sm text-[#64748b]">Payable: {record.default_payable_account || "—"}</p>
          </div>
        </div>
      </div>
      {record.company_description && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Description</h3>
          <p className="text-sm text-[#64748b] whitespace-pre-wrap">{record.company_description}</p>
        </div>
      )}
    </div>
  );
}
