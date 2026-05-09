"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, User, Calendar, FileText, Truck, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { submitDeliveryNote, cancelDeliveryNote } from "../actions";
import { toast } from "sonner";

interface Item { name: string; item_code: string; item_name: string; qty: number; uom: string; rate: number; amount: number; warehouse: string | null }
interface DNRecord { name: string; customer: string; customer_name: string | null; posting_date: string; status: string; grand_total: number; net_total: number; total_taxes_and_charges: number; currency: string; is_return: boolean; docstatus: number; company: string | null; project: string | null; po_no: string | null; transporter_name: string | null; lr_no: string | null; shipping_address: string | null; remarks: string | null; items: Item[] }

const STATUS: Record<string, { label: string; badge: string }> = {
  Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  Submitted: { label: "Submitted", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Cancelled: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};
const fmt = (v: number, c = "AED") => v.toLocaleString("en-AE", { style: "currency", currency: c });
const dt = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function DeliveryNoteDetailClient({ record }: { record: DNRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const cfg = STATUS[record.status] || STATUS.Draft;

  const handleSubmit = async () => {
    setLoading(true);
    const res = await submitDeliveryNote(record.name);
    if (res.success) { toast.success("Submitted"); router.push("/dashboard/erp/stock/delivery-notes"); }
    else toast.error(res.error);
    setLoading(false);
  };

  const handleCancel = async () => {
    setLoading(true);
    const res = await cancelDeliveryNote(record.name);
    if (res.success) { toast.success("Cancelled"); router.push("/dashboard/erp/stock/delivery-notes"); }
    else toast.error(res.error);
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/erp/stock/delivery-notes")}><ArrowLeft size={20} /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0f172a]">{record.name}</h1>
          <p className="text-sm text-[#64748b] mt-1">Delivery Note</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>{cfg.label}</span>
        {record.docstatus === 0 && <Button onClick={handleSubmit} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a45]">Submit</Button>}
        {record.docstatus === 1 && <Button variant="destructive" onClick={handleCancel} disabled={loading}>Cancel</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><User size={16} /><span className="text-xs font-medium uppercase">Customer</span></div>
          <p className="font-semibold text-[#0f172a]">{record.customer_name || record.customer}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><Calendar size={16} /><span className="text-xs font-medium uppercase">Dates</span></div>
          <p className="text-sm"><span className="text-[#64748b]">Posting:</span> <span className="font-medium">{dt(record.posting_date)}</span></p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#64748b]"><FileText size={16} /><span className="text-xs font-medium uppercase">Totals</span></div>
          <p className="text-sm"><span className="text-[#64748b]">Net:</span> <span className="font-medium">{fmt(record.net_total, record.currency)}</span></p>
          <p className="text-sm"><span className="text-[#64748b]">Tax:</span> <span className="font-medium">{fmt(record.total_taxes_and_charges, record.currency)}</span></p>
          <p className="text-sm"><span className="text-[#64748b]">Grand Total:</span> <span className="font-bold">{fmt(record.grand_total, record.currency)}</span></p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-[#0f172a]">Items ({record.items.length})</h3></div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Item Code</TableHead>
              <TableHead className="px-5">Item Name</TableHead>
              <TableHead className="px-5 text-right">Qty</TableHead>
              <TableHead className="px-5 text-right">Rate</TableHead>
              <TableHead className="px-5 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {record.items.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="px-5 font-mono text-xs">{item.item_code}</TableCell>
                <TableCell className="px-5 font-medium">{item.item_name}</TableCell>
                <TableCell className="px-5 text-right">{item.qty} {item.uom}</TableCell>
                <TableCell className="px-5 text-right">{fmt(item.rate, record.currency)}</TableCell>
                <TableCell className="px-5 text-right font-medium">{fmt(item.amount, record.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {record.remarks && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-[#94a3b8] uppercase mb-1">Remarks</p>
          <p className="text-sm text-[#64748b]">{record.remarks}</p>
        </div>
      )}
    </div>
  );
}
