"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FYRecord {
  name: string; year: string; disabled: boolean; year_start_date: string; year_end_date: string;
  auto_created: boolean; docstatus: number; is_short_year: boolean;
}

const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function FiscalYearDetailClient({ record }: { record: FYRecord }) {
  const router = useRouter();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/setup/fiscal-years")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.year}</h1><p className="text-sm text-[#64748b] mt-1">{record.name}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${record.disabled ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>{record.disabled ? "Disabled" : "Active"}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Period</span></div>
          <p className="font-semibold text-[#0f172a]">{record.year}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Start: <span className="font-medium text-[#0f172a]">{dt(record.year_start_date)}</span></p>
            <p className="text-sm text-[#64748b]">End: <span className="font-medium text-[#0f172a]">{dt(record.year_end_date)}</span></p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><CheckCircle size={16} /><span className="text-xs font-medium uppercase">Status</span></div>
          <div className="space-y-1">
            <p className="text-sm">Active: <span className={`font-medium ${record.disabled ? "text-red-600" : "text-green-600"}`}>{record.disabled ? "No" : "Yes"}</span></p>
            <p className="text-sm">Auto Created: <span className="font-medium">{record.auto_created ? "Yes" : "No"}</span></p>
            <p className="text-sm">Short Year: <span className="font-medium">{record.is_short_year ? "Yes" : "No"}</span></p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><XCircle size={16} /><span className="text-xs font-medium uppercase">Doc Status</span></div>
          <p className="text-sm text-[#64748b]">DocStatus: <span className="font-medium text-[#0f172a]">{record.docstatus}</span></p>
        </div>
      </div>
    </div>
  );
}
