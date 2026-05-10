import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  ShoppingCart, Store, Package, Factory, FolderKanban,
  Calculator, Building2, ShieldCheck, Users, Headphones,
  UserCog, Settings, LayoutDashboard, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const MODULES = [
  { label: "Selling", icon: ShoppingCart, href: "/dashboard/erp/selling/dashboard", color: "bg-blue-500/10 text-blue-500" },
  { label: "Buying", icon: Store, href: "/dashboard/erp/buying/dashboard", color: "bg-green-500/10 text-green-500" },
  { label: "Stock", icon: Package, href: "/dashboard/erp/stock/dashboard", color: "bg-amber-500/10 text-amber-500" },
  { label: "Manufacturing", icon: Factory, href: "/dashboard/erp/manufacturing/dashboard", color: "bg-purple-500/10 text-purple-500" },
  { label: "Projects", icon: FolderKanban, href: "/dashboard/erp/projects/dashboard", color: "bg-cyan-500/10 text-cyan-500" },
  { label: "Accounting", icon: Calculator, href: "/dashboard/erp/accounting/dashboard", color: "bg-red-500/10 text-red-500" },
  { label: "Assets", icon: Building2, href: "/dashboard/erp/assets/dashboard", color: "bg-orange-500/10 text-orange-500" },
  { label: "Quality", icon: ShieldCheck, href: "/dashboard/erp/quality/dashboard", color: "bg-teal-500/10 text-teal-500" },
  { label: "CRM", icon: Users, href: "/dashboard/erp/crm", color: "bg-pink-500/10 text-pink-500" },
  { label: "Support", icon: Headphones, href: "/dashboard/erp/support/issues", color: "bg-indigo-500/10 text-indigo-500" },
  { label: "HR", icon: UserCog, href: "/dashboard/erp/hr", color: "bg-yellow-500/10 text-yellow-500" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings", color: "bg-slate-500/10 text-slate-500" },
];

async function getKPIs() {
  try {
    const [customers, suppliers, items, salesOrders, purchaseOrders, projects] = await Promise.all([
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.item.count(),
      prisma.salesOrder.count(),
      prisma.purchaseOrder.count(),
      prisma.project.count(),
    ]);
    return { customers, suppliers, items, salesOrders, purchaseOrders, projects };
  } catch {
    return { customers: 0, suppliers: 0, items: 0, salesOrders: 0, purchaseOrders: 0, projects: 0 };
  }
}

export default async function DashboardPage() {
  const kpis = await getKPIs();

  const kpiCards = [
    { label: "Customers", value: kpis.customers, href: "/dashboard/erp/customer", color: "text-blue-500" },
    { label: "Suppliers", value: kpis.suppliers, href: "/dashboard/erp/supplier", color: "text-green-500" },
    { label: "Items", value: kpis.items, href: "/dashboard/erp/item", color: "text-amber-500" },
    { label: "Sales Orders", value: kpis.salesOrders, href: "/dashboard/erp/sales-order", color: "text-blue-600" },
    { label: "Purchase Orders", value: kpis.purchaseOrders, href: "/dashboard/erp/purchase-order", color: "text-green-600" },
    { label: "Projects", value: kpis.projects, href: "/dashboard/erp/project", color: "text-cyan-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">ERP Dashboard</h1>
          <p className="text-[11px] text-muted-foreground">Aries Marine — Enterprise Resource Planning</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </p>
                <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Modules</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {MODULES.map((mod) => (
            <Link key={mod.label} href={mod.href}>
              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${mod.color}`}>
                    <mod.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium">{mod.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/dashboard/erp/quotation" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Quotations
          </Link>
          <Link href="/dashboard/erp/sales-invoice" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Sales Invoices
          </Link>
          <Link href="/dashboard/erp/stock-entry" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <Package className="h-4 w-4" /> Stock Entries
          </Link>
          <Link href="/dashboard/erp/journal-entry" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Journal Entries
          </Link>
          <Link href="/dashboard/erp/work-order" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <Factory className="h-4 w-4" /> Work Orders
          </Link>
          <Link href="/dashboard/erp/task" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <FolderKanban className="h-4 w-4" /> Tasks
          </Link>
          <Link href="/dashboard/erp/lead" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <Users className="h-4 w-4" /> Leads
          </Link>
          <Link href="/dashboard/erp/employee" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Employees
          </Link>
        </div>
      </div>
    </div>
  );
}
