'use client';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { GitBranch } from 'lucide-react';

export default function IntegrationsClient() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="/dashboard/settings">Framework</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Integrations</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">Integrations</h2>
            <p className="text-sm text-[#64748b] mt-1">Manage third-party integrations</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16 text-[#94a3b8]">
            <GitBranch size={48} className="mb-4 opacity-40" />
            <p className="text-lg font-medium">Integrations coming soon</p>
            <p className="text-sm">This module is being developed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
