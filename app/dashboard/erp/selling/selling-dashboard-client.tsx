'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Users,
  Calculator,
  TrendingUp,
  ArrowUpRight,
  Filter,
  MoreHorizontal,
  ShoppingCart,
  Package,
  FileSpreadsheet,
  Settings,
  Tags,
  ListOrdered,
  Handshake,
  PackageSearch,
  Receipt,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getSellingDashboardData,
  getSalesOrderTrends,
  type SellingDashboardData,
  type SalesTrendPoint,
} from './actions';

type SellingDashboardClientProps = {
  dashboardData: SellingDashboardData;
  trendData: SalesTrendPoint[];
};

// ── Chart config ───────────────────────────────────────────────────────────

const CHART_COLORS = {
  line: '#1e3a5f',
  grid: '#f1f5f9',
};

function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return monthNames[parseInt(month, 10) - 1] + ' ' + year.slice(2);
}

function formatAED(value: number): string {
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(1)}K`;
  return `AED ${value.toFixed(0)}`;
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  accentBg,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  accentBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
          {label}
        </p>
        <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
        {subtext && (
          <p className="text-xs text-[#94a3b8] mt-0.5">{subtext}</p>
        )}
      </div>
    </div>
  );
}

// ── Link row ───────────────────────────────────────────────────────────────

function MasterLink({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5 text-sm text-[#334155]">
        <Icon size={14} className="text-[#94a3b8]" />
        <span>{label}</span>
      </div>
      <Link href={href} passHref>
        <Button variant="link" size="sm" className="h-auto p-0 text-[#1e3a5f] gap-1">
          <span className="text-xs">{label}</span>
          <ArrowUpRight size={12} />
        </Button>
      </Link>
    </div>
  );
}

// ── Desktop chart ──────────────────────────────────────────────────────────

function DesktopChartCard({ trendData }: { trendData: SalesTrendPoint[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(trendData);

  const handleRefresh = async () => {
    setRefreshing(true);
    const fresh = await getSalesOrderTrends();
    setData(fresh);
    setRefreshing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#0f172a]">
            Sales Order Trends
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Monthly submitted sales orders over the past 12 months
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Filter size={13} />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefresh}>
                Last 12 Months
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefresh}>
                Last 6 Months
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefresh}>
                This Year
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefresh}>
                Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem>Export Chart</DropdownMenuItem>
              <DropdownMenuItem>Print</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={refreshing ? 'opacity-50 pointer-events-none' : ''}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatMonthLabel}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v: number) => formatAED(v)}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={(value: any, name: any) => {
                if (name === 'total') return [formatAED(value), 'Total'];
                return [value, 'Orders'];
              }}
              labelFormatter={(label: any) => formatMonthLabel(String(label))}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="total"
              stroke={CHART_COLORS.line}
              strokeWidth={2.5}
              dot={{ r: 3, fill: CHART_COLORS.line }}
              activeDot={{ r: 5 }}
              name="total"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="count"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="count"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Mobile chart (compact) ─────────────────────────────────────────────────

function MobileChartCard({ trendData }: { trendData: SalesTrendPoint[] }) {
  const [data] = useState(trendData);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-[#0f172a] mb-3">
        Sales Order Trends
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => {
              const month = v.split('-')[1];
              const names = ['J','F','M','A','M','J','J','A','S','O','N','D'];
              return names[parseInt(month, 10) - 1];
            }}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => formatAED(v)}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '11px',
            }}
            formatter={(value: any, name: any) => {
              if (name === 'total') return [formatAED(value), 'Total'];
              return [value, 'Orders'];
            }}
            labelFormatter={(label: any) => formatMonthLabel(String(label))}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke={CHART_COLORS.line}
            strokeWidth={2}
            dot={false}
            name="total"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────

export default function SellingDashboardClient({
  dashboardData,
  trendData,
}: SellingDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState('overview');

  const kpiCards = (
    <>
      <KpiCard
        icon={ShoppingCart}
        label="Sales Orders"
        value={dashboardData.orderCount.toLocaleString()}
        subtext="Submitted orders"
        accentBg="bg-blue-50 text-blue-600"
      />
      <KpiCard
        icon={TrendingUp}
        label="Total Sales Amount"
        value={formatAED(dashboardData.totalAmount)}
        subtext="Sum of grand totals (AED)"
        accentBg="bg-emerald-50 text-emerald-600"
      />
      <KpiCard
        icon={Calculator}
        label="Average Order Value"
        value={formatAED(dashboardData.avgOrderValue)}
        subtext="Per submitted order"
        accentBg="bg-amber-50 text-amber-600"
      />
    </>
  );

  const reportsGrid = (
    <>
      {/* Selling card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <FileText size={14} className="text-[#1e3a5f]" />
          Selling
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Users} label="Customer" href="/dashboard/erp/customers" />
          <MasterLink icon={FileSpreadsheet} label="Quotation" href="/dashboard/erp/quotations" />
          <MasterLink icon={Package} label="Sales Order" href="/dashboard/erp/sales-orders" />
          <MasterLink icon={Receipt} label="Sales Invoice" href="/dashboard/erp/selling/invoices" />
          <MasterLink icon={FileText} label="Blanket Order" href="#" />
          <MasterLink icon={Handshake} label="Sales Partner" href="#" />
        </div>
      </div>

      {/* Items and Pricing card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Tags size={14} className="text-[#1e3a5f]" />
          Items and Pricing
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={PackageSearch} label="Item" href="/dashboard/erp/stock" />
          <MasterLink icon={ListOrdered} label="Item Price" href="#" />
          <MasterLink icon={Tags} label="Price List" href="#" />
        </div>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Settings size={14} className="text-[#1e3a5f]" />
          Settings
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Settings} label="Selling Settings" href="/dashboard/settings" />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 p-1">
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
            <BreadcrumbPage>Selling</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {isMobile ? (
        /* ── Mobile Layout ── */
        <div className="space-y-4">
          <MobileChartCard trendData={trendData} />
          <div className="grid grid-cols-1 gap-3">
            {kpiCards}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {reportsGrid}
          </div>
        </div>
      ) : (
        /* ── Desktop Layout with Tabs ── */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 w-[260px]">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="masters"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-sm"
            >
              Reports &amp; Masters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <DesktopChartCard trendData={trendData} />
            <div className="grid grid-cols-3 gap-4">
              {kpiCards}
            </div>
          </TabsContent>

          <TabsContent value="masters" className="mt-4">
            <div className="grid grid-cols-3 gap-4">
              {reportsGrid}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
