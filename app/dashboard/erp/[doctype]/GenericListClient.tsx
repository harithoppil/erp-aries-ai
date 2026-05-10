'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GenericListSkeleton from './GenericListSkeleton';
import { fetchDoctypeList, deleteDoctypeRecord, type ListMeta } from './actions';

// ── Types ───────────────────────────────────────────────────────────────────

interface GenericListClientProps {
  doctype: string;
  initialData: Record<string, unknown>[];
  meta: ListMeta;
}

// ── Status helpers ──────────────────────────────────────────────────────────

function getStatusBadge(docstatus: unknown) {
  const status = Number(docstatus);
  if (status === 1) {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium"
      >
        Submitted
      </Badge>
    );
  }
  if (status === 2) {
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 border-red-200 rounded-full px-2.5 py-0.5 text-xs font-medium"
      >
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-gray-50 text-gray-600 border-gray-200 rounded-full px-2.5 py-0.5 text-xs font-medium"
    >
      Draft
    </Badge>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') {
    // Try to detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !isNaN(Date.parse(value))) {
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return value.length > 40 ? value.slice(0, 40) + '...' : value;
  }
  return String(value);
}

// ── Column detection ────────────────────────────────────────────────────────

function detectColumns(
  data: Record<string, unknown>[],
): { key: string; label: string }[] {
  if (data.length === 0) return [];

  // Fields to always exclude from auto-detection
  const exclude = new Set([
    'name',
    'docstatus',
    'owner',
    'modified_by',
    'creation',
    'modified',
    'idx',
    'parent',
    'parenttype',
    'parentfield',
    'doctype',
  ]);

  // Always show 'name' first
  const columns: { key: string; label: string }[] = [
    { key: 'name', label: 'Name' },
  ];

  // Gather keys from the first row, pick up to 5 extra columns
  const keys = Object.keys(data[0]).filter((k) => !exclude.has(k));
  for (const key of keys.slice(0, 5)) {
    columns.push({
      key,
      label: key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }

  // Always add docstatus as last column
  columns.push({ key: 'docstatus', label: 'Status' });

  return columns;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function GenericListClient({
  doctype,
  initialData,
  meta,
}: GenericListClientProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [records, setRecords] = useState(initialData);
  const [currentMeta, setCurrentMeta] = useState(meta);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState('creation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data when search/sort/page changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const result = await fetchDoctypeList(doctype, {
        page,
        search: debouncedSearch || undefined,
        orderby: sortField,
        order: sortOrder,
      });
      if (cancelled) return;
      setIsLoading(false);

      if (result.success) {
        setRecords(result.records);
        setCurrentMeta(result.meta);
      } else {
        toast.error(result.error);
      }
    }

    // Only refetch if not the initial load (initial data comes from server)
    if (page !== 1 || debouncedSearch || sortField !== 'creation' || sortOrder !== 'desc') {
      load();
    } else {
      // Initial data already loaded
      setIsLoading(false);
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, sortField, sortOrder, doctype]);

  const columns = useMemo(() => detectColumns(records), [records]);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortField],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
      setDeleting(name);
      const result = await deleteDoctypeRecord(doctype, name);
      if (result.success) {
        toast.success(result.message || `"${name}" deleted`);
        setRecords((prev) => prev.filter((r) => r.name !== name));
        setCurrentMeta((prev) => ({ ...prev, total: prev.total - 1 }));
      } else {
        toast.error(result.error || 'Delete failed');
      }
      setDeleting(null);
    },
    [doctype],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(currentMeta.total / currentMeta.pageSize),
  );

  const handlePrevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  // ── RENDER: Loading ─────────────────────────────────────────────────────

  if (isLoading && !records.length) {
    return <GenericListSkeleton />;
  }

  // ── RENDER: Error / Empty ───────────────────────────────────────────────

  const doctypeLabel = doctype
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();

  // ── RENDER ──────────────────────────────────────────────────────────────

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
                <BreadcrumbLink href="/dashboard/erp/selling">ERP</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{doctypeLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">{doctypeLabel}</h2>
              <p className="text-sm text-[#64748b] mt-1">
                {currentMeta.total} record{currentMeta.total !== 1 ? 's' : ''} total
              </p>
            </div>
            <Link
              href={`/dashboard/erp/${doctype}/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45] px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              <Plus size={16} /> New {doctypeLabel}
            </Link>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder={`Search ${doctypeLabel} by name...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Loading overlay for refetch */}
          {isLoading && records.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </div>
          )}

          {/* Content */}
          {records.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
              <FileText size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">No records found</p>
              <p className="text-sm">
                {debouncedSearch
                  ? 'Try a different search term'
                  : `Create your first ${doctypeLabel} to get started`}
              </p>
            </div>
          ) : isMobile ? (
            <MobileList
              records={records}
              columns={columns}
              doctype={doctype}
              deleting={deleting}
              onDelete={handleDelete}
            />
          ) : (
            <DesktopTable
              records={records}
              columns={columns}
              doctype={doctype}
              sortField={sortField}
              sortOrder={sortOrder}
              deleting={deleting}
              onSort={handleSort}
              onDelete={handleDelete}
            />
          )}

          {/* Pagination */}
          {currentMeta.total > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-[#64748b]">
                Page {page} of {totalPages} ({currentMeta.total} records)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={handlePrevPage}
                  className="gap-1"
                >
                  <ChevronLeft size={14} /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={handleNextPage}
                  className="gap-1"
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Desktop Table ───────────────────────────────────────────────────────────

interface TableProps {
  records: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  doctype: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  deleting: string | null;
  onSort: (field: string) => void;
  onDelete: (name: string) => void;
}

function DesktopTable({
  records,
  columns,
  doctype,
  sortField,
  sortOrder,
  deleting,
  onSort,
  onDelete,
}: TableProps) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="cursor-pointer select-none hover:bg-gray-100 transition-colors"
                onClick={() => onSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  <span>{col.label}</span>
                  {sortField === col.key && (
                    <ArrowUpDown
                      size={12}
                      className={
                        sortOrder === 'asc'
                          ? 'text-[#1e3a5f]'
                          : 'text-[#1e3a5f] rotate-180'
                      }
                    />
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((row) => {
            const name = String(row.name ?? '');
            return (
              <TableRow
                key={name}
                className="cursor-pointer hover:bg-gray-50 transition-colors group"
                onClick={() => router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(name)}`)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.key === 'docstatus' ? (
                      getStatusBadge(row[col.key])
                    ) : col.key === 'name' ? (
                      <span className="font-medium text-[#0f172a]">
                        {formatCellValue(row[col.key])}
                      </span>
                    ) : (
                      <span className="text-[#64748b]">
                        {formatCellValue(row[col.key])}
                      </span>
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 size={14} className="text-gray-400" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        disabled={deleting === name}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(name);
                        }}
                      >
                        {deleting === name ? (
                          <Loader2 size={14} className="mr-2 animate-spin" />
                        ) : (
                          <Trash2 size={14} className="mr-2" />
                        )}
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Mobile Card List ────────────────────────────────────────────────────────

interface MobileProps {
  records: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  doctype: string;
  deleting: string | null;
  onDelete: (name: string) => void;
}

function MobileList({
  records,
  columns,
  doctype,
  deleting,
  onDelete,
}: MobileProps) {
  const router = useRouter();

  // Pick the 2 most useful data columns (skip name and docstatus)
  const dataColumns = columns.filter(
    (c) => c.key !== 'name' && c.key !== 'docstatus',
  ).slice(0, 2);

  return (
    <div className="space-y-3">
      {records.map((row) => {
        const name = String(row.name ?? '');
        return (
          <Card
            key={name}
            className="border-gray-100 cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(name)}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#0f172a] truncate">
                    {formatCellValue(row.name)}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {dataColumns.map((col) => (
                      <p
                        key={col.key}
                        className="text-sm text-[#64748b] truncate"
                      >
                        <span className="text-[#94a3b8]">{col.label}:</span>{' '}
                        {formatCellValue(row[col.key])}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(row.docstatus)}
                  {deleting !== name && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(name);
                      }}
                    >
                      <Trash2 size={14} className="text-gray-400" />
                    </Button>
                  )}
                  {deleting === name && (
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
