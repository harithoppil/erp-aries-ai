'use client';

// ERPListClient — Metadata-driven list/table component.
// Replaces GenericListClient when metadata exists. Uses DocFieldMeta.list_view_fields
// and standard_filters from loadDocTypeMeta() for column definitions and the
// filter bar. Supports title_field, sort_field, search_fields from DocTypeInfo.

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type JSX,
} from 'react';
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
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  fetchDoctypeList,
  deleteDoctypeRecord,
  type ListMeta,
} from '@/app/dashboard/erp/[doctype]/actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { usePageContext } from '@/hooks/usePageContext';
import { useActionDispatcher, defineAction } from '@/store/useActionDispatcher';
import { useAppStore } from '@/store/useAppStore';
import type { DocTypeMeta, DocFieldMeta } from '@/lib/erpnext/doctype-meta';
import { toKebabCase } from '@/lib/erpnext/utils';

import ERPFilterBar from './ERPFilterBar';
import { useListFilters, type FilterValue } from './use-list-filters';
import { formatListCell, listColumnLabel, statusBadge } from './list-cell';

// ── Types ────────────────────────────────────────────────────────────────────

interface ERPListClientProps {
  doctype: string;
  initialData: Record<string, unknown>[];
  initialMeta: DocTypeMeta;
}

interface ColumnDef {
  fieldname: string;
  label: string;
  field: DocFieldMeta | null; // null for synthetic columns (Name, Status)
  isName: boolean;
  isStatus: boolean;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ERPListClient({
  doctype,
  initialData,
  initialMeta,
}: ERPListClientProps): JSX.Element {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [records, setRecords] = useState<Record<string, unknown>[]>(initialData);
  const [currentMeta, setCurrentMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: initialData.length,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Derive defaults from DocTypeInfo (if available)
  const doctypeLabel = toDisplayLabel(doctype);
  const titleField = (initialMeta.doctype_info?.title_field as string) || null;
  const defaultSortField = (initialMeta.doctype_info?.sort_field as string) || 'creation';
  const defaultSortOrder = (initialMeta.doctype_info?.sort_order as string) === 'ASC' ? 'asc' : 'desc';

  const [sortField, setSortField] = useState(defaultSortField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [page, setPage] = useState(1);

  // Filter state
  const { filters, setFilter, clearAll } = useListFilters(doctype);

  // ── AI: Page context ────────────────────────────────────────────────────
  const uiActionActive = useAppStore((s) => s.uiActionActive);

  const contextSummary = `${doctypeLabel} list: ${currentMeta.total} records total. Page ${page}. ${records.slice(0, 3).map((r) => r.name).join(', ')}`;
  usePageContext(contextSummary);

  // ── Column definitions from metadata ────────────────────────────────────
  const columns: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = [];

    // Permanent Name column at front
    cols.push({
      fieldname: 'name',
      label: 'Name',
      field: null,
      isName: true,
      isStatus: false,
    });

    // Columns from list_view_fields
    const fieldMap = new Map<string, DocFieldMeta>();
    for (const f of initialMeta.fields) {
      fieldMap.set(f.fieldname, f);
    }

    for (const fieldname of initialMeta.list_view_fields) {
      if (fieldname === 'name') continue; // already added
      const field = fieldMap.get(fieldname) ?? null;
      cols.push({
        fieldname,
        label: field ? listColumnLabel(field) : fieldname.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        field,
        isName: false,
        isStatus: false,
      });
    }

    // Permanent Status (docstatus) column at end
    cols.push({
      fieldname: 'docstatus',
      label: 'Status',
      field: null,
      isName: false,
      isStatus: true,
    });

    return cols;
  }, [initialMeta]);

  // ── Debounce search input ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Fetch data when search/sort/page/filters change ─────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      const result = await fetchDoctypeList(doctype, {
        page,
        search: debouncedSearch || undefined,
        orderby: sortField,
        order: sortOrder,
        filters,
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

    // Only refetch if not the initial load
    if (
      page !== 1 ||
      debouncedSearch ||
      sortField !== defaultSortField ||
      sortOrder !== defaultSortOrder ||
      Object.keys(filters).length > 0
    ) {
      load();
    } else {
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, sortField, sortOrder, doctype, filters]);

