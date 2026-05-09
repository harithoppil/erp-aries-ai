"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  HandCoins,
  BarChart3,
  BookOpen,
  Receipt,
  CreditCard,
  Landmark,
  Calculator,
  Building2,
  PieChart,
  FolderTree,
  Settings,
  MoreHorizontal,
  ClipboardList,
  Share2,
  CalendarCheck,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMediaQuery } from "@/hooks/use-media-query";
import type {
  InvoicingDashboardData,
  AccountsAgeingData,
} from "@/app/dashboard/erp/accounts/actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReportMasterCard {
  title: string;
  items: { label: string; href: string; icon: React.ReactNode }[];
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function InvoicingDashboardSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>

          {/* Title skeleton */}
          <div>
            <div className="h-8 w-64 animate-pulse rounded bg-muted mb-2" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>

          {/* KPI cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-6 w-6 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-7 w-32 animate-pulse rounded bg-muted" />
                </div>
              ))}
          </div>

          {/* P&L + Ageing skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-muted mb-4" />
              <div className="h-40 animate-pulse rounded bg-muted" />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="h-5 w-48 animate-pulse rounded bg-muted mb-4" />
              <div className="space-y-3">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded bg-muted"
                    />
                  ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="h-5 w-44 animate-pulse rounded bg-muted mb-4" />
              <div className="space-y-3">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded bg-muted"
                    />
                  ))}
              </div>
            </div>
          </div>

          {/* Reports & Masters skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(9)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                >
                  <div className="h-5 w-32 animate-pulse rounded bg-muted mb-3" />
                  <div className="space-y-2">
                    {Array(2)
                      .fill(0)
                      .map((_, j) => (
                        <div
                          key={j}
                          className="h-4 w-full animate-pulse rounded bg-muted"
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="rounded-2xl shadow-sm border border-gray-100">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
            <span className="text-xs font-medium text-[#64748b] uppercase tracking-wide">
              {title}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal size={14} className="text-[#94a3b8]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Link href="/dashboard/erp/accounts/list">View All</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Export</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Ageing Table ───────────────────────────────────────────────────────────────

function AgeingCard({
  title,
  data,
}: {
  title: string;
  data: AccountsAgeingData;
}) {
  return (
    <Card className="rounded-2xl shadow-sm border border-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-medium text-[#64748b]">
                Age
              </TableHead>
              <TableHead className="text-xs font-medium text-[#64748b] text-right">
                Count
              </TableHead>
              <TableHead className="text-xs font-medium text-[#64748b] text-right">
                Amount (AED)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.buckets.map((bucket) => (
              <TableRow key={bucket.label}>
                <TableCell className="text-sm text-[#0f172a] font-medium py-2">
                  {bucket.label}
                </TableCell>
                <TableCell className="text-sm text-[#64748b] text-right py-2">
                  {bucket.count}
                </TableCell>
                <TableCell className="text-sm text-[#0f172a] text-right py-2 font-medium">
                  {bucket.total.toLocaleString("en-AE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <TableRow className="border-t-2 border-gray-200">
              <TableCell className="text-sm font-bold text-[#0f172a] py-2">
                Total
              </TableCell>
              <TableCell
                className="text-sm text-[#64748b] text-right py-2"
              >
                {data.buckets.reduce((s, b) => s + b.count, 0)}
              </TableCell>
              <TableCell className="text-sm text-right py-2 font-bold text-[#0f172a]">
                {data.totalOutstanding.toLocaleString("en-AE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          </tfoot>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Reports & Masters Card ─────────────────────────────────────────────────────

function MastersGroupCard({ title, items }: { title: string; items: ReportMasterCard["items"] }) {
  return (
    <Card className="rounded-2xl shadow-sm border border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-2 text-sm text-[#1e3a5f] hover:text-[#0f172a] hover:underline transition-colors py-0.5"
              >
                <span className="text-[#94a3b8]">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Mobile KPI Card ────────────────────────────────────────────────────────────

function MobileKpiCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
          {title}
        </span>
      </div>
      <p className="text-lg font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface InvoicingDashboardClientProps {
  dashboardData: InvoicingDashboardData;
  arAgeing: AccountsAgeingData;
  apAgeing: AccountsAgeingData;
}

export default function InvoicingDashboardClient({
  dashboardData,
  arAgeing,
  apAgeing,
}: InvoicingDashboardClientProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const reportGroups = useMemo<ReportMasterCard[]>(
    () => [
      {
        title: "Accounting Masters",
        items: [
          {
            label: "Company",
            href: "/dashboard/erp/setup/company",
            icon: <Building2 size={14} />,
          },
          {
            label: "Chart of Accounts",
            href: "/dashboard/erp/chart-of-accounts",
            icon: <FolderTree size={14} />,
          },
          {
            label: "Accounts Settings",
            href: "/dashboard/settings",
            icon: <Settings size={14} />,
          },
        ],
      },
      {
        title: "Payments",
        items: [
          {
            label: "Payment Entry",
            href: "/dashboard/erp/payments",
            icon: <CreditCard size={14} />,
          },
          {
            label: "Journal Entry",
            href: "/dashboard/erp/journal-entries",
            icon: <BookOpen size={14} />,
          },
        ],
      },
      {
        title: "Tax Masters",
        items: [
          {
            label: "Sales Tax Template",
            href: "#",
            icon: <Receipt size={14} />,
          },
          {
            label: "Purchase Tax Template",
            href: "#",
            icon: <Receipt size={14} />,
          },
        ],
      },
      {
        title: "Cost Center & Budgeting",
        items: [
          {
            label: "Budget",
            href: "/dashboard/erp/accounts/budgets",
            icon: <Calculator size={14} />,
          },
          {
            label: "Cost Centers",
            href: "/dashboard/erp/accounts/cost-centers",
            icon: <PieChart size={14} />,
          },
        ],
      },
      {
        title: "Banking",
        items: [
          {
            label: "Bank Accounts",
            href: "/dashboard/erp/accounts/bank-accounts",
            icon: <Landmark size={14} />,
          },
        ],
      },
      {
        title: "Opening & Closing",
        items: [
          {
            label: "Opening Invoice Tool",
            href: "#",
            icon: <ClipboardList size={14} />,
          },
        ],
      },
      {
        title: "Subscription Management",
        items: [
          {
            label: "Subscription",
            href: "#",
            icon: <CalendarCheck size={14} />,
          },
        ],
      },
      {
        title: "Share Management",
        items: [
          {
            label: "Shareholder",
            href: "#",
            icon: <Share2 size={14} />,
          },
        ],
      },
      {
        title: "Reports",
        items: [
          {
            label: "General Ledger",
            href: "/dashboard/erp/reports/general-ledger",
            icon: <BarChart3 size={14} />,
          },
          {
            label: "Trial Balance",
            href: "/dashboard/erp/reports/trial-balance",
            icon: <BarChart3 size={14} />,
          },
          {
            label: "Balance Sheet",
            href: "/dashboard/erp/reports/balance-sheet",
            icon: <BarChart3 size={14} />,
          },
          {
            label: "Profit & Loss",
            href: "/dashboard/erp/reports/profit-and-loss",
            icon: <BarChart3 size={14} />,
          },
        ],
      },
    ],
    []
  );

  // ── Mobile Render ──────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-5.5rem)]">
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="space-y-4 pb-4">
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
                  <BreadcrumbPage>Invoicing</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Title */}
            <div>
              <h1 className="text-xl font-bold text-[#0f172a]">Invoicing</h1>
              <p className="text-xs text-[#64748b] mt-1">
                Accounts dashboard overview
              </p>
            </div>

            {/* KPI cards - 2x2 grid on mobile */}
            <div className="grid grid-cols-2 gap-3">
              <MobileKpiCard
                title="Outgoing Bills"
                value={`AED ${dashboardData.totalOutgoing.toLocaleString("en-AE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                icon={<FileText size={14} className="text-blue-500" />}
                color="bg-blue-50"
              />
              <MobileKpiCard
                title="Incoming Bills"
                value={`AED ${dashboardData.totalIncoming.toLocaleString("en-AE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                icon={<Receipt size={14} className="text-purple-500" />}
                color="bg-purple-50"
              />
              <MobileKpiCard
                title="Incoming Payment"
                value={`AED ${dashboardData.totalIncomingPayment.toLocaleString("en-AE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                icon={<ArrowDownRight size={14} className="text-green-500" />}
                color="bg-green-50"
              />
              <MobileKpiCard
                title="Outgoing Payment"
                value={`AED ${dashboardData.totalOutgoingPayment.toLocaleString("en-AE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                icon={<ArrowUpRight size={14} className="text-amber-500" />}
                color="bg-amber-50"
              />
            </div>

            {/* P&L Placeholder */}
            <Card className="rounded-2xl shadow-sm border border-gray-100">
              <CardContent className="p-5 text-center">
                <BarChart3
                  size={32}
                  className="mx-auto mb-3 text-[#94a3b8]"
                />
                <p className="text-sm text-[#64748b]">
                  Select fiscal year to view P&amp;L
                </p>
              </CardContent>
            </Card>

            {/* AR Ageing */}
            <Card className="rounded-2xl shadow-sm border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Accounts Receivable Ageing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {arAgeing.buckets.map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#0f172a]">
                        {b.label}
                      </span>
                      <span className="text-[#64748b]">
                        {b.count} ({b.total.toLocaleString("en-AE", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AP Ageing */}
            <Card className="rounded-2xl shadow-sm border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Accounts Payable Ageing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {apAgeing.buckets.map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#0f172a]">
                        {b.label}
                      </span>
                      <span className="text-[#64748b]">
                        {b.count} ({b.total.toLocaleString("en-AE", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reports & Masters */}
            <div className="grid grid-cols-1 gap-3">
              {reportGroups.map((group) => (
                <Card
                  key={group.title}
                  className="rounded-2xl shadow-sm border border-gray-100"
                >
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold text-[#0f172a]">
                      {group.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="text-xs text-[#1e3a5f] hover:text-[#0f172a] hover:underline"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop Render ─────────────────────────────────────────────────────────

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
                <BreadcrumbPage>Invoicing</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]">Invoicing</h1>
            <p className="text-sm text-[#64748b] mt-1">
              Accounts dashboard overview
            </p>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              title="Total Outgoing Bills"
              value={`AED ${dashboardData.totalOutgoing.toLocaleString("en-AE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={<FileText size={16} className="text-blue-500" />}
              color="bg-blue-50"
            />
            <KpiCard
              title="Total Incoming Bills"
              value={`AED ${dashboardData.totalIncoming.toLocaleString("en-AE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={<Receipt size={16} className="text-purple-500" />}
              color="bg-purple-50"
            />
            <KpiCard
              title="Total Incoming Payment"
              value={`AED ${dashboardData.totalIncomingPayment.toLocaleString("en-AE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={
                <ArrowDownRight size={16} className="text-green-500" />
              }
              color="bg-green-50"
            />
            <KpiCard
              title="Total Outgoing Payment"
              value={`AED ${dashboardData.totalOutgoingPayment.toLocaleString("en-AE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={<ArrowUpRight size={16} className="text-amber-500" />}
              color="bg-amber-50"
            />
          </div>

          {/* P&L + Ageing Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Profit & Loss Placeholder */}
            <Card className="rounded-2xl shadow-sm border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#94a3b8]" />
                  Profit and Loss
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[200px] text-center">
                <div className="p-4 rounded-full bg-gray-50 mb-4">
                  <HandCoins size={32} className="text-[#94a3b8]" />
                </div>
                <p className="text-sm text-[#64748b]">
                  Select fiscal year to view P&amp;L
                </p>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Configure fiscal year in account settings
                </p>
              </CardContent>
            </Card>

            {/* Accounts Receivable Ageing */}
            <AgeingCard title="Accounts Receivable Ageing" data={arAgeing} />

            {/* Accounts Payable Ageing */}
            <AgeingCard title="Accounts Payable Ageing" data={apAgeing} />
          </div>

          {/* Reports & Masters Grid */}
          <div>
            <h2 className="text-base font-semibold text-[#0f172a] mb-3">
              Reports &amp; Masters
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {reportGroups.map((group) => (
                <MastersGroupCard
                  key={group.title}
                  title={group.title}
                  items={group.items}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { InvoicingDashboardSkeleton };
