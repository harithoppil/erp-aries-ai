"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, User, Mail, Phone, MapPin, Building2, CreditCard, FileText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

/* ── Types (match what page.tsx passes) ─────────────────────────── */
interface Quotation {
  id: string;
  quotation_number: string;
  customer_name: string;
  total: number;
  status: string;
  valid_until: string | Date | null;
  created_at: string | Date;
  [key: string]: unknown;
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string | Date;
  [key: string]: unknown;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  outstanding_amount: number;
  status: string;
  posting_date: string | Date;
  due_date: string | Date | null;
  [key: string]: unknown;
}

interface CustomerRecord {
  id: string;
  customer_name: string;
  customer_code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  tax_id: string | null;
  credit_limit: number | null;
  status: string;
  created_at: string | Date;
  quotations: Quotation[];
  sales_orders: SalesOrder[];
  invoices: Invoice[];
}

/* ── Status badge configs ───────────────────────────────────────── */
const CUSTOMER_STATUS: Record<string, { label: string; badge: string }> = {
  ACTIVE:    { label: "Active",    badge: "bg-green-100 text-green-700 border-green-200" },
  INACTIVE:  { label: "Inactive",  badge: "bg-gray-100 text-gray-700 border-gray-200" },
  BLOCKED:   { label: "Blocked",   badge: "bg-red-100 text-red-700 border-red-200" },
};

const QUOTATION_STATUS: Record<string, { label: string; badge: string }> = {
  DRAFT:    { label: "Draft",     badge: "bg-gray-100 text-gray-700 border-gray-200" },
  SENT:     { label: "Sent",      badge: "bg-blue-100 text-blue-700 border-blue-200" },
  ACCEPTED: { label: "Accepted", badge: "bg-green-100 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected",  badge: "bg-red-100 text-red-700 border-red-200" },
  EXPIRED:  { label: "Expired",   badge: "bg-amber-100 text-amber-700 border-amber-200" },
};

