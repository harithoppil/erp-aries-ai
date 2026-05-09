"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, PiggyBank, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitBudget, cancelBudget, deleteBudget } from "../actions";
import { toast } from "sonner";

interface BudgetRecord {
  name: string; budget_against: string; company: string; cost_center: string | null;
  project: string | null; account: string; budget_amount: number;
  from_fiscal_year: string; to_fiscal_year: string; distribute_equally: boolean;
  docstatus: number; applicable_on_material_request: boolean;
  action_if_annual_budget_exceeded_on_mr: string;
  applicable_on_purchase_order: boolean;
  action_if_annual_budget_exceeded_on_po: string;
  applicable_on_booking_actual_expenses: boolean;
  action_if_annual_budget_exceeded: string;
  distribution_frequency: string;
  budget_start_date: string | null; budget_end_date: string | null;
}

const DOCTYPE: Record<number, { label: string; badge: string }> = {
  0: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  1: { label: "Submitted", badge: "bg-green-100 text-green-700 border-green-200" },
  2: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function BudgetDetailClient({ record }: { record: BudgetRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const dc = DOCTYPE[record.docstatus] || DOCTYPE[0];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/accounts/budgets")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.name}</h1><p className="text-sm text-[#64748b] mt-1">Budget against {record.budget_against} | {record.company}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${dc.badge}`}>{dc.label}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><PiggyBank size={16} /><span className="text-xs font-medium uppercase">Budget</span></div>
          <p className="text-2xl font-bold text-[#0f172a]">{fmt(record.budget_amount)}</p>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-[#64748b]">Account: <span className="font-medium text-[#0f172a]">{record.account}</span></p>
            <p className="text-sm text-[#64748b]">Against: {record.budget_against}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Period</span></div>
          <div className="space-y-1">
            <p className="text-sm">From FY: <span className="font-medium">{record.from_fiscal_year}</span></p>
            <p className="text-sm">To FY: <span className="font-medium">{record.to_fiscal_year}</span></p>
            <p className="text-sm">Start: {dt(record.budget_start_date)}</p>
            <p className="text-sm">End: {dt(record.budget_end_date)}</p>
            <p className="text-sm">Distribution: {record.distribute_equally ? "Equal" : "Custom"} ({record.distribution_frequency})</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><AlertTriangle size={16} /><span className="text-xs font-medium uppercase">Controls</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">MR: {record.applicable_on_material_request ? "Yes" : "No"} ({record.action_if_annual_budget_exceeded_on_mr})</p>
            <p className="text-sm text-[#64748b]">PO: {record.applicable_on_purchase_order ? "Yes" : "No"} ({record.action_if_annual_budget_exceeded_on_po})</p>
            <p className="text-sm text-[#64748b]">Actual: {record.applicable_on_booking_actual_expenses ? "Yes" : "No"} ({record.action_if_annual_budget_exceeded})</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><PiggyBank size={16} /><span className="text-xs font-medium uppercase">Allocation</span></div>
          <div className="space-y-1">
            <p className="text-sm text-[#64748b]">Cost Center: {record.cost_center || "—"}</p>
            <p className="text-sm text-[#64748b]">Project: {record.project || "—"}</p>
            <p className="text-sm text-[#64748b]">Company: <span className="font-medium text-[#0f172a]">{record.company}</span></p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {record.docstatus === 0 && <Button onClick={async () => { setLoading(true); const r = await submitBudget(record.name); if (r.success) { toast.success("Submitted"); router.push("/dashboard/erp/accounts/budgets"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Submit</Button>}
        {record.docstatus === 1 && <Button variant="destructive" onClick={async () => { setLoading(true); const r = await cancelBudget(record.name); if (r.success) { toast.success("Cancelled"); router.push("/dashboard/erp/accounts/budgets"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Cancel</Button>}
        {record.docstatus === 0 && <Button variant="destructive" onClick={async () => { if (!confirm("Delete this budget?")) return; setLoading(true); const r = await deleteBudget(record.name); if (r.success) { toast.success("Deleted"); router.push("/dashboard/erp/accounts/budgets"); } else toast.error(r.error); setLoading(false); }} disabled={loading}>Delete</Button>}
      </div>
    </div>
  );
}
