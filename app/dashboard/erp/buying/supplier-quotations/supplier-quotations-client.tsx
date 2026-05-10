'use client';

import { useState, useMemo } from 'react';
import { listSupplierQuotations, type ClientSafeSupplierQuotation } from './actions';
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
  FileText, Search, RefreshCw, CheckCircle, XCircle, Clock, DollarSign,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  Draft: { label: 'Draft', badge: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock },
  Submitted: { label: 'Submitted', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  Ordered: { label: 'Ordered', badge: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  Cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  Expired: { label: 'Expired', badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
};

export default function SupplierQuotationsClient({ initialQuotations }: { initialQuotations: ClientSafeSupplierQuotation[] }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [quotations, setQuotations] = useState<ClientSafeSupplierQuotation[]>(initialQuotations);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await listSupplierQuotations();
      if (res.success) setQuotations(res.quotations);
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return quotations;
    return quotations.filter((sq) =>
      (sq.name || '').toLowerCase().includes(q) ||
      (sq.supplier || '').toLowerCase().includes(q) ||
      (sq.supplier_name || '').toLowerCase().includes(q) ||
      (sq.company || '').toLowerCase().includes(q) ||
      (sq.status || '').toLowerCase().includes(q)
    );
  }, [quotations, search]);

  const stats = useMemo(() => ({
    total: quotations.length,
    draft: quotations.filter((sq) => sq.status === 'Draft').length,
    submitted: quotations.filter((sq) => sq.status === 'Submitted').length,
    totalValue: quotations
      .filter((sq) => sq.status === 'Submitted')
      .reduce((sum, sq) => sum + parseFloat(sq.grand_total.replace(/,/g, '') || '0'), 0),
  }), [quotations]);

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
                <BreadcrumbLink href="/dashboard/erp/buying">Buying</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Supplier Quotations</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header + Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Supplier Quotations</h2>
              <p className="text-sm text-[#64748b] mt-1">{quotations.length} total quotations</p>
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
              placeholder="Search quotations by ID, supplier, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={Clock} label="Draft" value={stats.draft} color="text-gray-600" />
            <StatCard icon={CheckCircle} label="Submitted" value={stats.submitted} color="text-blue-600" />
            <StatCard icon={DollarSign} label="Submitted Value" value={stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} color="text-green-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <FileText size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No supplier quotations found</p>
                <p className="text-sm">Create your first supplier quotation to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Supplier</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Grand Total</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Valid Till</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((sq) => {
                      const cfg = STATUS_CONFIG[sq.status] || STATUS_CONFIG.Draft;
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={sq.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{sq.name}</p>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{sq.supplier_name}</td>
                          <td className="px-4 py-3 text-[#64748b]">{sq.company}</td>
                          <td className="px-4 py-3 text-right text-[#64748b] font-mono">{sq.grand_total}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}>
                              <StatusIcon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{sq.valid_till || '-'}</td>
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