const SO_STATUS: Record<string, { label: string; badge: string }> = {
  DRAFT:       { label: "Draft",       badge: "bg-gray-100 text-gray-700 border-gray-200" },
  TO_DELIVER:  { label: "To Deliver",  badge: "bg-blue-100 text-blue-700 border-blue-200" },
  TO_BILL:     { label: "To Bill",     badge: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED:   { label: "Completed",   badge: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:   { label: "Cancelled",   badge: "bg-red-100 text-red-700 border-red-200" },
};

const INV_STATUS: Record<string, { label: string; badge: string }> = {
  DRAFT:      { label: "Draft",      badge: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED:  { label: "Submitted",  badge: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID:       { label: "Paid",       badge: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:  { label: "Cancelled",  badge: "bg-red-100 text-red-700 border-red-200" },
  OVERDUE:    { label: "Overdue",    badge: "bg-amber-100 text-amber-700 border-amber-200" },
};

const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const date = (s: string | Date | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function CustomerDetailClient({ record }: { record: CustomerRecord }) {
  const router = useRouter();
  const cs = CUSTOMER_STATUS[record.status] ?? CUSTOMER_STATUS.ACTIVE;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/erp/customers")}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0f172a]">{record.customer_name}</h1>
          <p className="text-sm text-[#64748b] mt-1">{record.customer_code}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cs.badge}`}>
          {cs.label}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <User size={16} />
            <span className="text-xs font-medium uppercase">Contact Info</span>
          </div>
          {record.contact_person && (
            <p className="text-sm"><span className="text-[#64748b]">Contact:</span> <span className="font-medium text-[#0f172a]">{record.contact_person}</span></p>
          )}
          {record.email && (
            <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
              <Mail size={14} /> {record.email}
            </div>
          )}
          {record.phone && (
            <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
              <Phone size={14} /> {record.phone}
            </div>
          )}
        </div>

        {/* Address & Industry */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <MapPin size={16} />
            <span className="text-xs font-medium uppercase">Address &amp; Industry</span>
          </div>
          {record.address && (
            <p className="text-sm text-[#0f172a]">{record.address}</p>
          )}
          {record.industry && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
              <Building2 size={12} /> {record.industry}
            </span>
          )}
        </div>

        {/* Financial */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <CreditCard size={16} />
            <span className="text-xs font-medium uppercase">Financial</span>
          </div>
          {record.credit_limit !== null && (
            <p className="text-sm"><span className="text-[#64748b]">Credit Limit:</span> <span className="font-medium text-[#0f172a]">{fmt(record.credit_limit)}</span></p>
          )}
          {record.tax_id && (
            <p className="text-sm"><span className="text-[#64748b]">Tax ID:</span> <span className="font-medium text-[#0f172a]">{record.tax_id}</span></p>
          )}
        </div>

        {/* Summary stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <FileText size={16} />
            <span className="text-xs font-medium uppercase">Related Records</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-bold text-[#0f172a]">{record.quotations.length}</p>
              <p className="text-xs text-[#64748b]">Quotations</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-bold text-[#0f172a]">{record.sales_orders.length}</p>
              <p className="text-xs text-[#64748b]">Sales Orders</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-bold text-[#0f172a]">{record.invoices.length}</p>
              <p className="text-xs text-[#64748b]">Invoices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quotations */}
      {record.quotations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-[#64748b]" />
            <h3 className="text-sm font-semibold text-[#0f172a]">Quotations</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Number</TableHead>
                <TableHead className="px-5">Status</TableHead>
                <TableHead className="px-5">Valid Until</TableHead>
                <TableHead className="px-5 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.quotations.map((q) => {
                const qs = QUOTATION_STATUS[q.status] ?? QUOTATION_STATUS.DRAFT;
                return (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => router.push(`/erp/quotations/${q.id}`)}>
                    <TableCell className="px-5 font-medium text-[#0f172a]">{q.quotation_number}</TableCell>
                    <TableCell className="px-5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${qs.badge}`}>{qs.label}</span>
                    </TableCell>
                    <TableCell className="px-5 text-[#64748b]">{date(q.valid_until ?? null)}</TableCell>
                    <TableCell className="px-5 text-right font-medium">{fmt(q.total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sales Orders */}
      {record.sales_orders.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-[#64748b]" />
            <h3 className="text-sm font-semibold text-[#0f172a]">Sales Orders</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Number</TableHead>
                <TableHead className="px-5">Status</TableHead>
                <TableHead className="px-5 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.sales_orders.map((o) => {
                const os = SO_STATUS[o.status] ?? SO_STATUS.DRAFT;
                return (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/erp/sales-orders/${o.id}`)}>
                    <TableCell className="px-5 font-medium text-[#0f172a]">{o.order_number}</TableCell>
                    <TableCell className="px-5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${os.badge}`}>{os.label}</span>
                    </TableCell>
                    <TableCell className="px-5 text-right font-medium">{fmt(o.total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invoices */}
      {record.invoices.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <FileText size={16} className="text-[#64748b]" />
            <h3 className="text-sm font-semibold text-[#0f172a]">Invoices</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Number</TableHead>
                <TableHead className="px-5">Status</TableHead>
                <TableHead className="px-5">Posting Date</TableHead>
                <TableHead className="px-5 text-right">Total</TableHead>
                <TableHead className="px-5 text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.invoices.map((inv) => {
                const is = INV_STATUS[inv.status] ?? INV_STATUS.DRAFT;
                return (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/erp/accounts/${inv.id}`)}>
                    <TableCell className="px-5 font-medium text-[#0f172a]">{inv.invoice_number}</TableCell>
                    <TableCell className="px-5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${is.badge}`}>{is.label}</span>
                    </TableCell>
                    <TableCell className="px-5 text-[#64748b]">{date(inv.posting_date)}</TableCell>
                    <TableCell className="px-5 text-right font-medium">{fmt(inv.total)}</TableCell>
                    <TableCell className="px-5 text-right text-[#64748b]">{fmt(inv.outstanding_amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
