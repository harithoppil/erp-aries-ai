'use client';

import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ClipboardList, Package } from 'lucide-react';

export default function PickListClient() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/erp/stock">Stock</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Pick List</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">Pick Lists</h2>
            <p className="text-sm text-[#64748b] mt-1">Manage pick lists for warehouse operations</p>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
              <ClipboardList size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">Pick Lists coming soon</p>
              <p className="text-sm mt-1">This feature is under development. Check back later for pick list management.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
