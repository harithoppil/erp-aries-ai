"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ReportsSummary } from "@/app/dashboard/erp/reports/actions";
import {
  BarChart3, DollarSign, Users, FolderKanban, Package,
  Wrench, TrendingUp, TrendingDown, Clock, AlertTriangle,
  CheckCircle, Receipt, CreditCard,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface ReportsClientProps {
  initialData: ReportsSummary | null;
}

export default function ReportsClient({ initialData }: ReportsClientProps) {
  const data = initialData;

  const stats = useMemo(() => {
    if (!data) return null;

    const totalInvoiced = data.invoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalPaid = data.payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalOutstanding = data.invoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0);
    const overdueInvoices = data.invoices.filter((i) => i.status === "overdue").length;

    const activeProjects = data.projects.filter((p) => p.status === "active").length;
    const projectValue = data.projects.reduce((s, p) => s + (p.estimated_cost || 0), 0);

    const totalHours = data.timesheets.reduce((s, t) => s + (t.hours || 0), 0);
    const billableHours = data.timesheets.filter((t) => t.billable).reduce((s, t) => s + (t.hours || 0), 0);

    const expiringCerts = data.certifications.filter((c) => c.status === "expiring_soon").length;
    const expiredCerts = data.certifications.filter((c) => c.status === "expired").length;

    const maintenanceAssets = data.assets.filter((a) => a.status === "maintenance").length;
    const calibrationDue = data.assets.filter((a) => {
      if (!a.next_calibration_date) return false;
      const d = new Date(a.next_calibration_date);
      const now = new Date();
      const days = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return days < 30;
    }).length;

    const lowStock = data.items.filter((i) => i.reorder_level && i.stock_qty < i.reorder_level).length;

    return {
      totalInvoiced, totalPaid, totalOutstanding, overdueInvoices,
      activeProjects, projectValue, totalProjects: data.projects.length,
      totalHours, billableHours, totalPersonnel: data.personnel.length,
      expiringCerts, expiredCerts, totalCerts: data.certifications.length,
      maintenanceAssets, calibrationDue, totalAssets: data.assets.length,
      lowStock, totalItems: data.items.length,
    };
  }, [data]);

  if (!stats) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/erp">ERP</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Reports</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">Reports &amp; Analytics</h2>
            <p className="text-sm text-[#64748b] mt-1">Cross-module summary and key metrics</p>
          </div>

          {/* Financial Overview */}
          <section>
            <h3 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign size={16} /> Financial Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Receipt} label="Total Invoiced" value={`AED ${stats.totalInvoiced.toLocaleString()}`} color="text-blue-600" />
              <StatCard icon={CreditCard} label="Total Paid" value={`AED ${stats.totalPaid.toLocaleString()}`} color="text-green-600" />
              <StatCard icon={TrendingDown} label="Outstanding" value={`AED ${stats.totalOutstanding.toLocaleString()}`} color="text-red-600" />
              <StatCard icon={AlertTriangle} label="Overdue Invoices" value={stats.overdueInvoices.toString()} color="text-amber-600" />
            </div>
          </section>

          {/* Projects */}
          <section>
            <h3 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
              <FolderKanban size={16} /> Projects
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={FolderKanban} label="Total Projects" value={stats.totalProjects.toString()} color="text-[#64748b]" />
              <StatCard icon={CheckCircle} label="Active Projects" value={stats.activeProjects.toString()} color="text-green-600" />
              <StatCard icon={TrendingUp} label="Estimated Value" value={`AED ${stats.projectValue.toLocaleString()}`} color="text-blue-600" />
              <StatCard icon={Clock} label="Total Hours Logged" value={stats.totalHours.toFixed(1)} color="text-purple-600" />
            </div>
          </section>

          {/* HR & Compliance */}
          <section>
            <h3 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users size={16} /> Personnel &amp; Compliance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Personnel" value={stats.totalPersonnel.toString()} color="text-[#64748b]" />
              <StatCard icon={Clock} label="Billable Hours" value={stats.billableHours.toFixed(1)} color="text-green-600" />
              <StatCard icon={AlertTriangle} label="Expiring Certs" value={stats.expiringCerts.toString()} color="text-amber-600" />
              <StatCard icon={TrendingDown} label="Expired Certs" value={stats.expiredCerts.toString()} color="text-red-600" />
            </div>
          </section>

          {/* Assets & Stock */}
          <section>
            <h3 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package size={16} /> Assets &amp; Stock
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Wrench} label="Total Assets" value={stats.totalAssets.toString()} color="text-[#64748b]" />
              <StatCard icon={AlertTriangle} label="In Maintenance" value={stats.maintenanceAssets.toString()} color="text-amber-600" />
              <StatCard icon={Clock} label="Calibration Due (&lt;30d)" value={stats.calibrationDue.toString()} color="text-red-600" />
              <StatCard icon={Package} label="Low Stock Items" value={stats.lowStock.toString()} color="text-orange-600" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs font-medium text-[#64748b] uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
