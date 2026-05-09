"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, User, Building2, Mail, Phone, Globe, MapPin, Briefcase, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateLeadStatus, convertLeadToCustomer } from "../actions";
import { toast } from "sonner";

interface LeadRecord { name: string; lead_name: string | null; company_name: string | null; email_id: string | null; phone: string | null; mobile_no: string | null; status: string; type: string | null; industry: string | null; territory: string | null; salutation: string | null; gender: string | null; website: string | null; lead_owner: string | null; customer: string | null; city: string | null; state: string | null; country: string | null; job_title: string | null; annual_revenue: number | null; no_of_employees: string | null; market_segment: string | null; request_type: string | null; qualification_status: string | null; qualified_by: string | null; qualified_on: string | null }

const STATUS: Record<string, { label: string; badge: string }> = { Lead: { label: "Lead", badge: "bg-blue-100 text-blue-700 border-blue-200" }, Open: { label: "Open", badge: "bg-amber-100 text-amber-700 border-amber-200" }, Replied: { label: "Replied", badge: "bg-teal-100 text-teal-700 border-teal-200" }, Opportunity: { label: "Opportunity", badge: "bg-purple-100 text-purple-700 border-purple-200" }, Converted: { label: "Converted", badge: "bg-green-100 text-green-700 border-green-200" }, "Do Not Contact": { label: "DNC", badge: "bg-red-100 text-red-700 border-red-200" } };
const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });

export default function LeadDetailClient({ record }: { record: LeadRecord }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const cfg = STATUS[record.status] || STATUS.Lead;
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/crm/leads")}><ArrowLeft size={20} /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold text-[#0f172a]">{record.lead_name || record.name}</h1><p className="text-sm text-[#64748b] mt-1">{record.company_name || "Individual Lead"}</p></div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>{cfg.label}</span>
        {!record.customer && record.status !== "Converted" && <Button onClick={async () => { setLoading(true); const r = await convertLeadToCustomer(record.name); if (r.success) { toast.success("Converted to customer"); router.push("/dashboard/erp/crm/leads"); } else toast.error(r.error); setLoading(false); }} disabled={loading} className="bg-green-600 hover:bg-green-700">Convert to Customer</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><User size={16} /><span className="text-xs font-medium uppercase">Contact</span></div><p className="font-semibold text-[#0f172a]">{record.lead_name || "—"}</p>{record.job_title && <p className="text-sm text-[#64748b]">{record.job_title}</p>}<div className="space-y-1 pt-2">{record.email_id && <p className="text-sm flex items-center gap-1.5"><Mail size={14} className="text-[#64748b]" />{record.email_id}</p>}{record.phone && <p className="text-sm flex items-center gap-1.5"><Phone size={14} className="text-[#64748b]" />{record.phone}</p>}{record.mobile_no && <p className="text-sm flex items-center gap-1.5"><Phone size={14} className="text-[#64748b]" />{record.mobile_no}</p>}</div></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><Building2 size={16} /><span className="text-xs font-medium uppercase">Company</span></div><p className="font-semibold text-[#0f172a]">{record.company_name || "—"}</p><div className="space-y-1 pt-2">{record.industry && <p className="text-sm text-[#64748b]">Industry: {record.industry}</p>}{record.territory && <p className="text-sm text-[#64748b]">Territory: {record.territory}</p>}{record.market_segment && <p className="text-sm text-[#64748b]">Segment: {record.market_segment}</p>}{record.no_of_employees && <p className="text-sm text-[#64748b]">Employees: {record.no_of_employees}</p>}</div></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"><div className="flex items-center gap-2 text-[#64748b]"><MapPin size={16} /><span className="text-xs font-medium uppercase">Location & Details</span></div><div className="space-y-1"><p className="text-sm">{[record.city, record.state, record.country].filter(Boolean).join(", ") || "—"}</p>{record.website && <p className="text-sm flex items-center gap-1.5"><Globe size={14} />{record.website}</p>}{record.annual_revenue != null && <p className="text-sm flex items-center gap-1.5"><DollarSign size={14} />{fmt(record.annual_revenue)}</p>}{record.type && <p className="text-sm text-[#64748b]">Type: {record.type}</p>}{record.qualification_status && <p className="text-sm text-[#64748b]">Qualification: {record.qualification_status}</p>}</div></div>
      </div>
    </div>
  );
}
