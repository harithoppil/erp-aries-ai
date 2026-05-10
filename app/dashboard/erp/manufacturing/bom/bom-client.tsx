'use client';

import { useState, useMemo } from 'react';
import { listBOMs, type ClientSafeBOM } from './actions';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Layers, Search, RefreshCw, CheckCircle, XCircle, FileText,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  Active: { label: 'Active', badge: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  Inactive: { label: 'Inactive', badge: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle },
  Submitted: { label: 'Submitted', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: FileText },
  Cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export default function BOMClient({ initialBOMs }: { initialBOMs: ClientSafeBOM[] }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [boms, setBOMs] = useState<ClientSafeBOM[]>(initialBOMs);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await listBOMs();
      if (res.success) setBOMs(res.boms);
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return boms;
    return boms.filter((b) =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.item || '').toLowerCase().includes(q) ||
      (b.item_name || '').toLowerCase().includes(q) ||
      (b.company || '').toLowerCase().includes(q) ||
      (b.status || '').toLowerCase().includes(q)
    );
  }, [boms, search]);

  const stats = useMemo(() => ({
    total: boms.length,
    active: boms.filter((b) => b.is_active).length,
  }), [boms]);

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
                <BreadcrumbLink href="/dashboard/erp/manufacturing/work-orders">Manufacturing</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>BOM</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header + Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Bill of Materials</h2>
              <p className="text-sm text-[#64748b] mt-1">{boms.length} total BOMs</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={load}>
                <RefreshCw size={13} /> Refresh
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search BOMs by ID, item, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <StatCard icon={Layers} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={CheckCircle} label="Active" value={stats.active} color="text-green-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Layers size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">You haven&apos;t created a BOM yet</p>
                <p className="text-sm">Create your first Bill of Materials to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Item to Manufacture</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Item Name</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((b) => {
                      const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.Inactive;
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{b.name}</p>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{b.item}</td>
                          <td className="px-4 py-3 text-[#64748b]">{b.item_name}</td>
                          <td className="px-4 py-3 text-[#64748b]">{b.company}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}>
                              <StatusIcon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs font-medium text-[#64748b] uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