  // ── Sort handler ────────────────────────────────────────────────────────
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

  // ── Delete handler ──────────────────────────────────────────────────────
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

  // ── AI: Action registration ─────────────────────────────────────────────
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    const actionPrefix = doctype.replace(/[-_]/g, '_');

    registerActions(
      [
        defineAction({
          name: `${actionPrefix}_search`,
          description: `Filter the ${doctypeLabel} list by search term`,
          parameters: {
            type: 'object',
            required: ['term'],
            properties: {
              term: { type: 'string', description: 'Search term to filter by' },
            },
          },
        }),
        defineAction({
          name: `${actionPrefix}_create`,
          description: `Navigate to create a new ${doctypeLabel} record`,
          parameters: { type: 'object', properties: {} },
        }),
        defineAction({
          name: `${actionPrefix}_navigate`,
          description: `Navigate to a specific ${doctypeLabel} record's detail page`,
          parameters: {
            type: 'object',
            required: ['record_name'],
            properties: {
              record_name: { type: 'string', description: 'Record name/ID to navigate to' },
            },
          },
        }),
        defineAction({
          name: `${actionPrefix}_delete`,
          description: `Delete a ${doctypeLabel} record by name`,
          parameters: {
            type: 'object',
            required: ['record_name'],
            properties: {
              record_name: { type: 'string', description: 'Record name to delete' },
            },
          },
        }),
      ],
      {
        [`${actionPrefix}_search`]: (args: Record<string, unknown>) => {
          setSearchTerm(String(args.term));
          toast.info(`AI filtered ${doctypeLabel} by "${args.term}"`);
        },
        [`${actionPrefix}_create`]: () => {
          router.push(`/dashboard/erp/${doctype}/new`);
          toast.info(`AI opened new ${doctypeLabel} form`);
        },
        [`${actionPrefix}_navigate`]: (args: Record<string, unknown>) => {
          router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(String(args.record_name))}`);
        },
        [`${actionPrefix}_delete`]: (args: Record<string, unknown>) => {
          handleDelete(String(args.record_name));
        },
      },
    );
    return () => unregisterActions();
  }, [doctype, doctypeLabel, router, registerActions, unregisterActions, handleDelete]);

  // ── Pagination ──────────────────────────────────────────────────────────
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

  // ── RENDER: Loading skeleton ────────────────────────────────────────────
  if (isLoading && !records.length) {
    return <ERPListSkeleton columnCount={columns.length} />;
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Sticky header: breadcrumb + title + action buttons + search */}
      <div className="flex-shrink-0 space-y-4 pb-4 bg-background">
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

        {uiActionActive && (
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-sm animate-pulse">
            <Sparkles size={14} className="animate-spin" />
            <span>AI is controlling the interface...</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">{doctypeLabel}</h2>
            <p className="text-sm text-[#64748b] mt-1">
              {currentMeta.total} record{currentMeta.total !== 1 ? 's' : ''} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/erp/${doctype}/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45] px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              <Plus size={16} /> New {doctypeLabel}
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <Input
            placeholder={`Search ${doctypeLabel}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-gray-200"
          />
        </div>

        {/* Filter bar */}
        <ERPFilterBar
          doctype={doctype}
          filters={initialMeta.standard_filters}
          value={filters}
          onChange={(next) => {
            // Replace entire filter state
            for (const key of Object.keys(filters)) {
              if (!(key in next)) setFilter(key, null);
            }
            for (const [key, val] of Object.entries(next)) {
              setFilter(key, val);
            }
            setPage(1);
          }}
        />

        {isLoading && records.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-[#64748b]">
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        {records.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
            <FileText size={48} className="mb-4 opacity-40" />
            <p className="text-lg font-medium">No records found</p>
            <p className="text-sm">
              {debouncedSearch || Object.keys(filters).length > 0
                ? 'Try different search or filter criteria'
                : `Create your first ${doctypeLabel} to get started`}
            </p>
          </div>
        ) : isMobile ? (
          <MobileList
            records={records}
            columns={columns}
            doctype={doctype}
            titleField={titleField}
            deleting={deleting}
            onDelete={handleDelete}
          />
        ) : (
          <DesktopTable
            records={records}
            columns={columns}
            doctype={doctype}
            titleField={titleField}
            sortField={sortField}
            sortOrder={sortOrder}
            deleting={deleting}
            onSort={handleSort}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Sticky footer: pagination */}
      {currentMeta.total > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between pt-3 border-t border-gray-100 bg-background">
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
  );
}

// ── Desktop Table ────────────────────────────────────────────────────────────

interface DesktopTableProps {
  records: Record<string, unknown>[];
  columns: ColumnDef[];
  doctype: string;
  titleField: string | null;
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
  titleField,
  sortField,
  sortOrder,
  deleting,
  onSort,
  onDelete,
}: DesktopTableProps) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {columns.map((col) => (
              <TableHead
                key={col.fieldname}
                className="cursor-pointer select-none hover:bg-gray-100 transition-colors"
                onClick={() => onSort(col.fieldname)}
              >
                <div className="flex items-center gap-1">
                  <span>{col.label}</span>
                  {sortField === col.fieldname && (
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
                onClick={() =>
                  router.push(
                    `/dashboard/erp/${doctype}/${encodeURIComponent(name)}`,
                  )
                }
              >
                {columns.map((col) => (
                  <TableCell key={col.fieldname}>
                    {col.isName
                      ? renderNameCell(row, doctype, titleField)
                      : col.isStatus
                        ? statusBadge(row[col.fieldname], 'Int')
                        : col.field
                          ? formatListCell(row[col.fieldname], col.field, row)
                          : String(row[col.fieldname] ?? '--')}
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

// ── Mobile Card List ─────────────────────────────────────────────────────────

interface MobileListProps {
  records: Record<string, unknown>[];
  columns: ColumnDef[];
  doctype: string;
  titleField: string | null;
  deleting: string | null;
  onDelete: (name: string) => void;
}

function MobileList({
  records,
  columns,
  doctype,
  titleField,
  deleting,
  onDelete,
}: MobileListProps) {
  const router = useRouter();

  // Pick up to 2 data columns (skip name and docstatus)
  const dataColumns = columns.filter(
    (c) => !c.isName && !c.isStatus,
  ).slice(0, 2);

  return (
    <div className="space-y-3">
      {records.map((row) => {
        const name = String(row.name ?? '');
        return (
          <Card
            key={name}
            className="border-gray-100 cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() =>
              router.push(
                `/dashboard/erp/${doctype}/${encodeURIComponent(name)}`,
              )
            }
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#0f172a] truncate">
                    {titleField && row[titleField]
                      ? String(row[titleField])
                      : name}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {dataColumns.map((col) => (
                      <p
                        key={col.fieldname}
                        className="text-sm text-[#64748b] truncate"
                      >
                        <span className="text-[#94a3b8]">{col.label}:</span>{' '}
                        {col.field
                          ? String(formatListCell(row[col.fieldname], col.field, row))
                          : String(row[col.fieldname] ?? '--')}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(row.docstatus, 'Int')}
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

// ── Name cell renderer (with title_field support) ───────────────────────────

function renderNameCell(
  row: Record<string, unknown>,
  doctype: string,
  titleField: string | null,
): React.ReactNode {
  const name = String(row.name ?? '');
  const display = titleField && row[titleField] ? String(row[titleField]) : name;

  return (
    <Link
      href={`/dashboard/erp/${doctype}/${encodeURIComponent(name)}`}
      className="font-medium text-[#0f172a] hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {display}
    </Link>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ERPListSkeleton({ columnCount }: { columnCount: number }) {
  const colCount = Math.min(columnCount, 10);
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                {Array.from({ length: colCount }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: colCount }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton
                        className="h-4"
                        style={{
                          width: `${50 + Math.floor(((rowIdx * colCount + colIdx) * 17) % 80)}px`,
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Mobile */}
      <div className="block md:hidden space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-10 w-20" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-gray-100">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
