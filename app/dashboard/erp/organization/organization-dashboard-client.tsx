'use client';

import Link from 'next/link';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  GitBranch as AccountTree,
  ShieldCheck,
  Mail,
  FileText,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Globe,
} from 'lucide-react';
import type { OrganizationDashboardData } from './actions';

type OrganizationDashboardClientProps = {
  data: OrganizationDashboardData;
};

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

// ── Onboarding Card ────────────────────────────────────────────────────────

function OnboardingCard({ companyCount }: { companyCount: number }) {
  const checklist = [
    { label: 'Create a Company', done: companyCount > 0, href: '/dashboard/erp/setup/company' },
    { label: 'Set up Departments', done: false, href: '/dashboard/erp/hr' },
    { label: 'Add Users', done: false, href: '/dashboard/erp/hr' },
    { label: 'Configure Letter Head', done: false, href: '#' },
    { label: 'Set up Email Account', done: false, href: '#' },
  ];

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#0f172a]">
            Setup Organization
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Complete these steps to configure your organization
          </p>
        </div>
        <span className="text-xs font-medium text-[#64748b] bg-gray-100 px-2.5 py-1 rounded-full">
          {completedCount}/{checklist.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5">
        <div
          className="h-1.5 bg-[#1e3a5f] rounded-full transition-all duration-300"
          style={{ width: `${(completedCount / checklist.length) * 100}%` }}
        />
      </div>

      <div className="space-y-3">
        {checklist.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 py-1.5 group"
          >
            {item.done ? (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            ) : (
              <Circle size={18} className="text-gray-300 shrink-0 group-hover:text-gray-400 transition-colors" />
            )}
            <span className={`text-sm ${item.done ? 'text-[#94a3b8] line-through' : 'text-[#334155] group-hover:text-[#0f172a]'}`}>
              {item.label}
            </span>
            {!item.done && <ArrowUpRight size={12} className="text-[#94a3b8] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────

export default function OrganizationDashboardClient({
  data,
}: OrganizationDashboardClientProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const gridCols = isMobile ? 'grid-cols-1' : 'md:grid-cols-3';

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
            <BreadcrumbPage>Organization</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Onboarding Card — replaces chart since Organization is settings/admin */}
      <OnboardingCard companyCount={data.companyCount} />

      {/* Company info card when companies exist */}
      {data.companyCount > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-[#0f172a]">
                Registered Companies
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                {data.companyCount} {data.companyCount === 1 ? 'company' : 'companies'} configured
              </p>
            </div>
            <Link href="/dashboard/erp/setup/company">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Building2 size={13} />
                Manage
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.companies.slice(0, 5).map((company) => (
              <div key={company.name} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0f172a]">
                      {company.company_name}
                    </p>
                    <p className="text-xs text-[#94a3b8]">
                      {company.country}{company.default_currency ? ` - ${company.default_currency}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Masters Grid */}
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {/* Company card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
            <Building2 size={14} className="text-[#1e3a5f]" />
            Company
          </h4>
          <div className="divide-y divide-gray-50">
            <MasterLink icon={Building2} label="Company" href="/dashboard/erp/setup/company" />
          </div>
        </div>

        {/* Structure card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
            <AccountTree size={14} className="text-[#1e3a5f]" />
            Structure
          </h4>
          <div className="divide-y divide-gray-50">
            <MasterLink icon={AccountTree} label="Department" href="/dashboard/erp/hr" />
            <MasterLink icon={Building2} label="Branch" href="#" />
            <MasterLink icon={FileText} label="Letter Head" href="#" />
          </div>
        </div>

        {/* Access card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#1e3a5f]" />
            Access
          </h4>
          <div className="divide-y divide-gray-50">
            <MasterLink icon={Users} label="Users" href="/dashboard/erp/hr" />
            <MasterLink icon={ShieldCheck} label="Role Permissions" href="#" />
          </div>
        </div>

        {/* Communication card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
            <Mail size={14} className="text-[#1e3a5f]" />
            Communication
          </h4>
          <div className="divide-y divide-gray-50">
            <MasterLink icon={Mail} label="Email Account" href="#" />
          </div>
        </div>
      </div>
    </div>
  );
}
