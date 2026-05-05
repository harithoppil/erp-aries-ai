"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { TrendingUp, Scale, Clock, Receipt, FileText } from "lucide-react";

const reportDefs = [
  { key: "profit-loss", title: "Profit & Loss", desc: "Revenue, expenses, and net profit for any period", icon: TrendingUp, color: "bg-green-50 text-green-700" },
  { key: "balance-sheet", title: "Balance Sheet", desc: "Assets, liabilities, and equity as of a date", icon: Scale, color: "bg-blue-50 text-blue-700" },
  { key: "ar-aging", title: "AR Aging", desc: "Outstanding customer invoices by age buckets", icon: Clock, color: "bg-yellow-50 text-yellow-700" },
  { key: "ap-aging", title: "AP Aging", desc: "Outstanding supplier invoices by age buckets", icon: Clock, color: "bg-orange-50 text-orange-700" },
  { key: "tax-summary", title: "Tax Summary", desc: "UAE VAT 5% — output tax, input tax, net payable", icon: Receipt, color: "bg-purple-50 text-purple-700" },
  { key: "general-ledger", title: "General Ledger", desc: "All transactions with account-wise drill-down", icon: FileText, color: "bg-gray-50 text-gray-700" },
];

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  function getCompanyId(): string | null {
    try {
      const u = JSON.parse(localStorage.getItem("aries_user") || "{}");
      return u.company_id || null;
    } catch { return null; }
  }

  async function viewReport(key: string) {
    const companyId = getCompanyId();
    if (!companyId) { setError("No company selected. Please log in again."); return; }
    setLoading(key); setError(""); setResult(null);
    try {
      const endpoint = key === "general-ledger" ? `/accounting/general-ledger?company_id=${companyId}&from_date=${fromDate}&to_date=${toDate}` : `/reports/${key}?company_id=${companyId}&from_date=${fromDate}&to_date=${toDate}`;
      const data = await apiFetch(endpoint);
      setResult({ key, data });
    } catch (e: any) {
      setError(e.message || `Failed to load ${key}`);
    }
    setLoading(null);
  }

  async function exportPDF(key: string) {
    const companyId = getCompanyId();
    if (!companyId) { setError("No company selected. Please log in again."); return; }
    try {
      const endpoint = `/documents/report-pdf?report_type=${key}&company_id=${companyId}&from_date=${fromDate}&to_date=${toDate}`;
      const res = await apiFetch(endpoint);
      if (res.url) window.open(res.url, "_blank");
      else setError("PDF generation not yet available");
    } catch (e: any) {
      setError(e.message || "PDF export failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and export financial reports for Aries Marine</p>
      </div>

      <div className="flex gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 border border-input rounded-lg text-sm bg-background" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 border border-input rounded-lg text-sm bg-background" />
        </div>
      </div>

      {error && <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportDefs.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.key} className="bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => viewReport(r.key)}
                      disabled={loading === r.key}
                      className="px-3 py-1 bg-primary/10 text-primary text-xs rounded hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                    >
                      {loading === r.key ? "Loading..." : "View"}
                    </button>
                    <button
                      onClick={() => exportPDF(r.key)}
                      className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded hover:bg-muted/80 transition-colors"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result && (
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
          <h3 className="font-semibold text-foreground text-sm mb-3">
            {reportDefs.find(r => r.key === result.key)?.title} Result
          </h3>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-96">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
