'use client';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { ShieldCheck } from 'lucide-react';

export default function RolesClient() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="/dashboard/erp/organization">Organization</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Role Permissions</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">Role Permissions</h2>
            <p className="text-sm text-[#64748b] mt-1">Configure role-based permissions</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16 text-[#94a3b8]">
            <ShieldCheck size={48} className="mb-4 opacity-40" />
            <p className="text-lg font-medium">Role Permissions coming soon</p>
            <p className="text-sm">This module is being developed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
