'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Filter,
  Group,
  Play,
  Table2,
  X,
} from 'lucide-react';
import {
  runReport,
  type ReportColumn,
  type ReportFilter,
  type ReportData,
  type RunReportResult,
} from '@/app/dashboard/erp/report-builder-actions';
import { loadDocTypeMeta, type DocFieldMeta } from '@/lib/erpnext/doctype-meta';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

interface ERPReportBuilderProps {
  doctype: string;
}

const AGGREGATION_LABELS: Record<string, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
};

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Not Empty' },
];

function ReportSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ERPReportBuilder({ doctype }: ERPReportBuilderProps): JSX.Element {
  const [fields, setFields] = useState<DocFieldMeta[]>([]);
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [aggregation, setAggregation] = useState<'count' | 'sum' | 'avg' | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showGroupBy, setShowGroupBy] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Load DocType metadata
  useEffect(() => {
    let cancelled = false;
    loadDocTypeMeta(doctype).then((meta) => {
      if (cancelled) return;
      const visibleFields = meta.fields.filter(
        (f) => !f.report_hide && f.fieldtype !== 'Section Break' && f.fieldtype !== 'Column Break' && f.fieldtype !== 'HTML',
      );
      setFields(visibleFields);
      // Auto-select name + first 5 fields
      const autoSelect = visibleFields.slice(0, 5);
      setColumns(visibleFields.map((f, i) => ({
        fieldname: f.fieldname,
        label: f.label || f.fieldname,
        fieldtype: f.fieldtype,
        selected: i < 5 || f.fieldname === 'name',
      })));
      // Default sort
      if (meta.doctype_info?.sort_field) {
        setSortField(meta.doctype_info.sort_field as string);
        setSortOrder((meta.doctype_info.sort_order as string) === 'ASC' ? 'asc' : 'desc');
      }
    });
    return () => { cancelled = true; };
  }, [doctype]);

  const handleRun = useCallback(async () => {
    setLoading(true);
    const result: RunReportResult = await runReport({
      doctype,
      columns,
      filters: filters.filter((f) => f.fieldname && f.value),
      sortField,
      sortOrder,
      groupBy,
      aggregation,
    });
    if (result.success) {
      setData(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [doctype, columns, filters, sortField, sortOrder, groupBy, aggregation]);

  const toggleColumn = useCallback((fieldname: string) => {
    setColumns((prev) =>
      prev.map((c) => c.fieldname === fieldname ? { ...c, selected: !c.selected } : c),
    );
  }, []);

  const addFilter = useCallback(() => {
    setFilters((prev) => [...prev, { fieldname: '', operator: 'equals', value: '' }]);
  }, []);

  const updateFilter = useCallback((idx: number, patch: Partial<ReportFilter>) => {
    setFilters((prev) => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }, []);

  const removeFilter = useCallback((idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const headers = data.columns.map((c) => c.label).join(',');
    const rows = data.rows.map((r) =>
      data.columns.map((c) => {
        const val = String(r[c.fieldname] ?? '');
        return val.includes(',') ? `"${val}"` : val;
      }).join(','),
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doctype}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, doctype]);

  const selectedCols = columns.filter((c) => c.selected);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Report — {toDisplayLabel(doctype)}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            <Columns3 className="h-3 w-3 mr-1" /> Columns ({selectedCols.length})
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3 w-3 mr-1" /> Filters ({filters.length})
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowGroupBy(!showGroupBy)}>
            <Group className="h-3 w-3 mr-1" /> Group
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportCSV} disabled={!data}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleRun} disabled={loading || selectedCols.length === 0}>
            <Play className="h-3 w-3 mr-1" /> Run
          </Button>
        </div>
      </div>

      {/* Column Picker */}
      {showColumnPicker && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs">Select Columns</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={isMobile ? 'grid grid-cols-2 gap-1' : 'grid grid-cols-5 gap-1'}>
              {columns.map((col) => (
                <button
                  key={col.fieldname}
                  onClick={() => toggleColumn(col.fieldname)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                    col.selected
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className={`h-3 w-3 rounded border ${col.selected ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground/30'}`} />
                  {col.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">Filters</CardTitle>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={addFilter}>+ Add</Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {filters.length === 0 && (
              <p className="text-xs text-muted-foreground">No filters. Click + Add to create one.</p>
            )}
            {filters.map((f, idx) => (
              <div key={idx} className={isMobile ? 'space-y-1' : 'flex items-center gap-2'}>
                <select
                  value={f.fieldname}
                  onChange={(e) => updateFilter(idx, { fieldname: e.target.value })}
                  className="h-7 rounded-md border bg-transparent px-2 text-xs flex-1"
                >
                  <option value="">Field...</option>
                  {fields.map((field) => (
                    <option key={field.fieldname} value={field.fieldname}>{field.label || field.fieldname}</option>
                  ))}
                </select>
                <select
                  value={f.operator}
                  onChange={(e) => updateFilter(idx, { operator: e.target.value })}
                  className="h-7 rounded-md border bg-transparent px-2 text-xs"
                >
                  {FILTER_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {!['is_empty', 'is_not_empty'].includes(f.operator) && (
                  <Input
                    value={f.value}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    placeholder="Value"
                    className="h-7 text-xs flex-1"
                  />
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeFilter(idx)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Group By */}
      {showGroupBy && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs">Group & Aggregate</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={isMobile ? 'space-y-2' : 'flex items-center gap-2'}>
              <select
                value={groupBy ?? ''}
                onChange={(e) => setGroupBy(e.target.value || null)}
                className="h-7 rounded-md border bg-transparent px-2 text-xs flex-1"
              >
                <option value="">No grouping</option>
                {fields.map((field) => (
                  <option key={field.fieldname} value={field.fieldname}>{field.label || field.fieldname}</option>
                ))}
              </select>
              {groupBy && (
                <select
                  value={aggregation ?? ''}
                  onChange={(e) => setAggregation(e.target.value as 'count' | 'sum' | 'avg' | null || null)}
                  className="h-7 rounded-md border bg-transparent px-2 text-xs"
                >
                  <option value="">Aggregation...</option>
                  {Object.entries(AGGREGATION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {loading ? (
        <ReportSkeleton />
      ) : data ? (
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardDescription>{data.rows.length} rows</CardDescription>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => setShowChart(!showChart)} disabled={!data.chartData}>
                  <BarChart3 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {/* Chart */}
            {showChart && data.chartData && (
              <div className="mb-4 space-y-1">
                {data.chartData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate">{d.label}</span>
                    <div
                      className="h-4 bg-blue-500 rounded-full"
                      style={{ width: `${Math.max(2, (d.value / Math.max(...data.chartData!.map((c) => c.value), 1)) * 200)}px` }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {data.columns.map((col) => (
                      <th
                        key={col.fieldname}
                        className="text-left py-1.5 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => {
                          if (sortField === col.fieldname) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(col.fieldname);
                            setSortOrder('asc');
                          }
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortField === col.fieldname && (
                            sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      {data.columns.map((col) => (
                        <td key={col.fieldname} className="py-1.5 px-2 truncate max-w-[200px]">
                          {String(row[col.fieldname] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={data.columns.length} className="py-8 text-center text-muted-foreground">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Totals row */}
                {Object.values(data.totals).some((v) => v !== null) && (
                  <tfoot>
                    <tr className="border-t-2 font-medium bg-muted/20">
                      {data.columns.map((col) => (
                        <td key={col.fieldname} className="py-1.5 px-2">
                          {data.totals[col.fieldname] != null ? Number(data.totals[col.fieldname]).toLocaleString() : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Table2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Select columns and click Run to generate a report</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
