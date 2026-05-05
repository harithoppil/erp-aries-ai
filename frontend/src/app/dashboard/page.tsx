"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Users, Package, Ship, FolderKanban, AlertTriangle } from "lucide-react";

interface KPICardProps { title: string; value: string; change?: string; up?: boolean; icon: any }
function KPICard({ title, value, change, up, icon: Icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-navy mt-1">{value}</p>
          {change && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-success" : "text-danger"}`}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change}
            </p>
          )}
        </div>
        <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-gold" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const companyId = "demo"; // Use actual company ID from auth

  useEffect(() => {
    apiFetch("/dashboard/summary?company_id=demo").then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  const kpi = data || {};
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of Aries Marine operations</p>
        </div>
        <div className="flex gap-2">
          <QuickAction label="New Quotation" href="/sales/quotations/new" />
          <QuickAction label="New Invoice" href="/sales/invoices/new" />
          <QuickAction label="New PO" href="/purchasing/purchase-orders/new" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Monthly Revenue" value={formatMoney(kpi.monthly_revenue)} change="+12.5% vs last month" up icon={DollarSign} />
        <KPICard title="Monthly Expenses" value={formatMoney(kpi.monthly_expenses)} change="+5.2% vs last month" up={false} icon={DollarSign} />
        <KPICard title="Net Profit" value={formatMoney(kpi.net_profit)} change="+18.3% margin" up icon={TrendingUp} />
        <KPICard title="Outstanding AR" value={formatMoney(kpi.outstanding_receivables)} change={`${kpi.outstanding_payables ? formatMoney(kpi.outstanding_payables) + " AP" : ""}`} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Stock Value" value={formatMoney(kpi.total_stock_value)} icon={Package} />
        <KPICard title="Active Projects" value={String(kpi.active_projects || 0)} icon={FolderKanban} />
        <KPICard title="Active Employees" value={String(kpi.active_employees || 0)} icon={Users} />
        <KPICard title="Vessel Utilization" value={`${kpi.vessel_utilization_pct || 0}%`} change={`${kpi.active_vessels || 0}/${kpi.total_vessels || 0} vessels`} icon={Ship} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-navy mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Sales Quotations", href: "/sales/quotations" },
              { label: "Purchase Orders", href: "/purchasing/purchase-orders" },
              { label: "Stock Balance", href: "/inventory/stock-balance" },
              { label: "Journal Entries", href: "/accounting/journal-entries" },
              { label: "Employee List", href: "/hr/employees" },
              { label: "Vessel Register", href: "/marine/vessels" },
              { label: "P&L Report", href: "/reports/profit-loss" },
              { label: "AI Assistant", href: "/ai" },
            ].map((link) => (
              <a key={link.href} href={link.href} className="px-3 py-2 bg-surface rounded-lg text-sm text-navy hover:bg-gold/10 hover:text-gold transition-colors">
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-navy mb-4">Alerts & Reminders</h3>
          <div className="space-y-2">
            {[
              { type: "warning", text: "Invoice SINV-0042 overdue by 45 days — AED 180,000" },
              { type: "danger", text: "Safety cert expiry: Dive helmets — 15 days remaining" },
              { type: "info", text: "PO-0156 delivery expected today — Supplier: TechnipFMC" },
              { type: "success", text: "Project "Zakum Platform C" completed — Revenue: AED 2.4M" },
              { type: "warning", text: "Low stock: Oxygen tanks (3 remaining, min: 10)" },
            ].map((alert, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                alert.type === "warning" ? "bg-yellow-50 text-yellow-700" :
                alert.type === "danger" ? "bg-red-50 text-red-700" :
                alert.type === "success" ? "bg-green-50 text-green-700" :
                "bg-blue-50 text-blue-700"
              }`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {alert.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} className="px-3 py-1.5 bg-gold/10 text-gold text-xs font-medium rounded-lg hover:bg-gold hover:text-white transition-colors">
      + {label}
    </a>
  );
}
