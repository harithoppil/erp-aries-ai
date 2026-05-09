'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Package,
  Warehouse,
  TrendingUp,
  ArrowRightLeft,
  Truck,
  PackageOpen,
  ClipboardList,
  Settings,
  Database,
  FileText,
  Layers,
  BarChart3,
  Filter,
  MoreHorizontal,
} from 'lucide-react';

// ── Chart config ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#ea580c',
  '#64748b', '#16a34a', '#0891b2', '#dc2626',
];

const chartConfig: ChartConfig = {
  stock_value: {
    label: 'Stock Value',
    color: '#2563eb',
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface StockByGroup {
  item_group: string;
  stock_value: number;
}

interface StockDashboardClientProps {
  totalStockValue: number;
  warehouseCount: number;
  itemCount: number;
  stockByItemGroup: StockByGroup[];
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  iconColor,
  label,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={iconColor} />
        <span className="text-xs font-medium text-[#64748b] uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
      <p className="text-xs text-[#94a3b8] mt-1">{subtitle}</p>
    </div>
  );
}

// ── Navigation Card ──────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
}

function NavCard({
  icon: Icon,
  iconColor,
  title,
  items,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  items: NavItem[];
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={iconColor} />
        <span className="text-sm font-semibold text-[#0f172a]">{title}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[#475569] hover:bg-gray-50 hover:text-[#0f172a] transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#94a3b8]" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `AED ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `AED ${(value / 1_000).toFixed(1)}K`;
  }
  return `AED ${value.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function StockDashboardClient({
  totalStockValue,
  warehouseCount,
  itemCount,
  stockByItemGroup,
}: StockDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const chartData = useMemo(() => {
    return stockByItemGroup.map((g) => ({
      item_group: g.item_group,
      stock_value: Math.round(g.stock_value * 100) / 100,
    }));
  }, [stockByItemGroup]);

  const barColors = useMemo(() => {
    return chartData.reduce<Record<string, string>>((acc, _, idx) => {
      const key = `bar-${idx}`;
      acc[key] = CHART_COLORS[idx % CHART_COLORS.length];
      return acc;
    }, {});
  }, [chartData]);

  const gridCols = isMobile ? 'grid-cols-1' : 'md:grid-cols-3';

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-5 pb-6">
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
                <BreadcrumbPage>Stock</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card: Stock Value by Item Group */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#0f172a]">
                  Stock Value by Item Group
                </h3>
                <p className="text-xs text-[#94a3b8] mt-0.5">Last synced just now</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Filter size={14} />
                  Filter
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <MoreHorizontal size={14} />
                  More
                </Button>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <BarChart3 size={40} className="mb-3 opacity-40" />
                <p className="text-sm">No stock data available for chart</p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="item_group"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) => formatCurrency(v)}
                    width={70}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value: unknown) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  <Bar
                    dataKey="stock_value"
                    radius={[4, 4, 0, 0]}
                    fill="#2563eb"
                  />
                </BarChart>
              </ChartContainer>
            )}
          </div>

          {/* 3 KPI Cards */}
          <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
            <KpiCard
              icon={TrendingUp}
              iconColor="text-green-600"
              label="Total Stock Value"
              value={formatCurrency(totalStockValue)}
              subtitle="Sum of stock value from all bins"
            />
            <KpiCard
              icon={Warehouse}
              iconColor="text-blue-600"
              label="Total Warehouses"
              value={warehouseCount.toLocaleString()}
              subtitle="Active warehouses in the system"
            />
            <KpiCard
              icon={Package}
              iconColor="text-purple-600"
              label="Total Active Items"
              value={itemCount.toLocaleString()}
              subtitle="Items where disabled flag is off"
            />
          </div>

          {/* Masters & Reports Grid */}
          <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
            {/* Items Catalogue */}
            <NavCard
              icon={Layers}
              iconColor="text-purple-600"
              title="Items Catalogue"
              items={[
                { label: 'Item', href: '/dashboard/erp/stock' },
                { label: 'Item Group', href: '#' },
                { label: 'Product Bundle', href: '#' },
              ]}
            />

            {/* Stock Transactions */}
            <NavCard
              icon={ArrowRightLeft}
              iconColor="text-blue-600"
              title="Stock Transactions"
              items={[
                { label: 'Stock Entry', href: '/dashboard/erp/stock/entries' },
                { label: 'Delivery Note', href: '/dashboard/erp/stock/delivery-notes' },
                { label: 'Purchase Receipt', href: '/dashboard/erp/stock/purchase-receipts' },
                { label: 'Material Request', href: '/dashboard/erp/material-requests' },
              ]}
            />

            {/* Stock Reports */}
            <NavCard
              icon={BarChart3}
              iconColor="text-teal-600"
              title="Stock Reports"
              items={[
                { label: 'Stock Ledger', href: '#' },
                { label: 'Stock Balance', href: '#' },
              ]}
            />

            {/* Settings */}
            <NavCard
              icon={Settings}
              iconColor="text-gray-600"
              title="Settings"
              items={[
                { label: 'Stock Settings', href: '/dashboard/settings' },
                { label: 'Warehouses', href: '/dashboard/erp/stock/warehouses' },
              ]}
            />

            {/* Tools */}
            <NavCard
              icon={Database}
              iconColor="text-amber-600"
              title="Tools"
              items={[
                { label: 'Stock Reconciliation', href: '#' },
              ]}
            />

            {/* Quick Reports placeholder for grid alignment */}
            <NavCard
              icon={FileText}
              iconColor="text-indigo-600"
              title="Quick Reports"
              items={[
                { label: 'Requested Items to Order', href: '#' },
                { label: 'Warehouse Wise Stock', href: '#' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
