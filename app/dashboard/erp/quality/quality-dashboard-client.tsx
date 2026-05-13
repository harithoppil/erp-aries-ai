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
  ShieldCheck,
  Search,
  Flag,
  BarChart3,
  AlertOctagon,
  TreePine,
  MessageSquare,
  ClipboardList,
  Users,
  Calendar,
  ArrowUpRight,
  Filter,
  MoreHorizontal,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getQualityInspectionTrends,
  type QualityDashboardData,
  type QualityInspectionTrend,
} from '@/app/dashboard/erp/quality/actions';

type QualityDashboardClientProps = {
  dashboardData: QualityDashboardData;
  trendData: QualityInspectionTrend[];
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

function DesktopChartCard({ trendData }: { trendData: QualityInspectionTrend[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(trendData);

  const handleRefresh = async () => {
    setRefreshing(true);
    const fresh = await getQualityInspectionTrends();
    if (fresh.success) setData(fresh.data);
    setRefreshing(false);
  };

  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#0f172a]">
            Quality Inspections
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Monthly inspections over the past 12 months
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
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
            <BarChart3 size={40} className="mb-3 opacity-40" />
            <p className="text-sm">No quality inspection data available</p>
            <p className="text-xs mt-1">Data will appear once inspections are recorded</p>
          </div>
        ) : (
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
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(value: any) => [value, 'Inspections']}
                labelFormatter={(label: any) => formatMonthLabel(String(label))}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={CHART_COLORS.line}
                strokeWidth={2.5}
                dot={{ r: 3, fill: CHART_COLORS.line }}
                activeDot={{ r: 5 }}
                name="count"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Mobile chart (compact) ─────────────────────────────────────────────────

function MobileChartCard({ trendData }: { trendData: QualityInspectionTrend[] }) {
  const [data] = useState(trendData);
  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-[#0f172a] mb-3">
        Quality Inspections
      </h3>
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
          <BarChart3 size={32} className="mb-2 opacity-40" />
          <p className="text-xs">No data available</p>
        </div>
      ) : (
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
              width={30}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: any) => [value, 'Inspections']}
              labelFormatter={(label: any) => formatMonthLabel(String(label))}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={CHART_COLORS.line}
              strokeWidth={2}
              dot={false}
              name="count"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────

export default function QualityDashboardClient({
  dashboardData,
  trendData,
}: QualityDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState('overview');

  const kpiCards = (
    <>
      <KpiCard
        icon={Search}
        label="Quality Inspections"
        value={dashboardData.inspectionCount.toLocaleString()}
        subtext="Total recorded inspections"
        accentBg="bg-blue-50 text-blue-600"
      />
      <KpiCard
        icon={Flag}
        label="Quality Goals"
        value={dashboardData.goalCount.toLocaleString()}
        subtext="Active quality goals"
        accentBg="bg-emerald-50 text-emerald-600"
      />
      <KpiCard
        icon={BarChart3}
        label="Quality Reviews"
        value={dashboardData.reviewCount.toLocaleString()}
        subtext="Completed reviews"
        accentBg="bg-amber-50 text-amber-600"
      />
    </>
  );

  const reportsGrid = (
    <>
      {/* Goal and Procedure card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Flag size={14} className="text-[#1e3a5f]" />
          Goal and Procedure
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Flag} label="Quality Goal" href="/dashboard/erp/quality" />
          <MasterLink icon={ClipboardList} label="Quality Procedure" href="/dashboard/erp/quality" />
          <MasterLink icon={TreePine} label="Tree of Procedures" href="/dashboard/erp/quality" />
          <MasterLink icon={Search} label="Quality Inspection" href="/dashboard/erp/quality" />
        </div>
      </div>

      {/* Feedback card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <MessageSquare size={14} className="text-[#1e3a5f]" />
          Feedback
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={MessageSquare} label="Quality Feedback" href="/dashboard/erp/quality" />
          <MasterLink icon={ClipboardList} label="Feedback Template" href="/dashboard/erp/quality" />
        </div>
      </div>

      {/* Meeting card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-[#1e3a5f]" />
          Meeting
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Calendar} label="Quality Meeting" href="/dashboard/erp/quality" />
        </div>
      </div>

      {/* Review and Action card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <AlertOctagon size={14} className="text-[#1e3a5f]" />
          Review and Action
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={AlertOctagon} label="Non Conformance" href="/dashboard/erp/quality" />
          <MasterLink icon={BarChart3} label="Quality Review" href="/dashboard/erp/quality" />
          <MasterLink icon={ClipboardList} label="Quality Action" href="/dashboard/erp/quality" />
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
            <BreadcrumbPage>Quality</BreadcrumbPage>
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
