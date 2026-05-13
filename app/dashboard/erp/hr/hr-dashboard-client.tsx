'use client';

import { useState, useMemo } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Users,
  UserCheck,
  Building2,
  ArrowUpRight,
  Filter,
  MoreHorizontal,
  Calendar,
  FileText,
  DollarSign,
  Settings,
  Briefcase,
  MapPin,
  BarChart3,
  Clock,
  ClipboardList,
  Receipt,
  CreditCard,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { HRDashboardData } from '@/app/dashboard/erp/hr/actions';

type HRDashboardClientProps = {
  dashboardData: HRDashboardData;
};

// ── Chart config ───────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#ea580c',
  '#64748b', '#16a34a', '#0891b2', '#dc2626',
];

const chartConfig: ChartConfig = {
  count: {
    label: 'Employees',
    color: '#2563eb',
  },
};

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

// ── Main Client Component ──────────────────────────────────────────────────

export default function HRDashboardClient({
  dashboardData,
}: HRDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState('overview');

  const chartData = useMemo(() => {
    return (dashboardData.headcountByDepartment || []).map((d) => ({
      department: d.department,
      count: d.count,
    }));
  }, [dashboardData.headcountByDepartment]);

  const kpiCards = (
    <>
      <KpiCard
        icon={Users}
        label="Total Employees"
        value={dashboardData.totalEmployees.toLocaleString()}
        subtext="All registered employees"
        accentBg="bg-blue-50 text-blue-600"
      />
      <KpiCard
        icon={UserCheck}
        label="Active Employees"
        value={dashboardData.activeEmployees.toLocaleString()}
        subtext="Currently active"
        accentBg="bg-emerald-50 text-emerald-600"
      />
      <KpiCard
        icon={Building2}
        label="Departments"
        value={dashboardData.departmentCount.toLocaleString()}
        subtext="Distinct departments"
        accentBg="bg-amber-50 text-amber-600"
      />
    </>
  );

  const chartSection = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#0f172a]">
            Headcount by Department
          </h3>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Employee distribution across departments
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
              <DropdownMenuItem>All Departments</DropdownMenuItem>
              <DropdownMenuItem>Top 5</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Refresh Data</DropdownMenuItem>
              <DropdownMenuItem>Export Chart</DropdownMenuItem>
              <DropdownMenuItem>Print</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
          <BarChart3 size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No employee data available for chart</p>
        </div>
      ) : isMobile ? (
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="department"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              width={30}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: unknown) => String(value)}
                />
              }
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              fill="#2563eb"
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="department"
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
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: unknown) => String(value)}
                />
              }
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              fill="#2563eb"
            />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );

  const reportsGrid = (
    <>
      {/* Employee card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Users size={14} className="text-[#1e3a5f]" />
          Employee
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Users} label="Employee" href="/dashboard/erp/hr/personnel" />
          <MasterLink icon={Building2} label="Department" href="#" />
          <MasterLink icon={Briefcase} label="Designation" href="#" />
          <MasterLink icon={MapPin} label="Branch" href="#" />
        </div>
      </div>

      {/* Attendance card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-[#1e3a5f]" />
          Attendance
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Clock} label="Attendance" href="#" />
          <MasterLink icon={FileText} label="Leave Application" href="#" />
          <MasterLink icon={Calendar} label="Holiday List" href="#" />
        </div>
      </div>

      {/* Payroll card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <DollarSign size={14} className="text-[#1e3a5f]" />
          Payroll
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={CreditCard} label="Salary Structure" href="#" />
          <MasterLink icon={ClipboardList} label="Payroll Entry" href="#" />
          <MasterLink icon={Receipt} label="Salary Slip" href="#" />
        </div>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
          <Settings size={14} className="text-[#1e3a5f]" />
          Settings
        </h4>
        <div className="divide-y divide-gray-50">
          <MasterLink icon={Settings} label="HR Settings" href="/dashboard/settings" />
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
            <BreadcrumbPage>HR</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {isMobile ? (
        /* ── Mobile Layout ── */
        <div className="space-y-4">
          {chartSection}
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
            {chartSection}
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
