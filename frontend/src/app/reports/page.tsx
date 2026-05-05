"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, Scale, Clock, Receipt, FileText } from "lucide-react";

const reports = [
  { title: "Profit & Loss", desc: "Revenue, expenses, and net profit for any period", icon: TrendingUp, color: "bg-green-50 text-green-700" },
  { title: "Balance Sheet", desc: "Assets, liabilities, and equity as of a date", icon: Scale, color: "bg-blue-50 text-blue-700" },
  { title: "AR Aging", desc: "Outstanding customer invoices by age buckets", icon: Clock, color: "bg-yellow-50 text-yellow-700" },
  { title: "AP Aging", desc: "Outstanding supplier invoices by age buckets", icon: Clock, color: "bg-orange-50 text-orange-700" },
  { title: "Tax Summary", desc: "UAE VAT 5% — output tax, input tax, net payable", icon: Receipt, color: "bg-purple-50 text-purple-700" },
  { title: "General Ledger", desc: "All transactions with account-wise drill-down", icon: FileText, color: "bg-gray-50 text-gray-700" },
];

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Financial Reports</h1>
        <p className="text-sm text-gray-500">Generate and export financial reports for Aries Marine</p>
      </div>

      <div className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="flex items-end">
          <button className="px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy-light transition-colors">
            Generate All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy text-sm">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-1 bg-gold/10 text-gold text-xs rounded hover:bg-gold hover:text-white transition-colors">View</button>
                    <button className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 transition-colors">Export PDF</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
