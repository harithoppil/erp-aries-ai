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
  FolderKanban,
  ListTodo,
  Clock,
  FileText,
  ClipboardList,
  Settings,
  Activity,
  DollarSign,
  Filter,
  MoreHorizontal,
  CalendarCheck,
  BarChart3,
  CheckSquare,
} from 'lucide-react';
import type { ProjectsDashboardData, ProjectTrendPoint } from './actions';

// ── Chart Config ────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  completedCount: {
    label: 'Completed Projects',
    color: '#1e3a5f',
  },
};

// ── Types ───────────────────────────────────────────────────────────────────

interface ProjectsDashboardClientProps {
  dashboardData: ProjectsDashboardData;
  trendData: ProjectTrendPoint[];
}

interface GridItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatHours(value: number): string {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K hrs`;
  return `${value.toFixed(1)} hrs`;
}

// ── Section Data ────────────────────────────────────────────────────────────

const PROJECTS_ITEMS: GridItem[] = [
  { label: 'Project', href: '/dashboard/erp/projects', icon: <FolderKanban size={16} /> },
  { label: 'Task', href: '/dashboard/erp/projects/tasks', icon: <ListTodo size={16} /> },
  { label: 'Project Template', href: '#', icon: <ClipboardList size={16} /> },
  { label: 'Project Type', href: '#', icon: <FileText size={16} /> },
  { label: 'Project Update', href: '#', icon: <Activity size={16} /> },
];

const TIME_TRACKING_ITEMS: GridItem[] = [
  { label: 'Timesheet', href: '#', icon: <Clock size={16} /> },
  { label: 'Activity Type', href: '#', icon: <BarChart3 size={16} /> },
  { label: 'Activity Cost', href: '#', icon: <DollarSign size={16} /> },
];

const REPORTS_ITEMS: GridItem[] = [
  { label: 'Daily Timesheet Summary', href: '#', icon: <FileText size={16} /> },
  { label: 'Project Wise Stock Tracking', href: '#', icon: <BarChart3 size={16} /> },
  { label: 'Timesheet Billing Summary', href: '#', icon: <DollarSign size={16} /> },
  { label: 'Delayed Tasks Summary', href: '#', icon: <CalendarCheck size={16} /> },
];

const SETTINGS_ITEMS: GridItem[] = [
  { label: 'Projects Settings', href: '/dashboard/settings', icon: <Settings size={16} /> },
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

function MobileProjectsDashboard({ dashboardData, trendData }: ProjectsDashboardClientProps) {
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
                <BreadcrumbPage>Projects</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Completed Projects
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
                    width={40}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="completedCount"
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
              icon={<FolderKanban size={16} />}
              label="Open Projects"
              value={dashboardData.openProjects.toString()}
              subtitle="Open, in progress & planning"
            />
            <KpiCard
              icon={<ListTodo size={16} />}
              label="Non Completed Tasks"
              value={dashboardData.nonCompletedTasks.toString()}
              subtitle="Active & pending tasks"
            />
            <KpiCard
              icon={<Clock size={16} />}
              label="Working Hours"
              value={formatHours(dashboardData.workingHours)}
              subtitle="Total hours from timesheets"
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
              <SectionGrid title="Projects" items={PROJECTS_ITEMS} />
              <SectionGrid title="Time Tracking" items={TIME_TRACKING_ITEMS} />
            </TabsContent>

            <TabsContent value="masters" className="mt-4 space-y-3">
              <SectionGrid title="Reports" items={REPORTS_ITEMS} />
              <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Desktop variant ────────────────────────────────────────────────────────

function DesktopProjectsDashboard({ dashboardData, trendData }: ProjectsDashboardClientProps) {
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
                <BreadcrumbPage>Projects</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Chart Card */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-[#0f172a]">
                    Completed Projects
                  </CardTitle>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    Monthly completed projects over the past 12 months
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
                    width={40}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="completedCount"
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
              icon={<FolderKanban size={16} />}
              label="Open Projects"
              value={dashboardData.openProjects.toString()}
              subtitle="Open, in progress & planning"
            />
            <KpiCard
              icon={<ListTodo size={16} />}
              label="Non Completed Tasks"
              value={dashboardData.nonCompletedTasks.toString()}
              subtitle="Active & pending tasks"
            />
            <KpiCard
              icon={<Clock size={16} />}
              label="Working Hours"
              value={formatHours(dashboardData.workingHours)}
              subtitle="Total hours from timesheets"
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
                <SectionGrid title="Projects" items={PROJECTS_ITEMS} />
                <SectionGrid title="Time Tracking" items={TIME_TRACKING_ITEMS} />
                <SectionGrid title="Settings" items={SETTINGS_ITEMS} />
              </div>
            </TabsContent>

            <TabsContent value="masters" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <SectionGrid title="Reports" items={REPORTS_ITEMS} />
                <SectionGrid title="Time Tracking" items={TIME_TRACKING_ITEMS} />
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

export default function ProjectsDashboardClient({
  dashboardData,
  trendData,
}: ProjectsDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return <MobileProjectsDashboard dashboardData={dashboardData} trendData={trendData} />;
  }
  return <DesktopProjectsDashboard dashboardData={dashboardData} trendData={trendData} />;
}
