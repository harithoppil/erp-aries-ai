'use client';

import { useState, useMemo } from 'react';
import { listSuppliers, type ClientSafeSupplier } from './actions';
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
  Users, Search, RefreshCw, Globe, Mail,
} from 'lucide-react';

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: ClientSafeSupplier[] }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [suppliers, setSuppliers] = useState<ClientSafeSupplier[]>(initialSuppliers);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await listSuppliers();
      if (res.success) setSuppliers(res.suppliers);
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.supplier_name || '').toLowerCase().includes(q) ||
      (s.supplier_group || '').toLowerCase().includes(q) ||
      (s.country || '').toLowerCase().includes(q) ||
      (s.email_id || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const stats = useMemo(() => ({
    total: suppliers.length,
    withCountry: suppliers.filter((s) => s.country).length,
    withEmail: suppliers.filter((s) => s.email_id).length,
  }), [suppliers]);

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
                <BreadcrumbPage>Suppliers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header + Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Suppliers</h2>
              <p className="text-sm text-[#64748b] mt-1">{suppliers.length} total suppliers</p>
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
              placeholder="Search suppliers by name, group, country, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={Globe} label="With Country" value={stats.withCountry} color="text-blue-600" />
            <StatCard icon={Mail} label="With Email" value={stats.withEmail} color="text-green-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Users size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No suppliers found</p>
                <p className="text-sm">Create your first supplier to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Supplier Name</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Group</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Country</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0f172a]">{s.name}</p>
                        </td>
                        <td className="px-4 py-3 text-[#64748b]">{s.supplier_name}</td>
                        <td className="px-4 py-3 text-[#64748b]">{s.supplier_group || '-'}</td>
                        <td className="px-4 py-3 text-[#64748b]">{s.country || '-'}</td>
                        <td className="px-4 py-3 text-[#64748b]">{s.email_id || '-'}</td>
                      </tr>
                    ))}
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
