"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, User, Calendar, FileText, ShoppingCart, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

/* ── Types (match what page.tsx passes) ─────────────────────────── */
interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  item_code: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  delivered_qty: number;
}

interface Customer {
  id: string;
  customer_name: string;
  customer_code: string;
}

interface QuotationRef {
  id: string;
  quotation_number: string;
}

interface SalesOrderRecord {
  id: string;
  order_number: string;
  quotation_id: string | null;
  customer_id: string | null;
  customer_name: string;
  project_type: string | null;
  delivery_date: string | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  created_at: string;
  sales_order_items: SalesOrderItem[];
  customers: Customer | null;
  quotations: QuotationRef | null;
}

/* ── Status badge config ────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT:       { label: "Draft",       badge: "bg-gray-100 text-gray-700 border-gray-200" },
  TO_DELIVER:  { label: "To Deliver",  badge: "bg-blue-100 text-blue-700 border-blue-200" },
  TO_BILL:     { label: "To Bill",     badge: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED:   { label: "Completed",   badge: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:   { label: "Cancelled",   badge: "bg-red-100 text-red-700 border-red-200" },
};

const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const date = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SalesOrderDetailClient({ record }: { record: SalesOrderRecord }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/sales-orders")}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0f172a]">{record.order_number}</h1>
          <p className="text-sm text-[#64748b] mt-1">Sales Order</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <User size={16} />
            <span className="text-xs font-medium uppercase">Customer</span>
          </div>
          <p className="font-semibold text-[#0f172a]">{record.customer_name}</p>
          {record.customers && (
            <p className="text-sm text-[#64748b]">{record.customers.customer_code}</p>
          )}
          {record.project_type && (
            <p className="text-sm text-[#64748b]">{record.project_type}</p>
          )}
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Calendar size={16} />
            <span className="text-xs font-medium uppercase">Dates</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-[#64748b]">Created:</span> <span className="font-medium text-[#0f172a]">{date(record.created_at)}</span></p>
            <p><span className="text-[#64748b]">Delivery:</span> <span className="font-medium text-[#0f172a]">{date(record.delivery_date)}</span></p>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <FileText size={16} />
            <span className="text-xs font-medium uppercase">Totals</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-[#64748b]">Subtotal:</span> <span className="font-medium text-[#0f172a]">{fmt(record.subtotal)}</span></p>
            <p><span className="text-[#64748b]">Tax ({record.tax_rate}%):</span> <span className="font-medium text-[#0f172a]">{fmt(record.tax_amount)}</span></p>
            <p><span className="text-[#64748b]">Total:</span> <span className="font-bold text-[#0f172a]">{fmt(record.total)}</span></p>
          </div>
        </div>
      </div>

      {/* Source quotation link */}
      {record.quotations && (
        <div
          className="bg-blue-50 rounded-2xl shadow-sm border border-blue-100 p-4 flex items-center gap-3 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => router.push(`/dashboard/erp/quotations/${record.quotations!.id}`)}
        >
          <FileCheck size={20} className="text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">From Quotation</p>
            <p className="text-xs text-blue-600">{record.quotations.quotation_number}</p>
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#64748b]" />
          <h3 className="text-sm font-semibold text-[#0f172a]">Line Items</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Description</TableHead>
              <TableHead className="px-5">Item Code</TableHead>
              <TableHead className="px-5 text-right">Qty</TableHead>
              <TableHead className="px-5 text-right">Delivered</TableHead>
              <TableHead className="px-5 text-right">Rate</TableHead>
              <TableHead className="px-5 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {record.sales_order_items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-5 font-medium text-[#0f172a]">{item.description}</TableCell>
                <TableCell className="px-5 text-[#64748b]">{item.item_code || "—"}</TableCell>
                <TableCell className="px-5 text-right">{item.quantity}</TableCell>
                <TableCell className="px-5 text-right">
                  <span className={item.delivered_qty >= item.quantity ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                    {item.delivered_qty}
                  </span>
                </TableCell>
                <TableCell className="px-5 text-right">{fmt(item.rate)}</TableCell>
                <TableCell className="px-5 text-right font-medium">{fmt(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
