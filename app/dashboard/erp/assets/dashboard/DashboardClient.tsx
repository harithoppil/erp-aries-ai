'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Monitor,
  FolderTree,
  Calculator,
  Wrench,
  ArrowUpRight,
  Building,
  ArrowRightLeft,
  Truck,
  MapPin,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssetsKpis {
  assets: number;
  assetCategories: number;
  assetDepreciationSchedules: number;
  assetMaintenances: number;
}

export interface ChartDataPoint {
  month: string;
  count: number;
}

interface DashboardClientProps {
  kpis: AssetsKpis;
  chartData: ChartDataPoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// ── Link Data ──────────────────────────────────────────────────────────────

const ASSETS_LINKS = [
  { label: 'Asset', icon: Monitor },
  { label: 'Asset Category', icon: FolderTree },
  { label: 'Asset Depreciation Schedule', icon: Calculator },
  { label: 'Asset Capitalization', icon: Building },
  { label: 'Asset Movement', icon: ArrowRightLeft },
  { label: 'Asset Maintenance', icon: Wrench },
  { label: 'Asset Repair', icon: Wrench },
  { label: 'Location', icon: MapPin },
];

// ── KPI Data ───────────────────────────────────────────────────────────────

const KPI_CONFIG = [
  { key: 'assets' as const, label: 'Assets', icon: Monitor, bg: 'bg-blue-50 text-blue-600' },
  { key: 'assetCategories' as const, label: 'Asset Categories', icon: FolderTree, bg: 'bg-emerald-50 text-emerald-600' },
  { key: 'assetDepreciationSchedules' as const, label: 'Depreciation Schedules', icon: Calculator, bg: 'bg-amber-50 text-amber-600' },
  { key: 'assetMaintenances' as const, label: 'Asset Maintenances', icon: Wrench, bg: 'bg-purple-50 text-purple-600' },
];

// ── Skeleton ───────────────────────────────────────────────────────────────

function DashboardSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-5 w-48" />
      <div className={isMobile ? 'space-y-3' : 'grid grid-cols-4 gap-4'}>
        {Array(4).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <div className={isMobile ? 'space-y-3' : 'grid grid-cols-3 gap-4'}>
        {Array(3).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Monitor className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-[#0f172a] mb-1">
        No Assets Data Yet
      </h3>
      <p className="text-sm text-[#64748b] max-w-md">
        Once you create assets, categories, or maintenance records, your assets
        dashboard will show KPIs and trends here.
      </p>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  accentBg,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accentBg: string;
}) {
  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentBg}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
              {label}
            </p>
            <p className="text-2xl font-bold text-[#0f172a]">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Master Link Card ───────────────────────────────────────────────────────

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
    <Link
      href={href}
      className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[#334155] hover:bg-gray-50 hover:text-[#1e3a5f] transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <Icon size={14} className="text-[#94a3b8] group-hover:text-[#1e3a5f] transition-colors" />
        <span>{label}</span>
      </div>
      <ArrowUpRight size={12} className="text-[#cbd5e1] group-hover:text-[#94a3b8] transition-colors" />
    </Link>
  );
}

// ── Chart Card ─────────────────────────────────────────────────────────────

function ChartCard({ data, height }: { data: ChartDataPoint[]; height: number }) {
  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">
          Asset Trends
        </CardTitle>
        <p className="text-xs text-[#64748b]">Monthly asset creation over the past 12 months</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#1e3a5f"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#1e3a5f' }}
              activeDot={{ r: 5 }}
              name="Count"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DashboardClient({ kpis, chartData }: DashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mounted, setMounted] = useState(false);

  useState(() => {
    setMounted(true);
  });

  if (!mounted) {
    return <DashboardSkeleton isMobile={false} />;
  }

  const allZero = Object.values(kpis).every((v) => v === 0);

  if (allZero && chartData.every((d) => d.count === 0)) {
    return (
      <div className="space-y-6 p-1">
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
              <BreadcrumbPage>Assets</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <EmptyState />
      </div>
    );
  }

  const kpiCards = KPI_CONFIG.map((cfg) => (
    <KpiCard
      key={cfg.key}
      icon={cfg.icon}
      label={cfg.label}
      value={kpis[cfg.key]}
      accentBg={cfg.bg}
    />
  ));

  const linksGrid = (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">
          Masters &amp; Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-gray-50">
          {ASSETS_LINKS.map((link) => (
            <MasterLink
              key={link.label}
              icon={link.icon}
              label={link.label}
              href={`/dashboard/erp/${toKebabCase(link.label)}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (isMobile) {
    return (
      <div className="space-y-4 p-1">
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
              <BreadcrumbPage>Assets</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="space-y-3">
          {kpiCards}
        </div>

        <ChartCard data={chartData} height={200} />

        {linksGrid}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
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
            <BreadcrumbPage>Assets</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-4 gap-4">
        {kpiCards}
      </div>

      <ChartCard data={chartData} height={280} />

      <div className="grid grid-cols-3 gap-4">
        {linksGrid}
      </div>
    </div>
  );
}
