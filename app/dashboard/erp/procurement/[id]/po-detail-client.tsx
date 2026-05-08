"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Truck, Calendar, FileText, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

/* ── Types (match what page.tsx passes) ─────────────────────────── */
interface POItem {
  id: string;
  po_id: string;
  item_code: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Supplier {
  id: string;
  supplier_name: string;
  supplier_code: string;
  email: string | null;
  phone: string | null;
}

interface Project {
  id: string;
  project_name: string;
  project_code: string;
}

interface PORecord {
  id: string;
  po_number: string;
  supplier_id: string;
  project_id: string | null;
  status: string;
  order_date: string;
  expected_delivery: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  created_at: string;
  po_items: POItem[];
  suppliers: Supplier | null;
  projects: Project | null;
}

/* ── Status badge config ────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT:     { label: "Draft",     badge: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED:  { label: "Approved",  badge: "bg-green-100 text-green-700 border-green-200" },
  RECEIVED:  { label: "Received",  badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};

const fmt = (v: number) => v.toLocaleString("en-AE", { style: "currency", currency: "AED" });
const date = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PODetailClient({ record }: { record: PORecord }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/procurement")}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0f172a]">{record.po_number}</h1>
          <p className="text-sm text-[#64748b] mt-1">Purchase Order</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Truck size={16} />
            <span className="text-xs font-medium uppercase">Supplier</span>
          </div>
          {record.suppliers ? (
            <>
              <p className="font-semibold text-[#0f172a]">{record.suppliers.supplier_name}</p>
              <p className="text-sm text-[#64748b]">{record.suppliers.supplier_code}</p>
              {record.suppliers.email && <p className="text-sm text-[#64748b]">{record.suppliers.email}</p>}
              {record.suppliers.phone && <p className="text-sm text-[#64748b]">{record.suppliers.phone}</p>}
            </>
          ) : (
            <p className="text-sm text-[#64748b]">No supplier linked</p>
          )}
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Calendar size={16} />
            <span className="text-xs font-medium uppercase">Dates</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-[#64748b]">Order Date:</span> <span className="font-medium text-[#0f172a]">{date(record.order_date)}</span></p>
            <p><span className="text-[#64748b]">Expected Delivery:</span> <span className="font-medium text-[#0f172a]">{date(record.expected_delivery)}</span></p>
          </div>
        </div>

        {/* Project + Totals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]">
            <FileText size={16} />
            <span className="text-xs font-medium uppercase">Summary</span>
          </div>
          {record.projects && (
            <p className="text-sm"><span className="text-[#64748b]">Project:</span> <span className="font-medium text-[#0f172a]">{record.projects.project_name} ({record.projects.project_code})</span></p>
          )}
          <div className="space-y-1 text-sm">
            <p><span className="text-[#64748b]">Subtotal:</span> <span className="font-medium text-[#0f172a]">{fmt(record.subtotal)}</span></p>
            <p><span className="text-[#64748b]">Tax:</span> <span className="font-medium text-[#0f172a]">{fmt(record.tax_amount)}</span></p>
            <p><span className="text-[#64748b]">Total:</span> <span className="font-bold text-[#0f172a]">{fmt(record.total)}</span></p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {record.notes && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#64748b]">
            <StickyNote size={16} />
            <span className="text-xs font-medium uppercase">Notes</span>
          </div>
          <p className="text-sm text-[#0f172a] whitespace-pre-wrap">{record.notes}</p>
        </div>
      )}

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
            {record.po_items.map((item) => (
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
    </div>
  );
}
