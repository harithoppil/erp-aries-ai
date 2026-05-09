"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePageContext } from "@/hooks/usePageContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Package,
  FileText,
  ClipboardList,
  Mail,
  Quote,
  Box,
  Tag,
  List,
  Settings,
  Truck,
  Users,
  LayoutGrid,
  ListFilter,
  Bookmark,
  Plus,
  MoreHorizontal,
  Filter,
} from "lucide-react";
import type { BuyingDashboardData } from "./actions";

// ── Chart Config ────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  totalAmount: {
    label: "Purchase Amount (AED)",
    color: "#1e3a5f",
  },
  orderCount: {
    label: "Order Count",
    color: "#0ea5e9",
  },
};

// ── Types ───────────────────────────────────────────────────────────────────

interface BuyingDashboardClientProps {
  data: BuyingDashboardData;
}

interface GridItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatAed(value: number): string {
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(1)}K`;
  return `AED ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Section Data ────────────────────────────────────────────────────────────

const BUYING_ITEMS: GridItem[] = [
  { label: "Material Request", href: "/dashboard/erp/material-requests", icon: <ClipboardList size={16} /> },
  { label: "Purchase Order", href: "/dashboard/erp/procurement", icon: <ShoppingCart size={16} /> },
  { label: "Purchase Invoice", href: "/dashboard/erp/buying/invoices", icon: <FileText size={16} /> },
  { label: "Request for Quotation", href: "/dashboard/erp/buying/rfq", icon: <Mail size={16} /> },
  { label: "Supplier Quotation", href: "/dashboard/erp/quotations", icon: <Quote size={16} /> },
];

const ITEMS_PRICING: GridItem[] = [
  { label: "Item", href: "/dashboard/erp/stock", icon: <Box size={16} /> },
  { label: "Item Price", href: "#", icon: <Tag size={16} /> },
  { label: "Price List", href: "#", icon: <List size={16} /> },
];

const SETTINGS_ITEMS: GridItem[] = [
  { label: "Buying Settings", href: "/dashboard/settings", icon: <Settings size={16} /> },
];

const SUPPLIER_ITEMS: GridItem[] = [
  { label: "Supplier", href: "/dashboard/erp/procurement", icon: <Truck size={16} /> },
  { label: "Supplier Group", href: "#", icon: <Users size={16} /> },
];

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f]">
            {icon}
          </div>
          <span className="text-xs font-medium text-[#64748b] uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
        <p className="text-xs text-[#94a3b8] mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function SectionGrid({ title, items }: { title: string; items: GridItem[] }) {
  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1.5">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#334155] hover:bg-gray-50 hover:text-[#1e3a5f] transition-colors group"
            >
              <span className="text-[#64748b] group-hover:text-[#1e3a5f] transition-colors">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              <span className="text-[#cbd5e1] group-hover:text-[#94a3b8] transition-colors text-xs">
                &rarr;
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Mobile variant ──────────────────────────────────────────────────────────

function MobileBuyingDashboard({ data }: BuyingDashboardClientProps) {
  const [activeTab, setActiveTab] = useState("reports");

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-5 pb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Buying</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Purchase Order Trends
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Filter size={14} className="text-[#64748b]" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal size={14} className="text-[#64748b]" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    tickFormatter={(v: number) => formatAed(v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="totalAmount"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="space-y-3">
            <KpiCard
              icon={<ShoppingCart size={16} />}
              label="Purchase Orders"
              value={data.orderCount.toString()}
              subtitle="Submitted orders"
            />
            <KpiCard
              icon={<DollarSign size={16} />}
              label="Total Purchase Amount"
              value={formatAed(data.totalAmount)}
              subtitle="AED across all orders"
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Average Order Value"
              value={formatAed(data.avgOrderValue)}
              subtitle="Per submitted order"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 rounded-xl p-1 w-full">
              <TabsTrigger value="reports" className="flex-1 data-[active]:bg-white data-[active]:shadow-sm rounded-lg text-xs">
                Reports
              </TabsTrigger>
              <TabsTrigger value="masters" className="flex-1 data-[active]:bg-white data-[active]:shadow-sm rounded-lg text-xs">
                Masters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="mt-4 space-y-3">
              <SectionGrid title="Buying" items={BUYING_ITEMS} />
              <SectionGrid title="Items & Pricing" items={ITEMS_PRICING} />
              <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
            </TabsContent>

            <TabsContent value="masters" className="mt-4 space-y-3">
              <SectionGrid title="Supplier" items={SUPPLIER_ITEMS} />
              <SectionGrid title="Items & Pricing" items={ITEMS_PRICING} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Desktop variant ─────────────────────────────────────────────────────────

function DesktopBuyingDashboard({ data }: BuyingDashboardClientProps) {
  const [activeTab, setActiveTab] = useState("reports");

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[#64748b]">Buying</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Purchase Order Trends
                </CardTitle>
                <CardAction>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs h-8">
                      <Filter size={13} />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg">
                      <MoreHorizontal size={14} className="text-[#64748b]" />
                    </Button>
                  </div>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                    tickFormatter={(v: number) => formatAed(v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="totalAmount"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* 3 KPI Cards */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              icon={<ShoppingCart size={16} />}
              label="Purchase Orders"
              value={data.orderCount.toString()}
              subtitle="Submitted orders"
            />
            <KpiCard
              icon={<DollarSign size={16} />}
              label="Total Purchase Amount"
              value={formatAed(data.totalAmount)}
              subtitle="AED across all orders"
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Average Order Value"
              value={formatAed(data.avgOrderValue)}
              subtitle="Per submitted order"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 rounded-xl p-1">
              <TabsTrigger value="reports" className="data-[active]:bg-white data-[active]:shadow-sm rounded-lg text-sm px-4">
                Reports
              </TabsTrigger>
              <TabsTrigger value="masters" className="data-[active]:bg-white data-[active]:shadow-sm rounded-lg text-sm px-4">
                Masters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <SectionGrid title="Buying" items={BUYING_ITEMS} />
                <SectionGrid title="Items & Pricing" items={ITEMS_PRICING} />
                <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
              </div>
            </TabsContent>

            <TabsContent value="masters" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <SectionGrid title="Supplier" items={SUPPLIER_ITEMS} />
                <SectionGrid title="Items & Pricing" items={ITEMS_PRICING} />
                <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function BuyingDashboardClient({ data }: BuyingDashboardClientProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  usePageContext(
    `Buying Dashboard: ${data.orderCount} purchase orders, ${formatAed(data.totalAmount)} total value, ${formatAed(data.avgOrderValue)} average order value`
  );

  if (isMobile) {
    return <MobileBuyingDashboard data={data} />;
  }
  return <DesktopBuyingDashboard data={data} />;
}
