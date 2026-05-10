'use client';

import { useState, useMemo } from 'react';
import { listJobCards, type ClientSafeJobCard } from './actions';
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
  ClipboardList, Search, RefreshCw, CheckCircle, XCircle,
  Clock, Play, Pause,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  Open: { label: 'Open', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  'In Progress': { label: 'In Progress', badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: Play },
  'Material Transferred': { label: 'Material Transferred', badge: 'bg-purple-100 text-purple-700 border-purple-200', icon: CheckCircle },
  Completed: { label: 'Completed', badge: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  'On Hold': { label: 'On Hold', badge: 'bg-gray-100 text-gray-700 border-gray-200', icon: Pause },
  Cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export default function JobCardsClient({ initialJobCards }: { initialJobCards: ClientSafeJobCard[] }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [jobCards, setJobCards] = useState<ClientSafeJobCard[]>(initialJobCards);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await listJobCards();
      if (res.success) setJobCards(res.jobCards);
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return jobCards;
    return jobCards.filter((j) =>
      (j.name || '').toLowerCase().includes(q) ||
      (j.work_order || '').toLowerCase().includes(q) ||
      (j.employee || '').toLowerCase().includes(q) ||
      (j.status || '').toLowerCase().includes(q)
    );
  }, [jobCards, search]);

  const stats = useMemo(() => ({
    total: jobCards.length,
    open: jobCards.filter((j) => j.status === 'Open').length,
    completed: jobCards.filter((j) => j.status === 'Completed').length,
  }), [jobCards]);

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
                <BreadcrumbPage>Job Cards</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header + Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Job Cards</h2>
              <p className="text-sm text-[#64748b] mt-1">{jobCards.length} total job cards</p>
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
              placeholder="Search job cards by ID, work order, or employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={ClipboardList} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={Clock} label="Open" value={stats.open} color="text-blue-600" />
            <StatCard icon={CheckCircle} label="Completed" value={stats.completed} color="text-green-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <ClipboardList size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">You haven&apos;t created a Job Card yet</p>
                <p className="text-sm">Create your first Job Card to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Work Order</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Employee</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">For Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((j) => {
                      const cfg = STATUS_CONFIG[j.status] || STATUS_CONFIG.Open;
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={j.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{j.name}</p>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{j.work_order}</td>
                          <td className="px-4 py-3 text-[#64748b]">{j.employee}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}>
                              <StatusIcon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#0f172a] font-medium">{j.for_quantity}</td>
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
