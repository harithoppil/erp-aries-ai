"use client";

import Link from "next/link";
import {
  ArrowLeft, Wallet, Calendar, Receipt, User,
  FileText, DollarSign, ArrowRightLeft, Hash,
} from "lucide-react";

const PAYMENT_TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  receive: { label: "Received", badge: "bg-green-100 text-green-700 border-green-200" },
  pay: { label: "Paid", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  internal: { label: "Internal", badge: "bg-blue-100 text-blue-700 border-blue-200" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface PaymentRecord {
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
  sales_invoices: {
    id: string;
    invoice_number: string;
    customer_name: string;
    status: string;
    total: number;
    paid_amount: number;
    outstanding_amount: number;
    currency: string;
    due_date: string | null;
    posting_date: string;
    invoice_items: {
      id: string;
      description: string;
      quantity: number;
      rate: number;
      amount: number;
    }[];
  } | null;
}

export default function PaymentDetailClient({ record }: { record: PaymentRecord }) {
  const typeCfg = PAYMENT_TYPE_CONFIG[record.payment_type] || PAYMENT_TYPE_CONFIG.receive;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Back */}
          <div className="flex items-center gap-4">
            <Link
              href="/erp/payments"
              className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#1e3a5f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Payments
            </Link>
          </div>

          {/* Payment Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                    <Wallet size={20} className="text-[#1e3a5f]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#0f172a]">Payment Entry</h1>
                    <p className="text-sm font-mono text-[#64748b]">
                      {record.reference_number || record.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${typeCfg.badge}`}>
                    <ArrowRightLeft size={12} /> {typeCfg.label}
                  </span>
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                    {record.party_type}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#0f172a]">
                  AED {record.amount.toLocaleString()}
                </p>
                <p className="text-sm text-[#64748b]">{record.currency}</p>
              </div>
            </div>

            {/* Payment Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#64748b]" />
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase">Posting Date</p>
                  <p className="text-sm font-medium text-[#0f172a]">{formatDate(record.posting_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} className="text-[#64748b]" />
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase">Party</p>
                  <p className="text-sm font-medium text-[#0f172a]">{record.party_name}</p>
                </div>
              </div>
              {record.reference_number && (
                <div className="flex items-center gap-2">
                  <Hash size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Reference</p>
                    <p className="text-sm font-mono font-medium text-[#0f172a]">{record.reference_number}</p>
                  </div>
                </div>
              )}
              {record.reference_date && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Reference Date</p>
                    <p className="text-sm font-medium text-[#0f172a]">{formatDate(record.reference_date)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linked Invoice */}
          {record.sales_invoices && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Receipt size={18} className="text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-[#0f172a]">Linked Invoice</h2>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-medium text-[#0f172a] text-lg">{record.sales_invoices.invoice_number}</p>
                    <p className="text-sm text-[#64748b]">{record.sales_invoices.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                      record.sales_invoices.status === "PAID"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : record.sales_invoices.status === "OVERDUE"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                    }`}>
                      {record.sales_invoices.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Invoice Total</p>
                    <p className="text-sm font-medium text-[#0f172a]">AED {record.sales_invoices.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Paid Amount</p>
                    <p className="text-sm font-medium text-green-700">AED {record.sales_invoices.paid_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Outstanding</p>
                    <p className={`text-sm font-medium ${record.sales_invoices.outstanding_amount > 0 ? "text-red-700" : "text-green-700"}`}>
                      AED {record.sales_invoices.outstanding_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Due Date</p>
                    <p className="text-sm font-medium text-[#0f172a]">{formatDate(record.sales_invoices.due_date)}</p>
                  </div>
                </div>

                {/* Invoice Items */}
                {record.sales_invoices.invoice_items.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-[#94a3b8] uppercase mb-2">Line Items</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-700 font-semibold">Description</th>
                            <th className="text-center px-3 py-2 text-gray-700 font-semibold">Qty</th>
                            <th className="text-right px-3 py-2 text-gray-700 font-semibold">Rate</th>
                            <th className="text-right px-3 py-2 text-gray-700 font-semibold">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {record.sales_invoices.invoice_items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-[#0f172a]">{item.description}</td>
                              <td className="px-3 py-2 text-center text-[#64748b]">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-[#64748b]">AED {item.rate.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium text-[#0f172a]">AED {item.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Linked Invoice */}
          {!record.sales_invoices && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <FileText size={18} className="text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-[#0f172a]">Linked Invoice</h2>
              </div>
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <FileText size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No invoice linked to this payment</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
