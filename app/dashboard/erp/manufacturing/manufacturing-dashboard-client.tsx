'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Factory,
  Wrench,
  DollarSign,
  ClipboardList,
  Package,
  FileText,
  Settings,
  Cog,
  LayoutGrid,
  Hammer,
  CalendarClock,
  BarChart3,
  Truck,
  ArrowRightLeft,
  Clock,
  Tag,
  List,
  Box,
  Route,
  Filter,
  MoreHorizontal,
  TrendingUp,
  Layers,
} from 'lucide-react';
import type { ManufacturingDashboardData, ProductionTrendPoint } from './actions';

// ── Chart Config ────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  producedQty: {
    label: 'Produced Quantity',
    color: '#1e3a5f',
  },
  orderCount: {
    label: 'Work Orders',
    color: '#0ea5e9',
  },
};

// ── Types ───────────────────────────────────────────────────────────────────

interface ManufacturingDashboardClientProps {
  dashboardData: ManufacturingDashboardData;
  trendData: ProductionTrendPoint[];
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

const PRODUCTION_ITEMS: GridItem[] = [
  { label: 'Work Order', href: '/dashboard/erp/manufacturing/work-orders', icon: <ClipboardList size={16} /> },
  { label: 'Production Plan', href: '#', icon: <LayoutGrid size={16} /> },
  { label: 'Stock Entry', href: '/dashboard/erp/stock/entries', icon: <ArrowRightLeft size={16} /> },
  { label: 'Job Card', href: '/dashboard/erp/manufacturing/job-cards', icon: <Hammer size={16} /> },
  { label: 'Item Lead Time', href: '#', icon: <Clock size={16} /> },
  { label: 'Master Production Schedule', href: '#', icon: <CalendarClock size={16} /> },
  { label: 'Downtime Entry', href: '#', icon: <BarChart3 size={16} /> },
  { label: 'Sales Forecast', href: '#', icon: <TrendingUp size={16} /> },
];

const BOM_ITEMS: GridItem[] = [
  { label: 'Item', href: '/dashboard/erp/stock', icon: <Box size={16} /> },
  { label: 'Bill of Materials', href: '/dashboard/erp/manufacturing/bom', icon: <Layers size={16} /> },
  { label: 'Workstation Type', href: '#', icon: <Tag size={16} /> },
  { label: 'Workstation', href: '#', icon: <Wrench size={16} /> },
  { label: 'Operation', href: '#', icon: <Cog size={16} /> },
  { label: 'Routing', href: '#', icon: <Route size={16} /> },
];

const SETTINGS_ITEMS: GridItem[] = [
  { label: 'Manufacturing Settings', href: '/dashboard/settings', icon: <Settings size={16} /> },
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

function MobileManufacturingDashboard({ dashboardData, trendData }: ManufacturingDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-5 pb-4">
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
                <BreadcrumbPage>Manufacturing</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Produced Quantity
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
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="producedQty"
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
              icon={<Factory size={16} />}
              label="Open Work Orders"
              value={dashboardData.openWorkOrders.toString()}
              subtitle="Not started & in process"
            />
            <KpiCard
              icon={<Wrench size={16} />}
              label="WIP Work Orders"
              value={dashboardData.wipWorkOrders.toString()}
              subtitle="Currently in production"
            />
            <KpiCard
              icon={<DollarSign size={16} />}
              label="Manufactured Items Value"
              value={formatAed(dashboardData.manufacturedItemsValue)}
              subtitle="Completed orders total cost"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 rounded-xl p-1 w-full">
              <TabsTrigger value="overview" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger value="masters" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs">
                Reports &amp; Masters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-3">
              <SectionGrid title="Production" items={PRODUCTION_ITEMS} />
              <SectionGrid title="Bill of Materials" items={BOM_ITEMS} />
            </TabsContent>

            <TabsContent value="masters" className="mt-4 space-y-3">
              <SectionGrid title="Bill of Materials" items={BOM_ITEMS} />
              <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Desktop variant ────────────────────────────────────────────────────────

function DesktopManufacturingDashboard({ dashboardData, trendData }: ManufacturingDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('overview');

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
                <BreadcrumbPage>Manufacturing</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-[#0f172a]">
                    Produced Quantity
                  </CardTitle>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    Monthly produced quantity over the past 12 months
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs h-8">
                    <Filter size={13} />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg">
                    <MoreHorizontal size={14} className="text-[#64748b]" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="producedQty"
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
              icon={<Factory size={16} />}
              label="Open Work Orders"
              value={dashboardData.openWorkOrders.toString()}
              subtitle="Not started & in process"
            />
            <KpiCard
              icon={<Wrench size={16} />}
              label="WIP Work Orders"
              value={dashboardData.wipWorkOrders.toString()}
              subtitle="Currently in production"
            />
            <KpiCard
              icon={<DollarSign size={16} />}
              label="Manufactured Items Value"
              value={formatAed(dashboardData.manufacturedItemsValue)}
              subtitle="Completed orders total cost"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 rounded-xl p-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-sm px-4">
                Overview
              </TabsTrigger>
              <TabsTrigger value="masters" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-sm px-4">
                Reports &amp; Masters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <SectionGrid title="Production" items={PRODUCTION_ITEMS} />
                <SectionGrid title="Bill of Materials" items={BOM_ITEMS} />
                <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
              </div>
            </TabsContent>

            <TabsContent value="masters" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <SectionGrid title="Production" items={PRODUCTION_ITEMS} />
                <SectionGrid title="Bill of Materials" items={BOM_ITEMS} />
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

export default function ManufacturingDashboardClient({
  dashboardData,
  trendData,
}: ManufacturingDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return <MobileManufacturingDashboard dashboardData={dashboardData} trendData={trendData} />;
  }
  return <DesktopManufacturingDashboard dashboardData={dashboardData} trendData={trendData} />;
}
