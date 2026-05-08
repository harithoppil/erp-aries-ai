"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Calendar, Mail, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

/* ── Types (match what page.tsx passes) ─────────────────────────── */
interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_code: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface PaymentEntry {
  id: string;
  invoice_id: string | null;
  payment_type: string;
  party_type: string;
  party_name: string;
  amount: number;
  currency: string;
  reference_number: string | null;
  reference_date: string | null;
  posting_date: string;
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  enquiry_id: string | null;
  customer_name: string;
  customer_email: string | null;
  posting_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  paid_amount: number;
  outstanding_amount: number;
  document_id: string | null;
  created_at: string;
  invoice_items: InvoiceItem[];
  payment_entries: PaymentEntry[];
}

/* ── Status badge config ────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT:      { label: "Draft",      badge: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED:  { label: "Submitted",  badge: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID:       { label: "Paid",       badge: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:  { label: "Cancelled",  badge: "bg-red-100 text-red-700 border-red-200" },
  OVERDUE:    { label: "Overdue",    badge: "bg-amber-100 text-amber-700 border-amber-200" },
};

const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const date = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function InvoiceDetailClient({ record }: { record: InvoiceRecord }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/accounts")}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0f172a]">{record.invoice_number}</h1>
          <p className="text-sm text-[#64748b] mt-1">Sales Invoice</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <FileText size={16} />
            <span className="text-xs font-medium uppercase">Customer</span>
          </div>
          <p className="font-semibold text-[#0f172a]">{record.customer_name}</p>
          {record.customer_email && (
            <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
              <Mail size={14} />
              {record.customer_email}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Calendar size={16} />
            <span className="text-xs font-medium uppercase">Dates</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-[#64748b]">Posting:</span> <span className="font-medium text-[#0f172a]">{date(record.posting_date)}</span></p>
            <p><span className="text-[#64748b]">Due:</span> <span className="font-medium text-[#0f172a]">{date(record.due_date)}</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Receipt size={16} />
            <span className="text-xs font-medium uppercase">Totals</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-[#64748b]">Subtotal:</span> <span className="font-medium text-[#0f172a]">{fmt(record.subtotal)}</span></p>
            <p><span className="text-[#64748b]">Tax ({record.tax_rate}%):</span> <span className="font-medium text-[#0f172a]">{fmt(record.tax_amount)}</span></p>
            <p><span className="text-[#64748b]">Total:</span> <span className="font-bold text-[#0f172a]">{fmt(record.total)}</span></p>
          </div>
        </div>
      </div>

      {/* Payment summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-2xl shadow-sm border border-green-100 p-4 text-center">
          <p className="text-xs font-medium text-green-600 uppercase">Paid</p>
          <p className="text-xl font-bold text-green-700 mt-1">{fmt(record.paid_amount)}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-100 p-4 text-center">
          <p className="text-xs font-medium text-amber-600 uppercase">Outstanding</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{fmt(record.outstanding_amount)}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-100 p-4 text-center">
          <p className="text-xs font-medium text-blue-600 uppercase">Currency</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{record.currency}</p>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-[#0f172a]">Line Items</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Description</TableHead>
              <TableHead className="px-5">Item Code</TableHead>
              <TableHead className="px-5 text-right">Qty</TableHead>
              <TableHead className="px-5 text-right">Rate</TableHead>
              <TableHead className="px-5 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {record.invoice_items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-5 font-medium text-[#0f172a]">{item.description}</TableCell>
                <TableCell className="px-5 text-[#64748b]">{item.item_code || "—"}</TableCell>
                <TableCell className="px-5 text-right">{item.quantity}</TableCell>
                <TableCell className="px-5 text-right">{fmt(item.rate)}</TableCell>
                <TableCell className="px-5 text-right font-medium">{fmt(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment entries */}
      {record.payment_entries.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-[#0f172a]">Payment Entries</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Date</TableHead>
                <TableHead className="px-5">Type</TableHead>
                <TableHead className="px-5">Reference</TableHead>
                <TableHead className="px-5 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.payment_entries.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="px-5">{date(p.posting_date)}</TableCell>
                  <TableCell className="px-5 text-[#64748b]">{p.payment_type}</TableCell>
                  <TableCell className="px-5 text-[#64748b]">{p.reference_number || "—"}</TableCell>
                  <TableCell className="px-5 text-right font-medium">{fmt(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
