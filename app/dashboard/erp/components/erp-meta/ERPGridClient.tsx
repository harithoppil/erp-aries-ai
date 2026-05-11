'use client';

// ERPGridClient — Inline editable child-table grid.
//
// Renders a Frappe-style Grid widget for child table rows (e.g. Sales Invoice Items).
// Desktop: full <table> with column headers, inline cell editors, totals footer.
// Mobile: stacked card list per row.

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type JSX,
} from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

import { useMediaQuery } from '@/hooks/use-media-query';
import { useDocTypeMeta } from './useDocTypeMeta';
import { toKebabCase } from '@/lib/erpnext/utils';
import type { DocFieldMeta } from '@/lib/erpnext/doctype-meta';
import { GridCell } from './grid-cell';
import { GridRowActions, GridSortableWrapper } from './grid-row-actions';
import { GridExpandPanel } from './grid-expand-panel';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ERPGridClientProps {
  parentDoctype: string;
  parentName: string | null;
  childDoctype: string;
  fieldname: string;
  rows: Record<string, unknown>[];
  editable: boolean;
  reqd: boolean;
  label: string | null;
  onRowsChange: (rows: Record<string, unknown>[]) => void;
}

interface ColumnDef {
  field: DocFieldMeta;
  fieldname: string;
  label: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Numeric fieldtypes that are summable. */
const SUMMABLE_TYPES = new Set(['Currency', 'Float', 'Percent']);

/** Build default values for a new row from DocFieldMeta defaults. */
function buildDefaults(fields: DocFieldMeta[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default == null) continue;
    switch (f.fieldtype) {
      case 'Int':
      case 'Float':
      case 'Currency':
      case 'Percent':
        defaults[f.fieldname] = Number(f.default) || 0;
        break;
      case 'Check':
        defaults[f.fieldname] = f.default === '1';
        break;
      default:
        defaults[f.fieldname] = f.default;
    }
  }
  return defaults;
}

/** Compute amount = qty * rate for Sales Invoice Item -like rows. */
function recomputeDerived(
  row: Record<string, unknown>,
  changedField: string,
): Record<string, unknown> {
  const updated = { ...row };
  // Standard ERPNext computed fields: qty, rate -> amount
  if (changedField === 'qty' || changedField === 'rate') {
    const qty = Number(updated.qty ?? 0);
    const rate = Number(updated.rate ?? 0);
    updated.amount = +(qty * rate).toFixed(2);
  }
  return updated;
}

/** Format a currency total using AED locale. */
function formatCurrencyTotal(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a float total. */
function formatFloatTotal(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ERPGridClient({
  parentDoctype,
  parentName,
  childDoctype,
  fieldname,
  rows,
  editable,
  reqd,
  label,
  onRowsChange,
}: ERPGridClientProps): JSX.Element {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const childSlug = toKebabCase(childDoctype);
  const { meta, loading: metaLoading } = useDocTypeMeta(childSlug);

  // Local rows state mirrors the prop; emits upward debounced.
  const [localRows, setLocalRows] = useState<Record<string, unknown>[]>(rows);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop changes inward (e.g. after parent save + refresh).
  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  // Expanded row panel state
  const [expandedRowName, setExpandedRowName] = useState<string | null>(null);

  // ── Column definitions from metadata ──────────────────────────────────────
  const columns: ColumnDef[] = useMemo(() => {
    if (!meta) return [];
    const fieldMap = new Map<string, DocFieldMeta>();
    for (const f of meta.fields) fieldMap.set(f.fieldname, f);

    const cols: ColumnDef[] = [];
    for (const fieldname of meta.list_view_fields) {
      const field = fieldMap.get(fieldname);
      if (!field) continue;
      // Skip layout-only types (should already be filtered, but guard)
      const skipTypes = new Set([
        'Tab Break', 'Section Break', 'Column Break', 'Fold',
        'Table', 'Table MultiSelect', 'HTML', 'HTML Editor',
        'Button', 'Heading', 'Image',
      ]);
      if (skipTypes.has(field.fieldtype)) continue;
      cols.push({
        field,
        fieldname: field.fieldname,
        label: field.label ?? field.fieldname,
      });
      if (cols.length >= 6) break; // Cap at 6 visible columns
    }
    return cols;
  }, [meta]);

  // ── Debounced upward emission ─────────────────────────────────────────────
  const emitRows = useCallback(
    (next: Record<string, unknown>[]) => {
      // Re-index
      const reindexed = next.map((r, i) => ({ ...r, idx: i + 1 }));
      setLocalRows(reindexed);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onRowsChange(reindexed);
      }, 200);
    },
    [onRowsChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Row mutation handlers ─────────────────────────────────────────────────
  const handleCellChange = useCallback(
    (rowName: string, colField: DocFieldMeta, value: unknown) => {
      setLocalRows((prev) => {
        const next = prev.map((r) => {
          if (r.name !== rowName) return r;
          const updated = { ...r, [colField.fieldname]: value };
          return recomputeDerived(updated, colField.fieldname);
        });
        // Emit upward (no re-index needed for cell change)
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onRowsChange(next);
        }, 200);
        return next;
      });
    },
    [onRowsChange],
  );

  const handleAddRow = useCallback(() => {
    if (!meta) return;
    const defaults = buildDefaults(meta.fields);
    const newRow: Record<string, unknown> = {
      ...defaults,
      name: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      idx: localRows.length + 1,
      __is_new: true,
    };
    emitRows([...localRows, newRow]);
  }, [meta, localRows, emitRows]);

  const handleDuplicateRow = useCallback(
    (rowName: string) => {
      const source = localRows.find((r) => r.name === rowName);
      if (!source) return;
      const idx = localRows.findIndex((r) => r.name === rowName);
      const clone: Record<string, unknown> = {
        ...source,
        name: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        __is_new: true,
      };
      const next = [...localRows];
      next.splice(idx + 1, 0, clone);
      emitRows(next);
    },
    [localRows, emitRows],
  );

  const handleInsertRow = useCallback(
    (rowName: string, position: 'above' | 'below') => {
      const idx = localRows.findIndex((r) => r.name === rowName);
      if (idx < 0) return;
      const defaults = meta ? buildDefaults(meta.fields) : {};
      const newRow: Record<string, unknown> = {
        ...defaults,
        name: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        __is_new: true,
      };
      const next = [...localRows];
      next.splice(position === 'above' ? idx : idx + 1, 0, newRow);
      emitRows(next);
    },
    [meta, localRows, emitRows],
  );

  const handleDeleteRow = useCallback(
    (rowName: string) => {
      const next = localRows.filter((r) => r.name !== rowName);
      emitRows(next);
    },
    [localRows, emitRows],
  );

  // ── Drag reorder ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIdx = localRows.findIndex((r) => r.name === activeId);
      const newIdx = localRows.findIndex((r) => r.name === overId);
      if (oldIdx < 0 || newIdx < 0) return;
      const next = [...localRows];
      const [moved] = next.splice(oldIdx, 1);
      next.splice(newIdx, 0, moved);
      emitRows(next);
    },
    [localRows, emitRows],
  );

  // ── Totals for footer ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const col of columns) {
      const ft = col.field.fieldtype;
      const isSummable =
        SUMMABLE_TYPES.has(ft) ||
        (ft === 'Int' && /^(qty|hours|count)/i.test(col.fieldname));
      if (!isSummable) continue;
      let sum = 0;
      for (const row of localRows) {
        const v = row[col.fieldname];
        sum += typeof v === 'number' ? v : Number(v) || 0;
      }
      sums[col.fieldname] = sum;
    }
    return sums;
  }, [columns, localRows]);

  // ── Expand panel field change handler ─────────────────────────────────────
  const expandedRow = useMemo(
    () => localRows.find((r) => r.name === expandedRowName) ?? null,
    [localRows, expandedRowName],
  );

  const handleExpandFieldChange = useCallback(
    (fieldFieldName: string, value: unknown) => {
      if (!expandedRowName) return;
      setLocalRows((prev) => {
        const next = prev.map((r) => {
          if (r.name !== expandedRowName) return r;
          const updated = { ...r, [fieldFieldName]: value };
          return recomputeDerived(updated, fieldFieldName);
        });
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onRowsChange(next);
        }, 200);
        return next;
      });
    },
    [expandedRowName, onRowsChange],
  );

  // ── Row IDs for sortable context ──────────────────────────────────────────
  const rowIds = useMemo(
    () => localRows.map((r) => String(r.name ?? '')),
    [localRows],
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (metaLoading) {
    return <GridSkeleton />;
  }

  // ── Card header ───────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">
          {label ?? fieldname}
          {reqd && <span className="text-red-500"> *</span>}
        </h4>
        <Badge variant="secondary" className="text-xs">
          {localRows.length} row{localRows.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      {editable && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          className="h-7 text-xs"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Row
        </Button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-md border bg-card p-4">
      {header}

      {localRows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No rows yet. {editable && 'Click "Add Row" to get started.'}
        </p>
      ) : isMobile ? (
        <MobileGrid
          rows={localRows}
          columns={columns}
          editable={editable}
          onCellChange={handleCellChange}
          onDuplicate={handleDuplicateRow}
          onInsertAbove={(name) => handleInsertRow(name, 'above')}
          onInsertBelow={(name) => handleInsertRow(name, 'below')}
          onDelete={handleDeleteRow}
          onToggleExpand={(name) =>
            setExpandedRowName((prev) => (prev === name ? null : name))
          }
          expandedRowName={expandedRowName}
        />
      ) : (
        <DesktopGrid
          rows={localRows}
          columns={columns}
          editable={editable}
          totals={totals}
          rowIds={rowIds}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          onCellChange={handleCellChange}
          onDuplicate={handleDuplicateRow}
          onInsertAbove={(name) => handleInsertRow(name, 'above')}
          onInsertBelow={(name) => handleInsertRow(name, 'below')}
          onDelete={handleDeleteRow}
          onToggleExpand={(name) =>
            setExpandedRowName((prev) => (prev === name ? null : name))
          }
          expandedRowName={expandedRowName}
        />
      )}

      {/* Expand panel */}
      {meta && expandedRow && (
        <GridExpandPanel
          open={expandedRowName !== null}
          onOpenChange={(open) => {
            if (!open) setExpandedRowName(null);
          }}
          childMeta={meta}
          row={expandedRow}
          rowIdx={localRows.findIndex((r) => r.name === expandedRowName)}
          editable={editable}
          onFieldChange={handleExpandFieldChange}
        />
      )}
    </div>
  );
}

// ── Desktop Grid ───────────────────────────────────────────────────────────────

interface DesktopGridProps {
  rows: Record<string, unknown>[];
  columns: ColumnDef[];
  editable: boolean;
  totals: Record<string, number>;
  rowIds: string[];
  sensors: ReturnType<typeof useSensors>[0][];
  onDragEnd: (event: DragEndEvent) => void;
  onCellChange: (rowName: string, field: DocFieldMeta, value: unknown) => void;
  onDuplicate: (rowName: string) => void;
  onInsertAbove: (rowName: string) => void;
  onInsertBelow: (rowName: string) => void;
  onDelete: (rowName: string) => void;
  onToggleExpand: (rowName: string) => void;
  expandedRowName: string | null;
}

function DesktopGrid({
  rows,
  columns,
  editable,
  totals,
  rowIds,
  sensors,
  onDragEnd,
  onCellChange,
  onDuplicate,
  onInsertAbove,
  onInsertBelow,
  onDelete,
  onToggleExpand,
  expandedRowName,
}: DesktopGridProps): JSX.Element {
  const hasTotals = Object.keys(totals).length > 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <GridSortableWrapper rowIds={rowIds}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10 text-center text-xs">#</TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col.fieldname}
                    className="text-xs whitespace-nowrap"
                    style={{ minWidth: col.field.fieldtype === 'Check' ? 50 : 100 }}
                  >
                    {col.label}
                    {col.field.reqd && (
                      <span className="text-red-500"> *</span>
                    )}
                  </TableHead>
                ))}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIdx) => {
                const rowName = String(row.name ?? '');
                return (
                  <TableRow
                    key={rowName}
                    className={
                      expandedRowName === rowName
                        ? 'bg-accent/50'
                        : undefined
                    }
                  >
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {rowIdx + 1}
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.fieldname} className="p-0">
                        <GridCell
                          field={col.field}
                          value={row[col.fieldname]}
                          editable={editable}
                          onChange={(v) => onCellChange(rowName, col.field, v)}
                          row={row}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="p-0">
                      <GridRowActions
                        rowName={rowName}
                        rowIdx={rowIdx}
                        editable={editable}
                        isExpanded={expandedRowName === rowName}
                        onToggleExpand={() => onToggleExpand(rowName)}
                        onDuplicate={() => onDuplicate(rowName)}
                        onInsertAbove={() => onInsertAbove(rowName)}
                        onInsertBelow={() => onInsertBelow(rowName)}
                        onDelete={() => onDelete(rowName)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {hasTotals && (
              <TableFooter>
                <TableRow>
                  <TableCell className="text-xs font-semibold">Total</TableCell>
                  {columns.map((col) => {
                    const total = totals[col.fieldname];
                    if (total === undefined) {
                      return <TableCell key={col.fieldname} />;
                    }
                    const formatted =
                      col.field.fieldtype === 'Currency'
                        ? formatCurrencyTotal(total)
                        : formatFloatTotal(total);
                    return (
                      <TableCell
                        key={col.fieldname}
                        className="text-xs font-semibold text-right pr-3"
                      >
                        {formatted}
                      </TableCell>
                    );
                  })}
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </GridSortableWrapper>
    </DndContext>
  );
}

// ── Mobile Card Grid ───────────────────────────────────────────────────────────

interface MobileGridProps {
  rows: Record<string, unknown>[];
  columns: ColumnDef[];
  editable: boolean;
  onCellChange: (rowName: string, field: DocFieldMeta, value: unknown) => void;
  onDuplicate: (rowName: string) => void;
  onInsertAbove: (rowName: string) => void;
  onInsertBelow: (rowName: string) => void;
  onDelete: (rowName: string) => void;
  onToggleExpand: (rowName: string) => void;
  expandedRowName: string | null;
}

function MobileGrid({
  rows,
  columns,
  editable,
  onCellChange,
  onDuplicate,
  onInsertAbove,
  onInsertBelow,
  onDelete,
  onToggleExpand,
  expandedRowName,
}: MobileGridProps): JSX.Element {
  return (
    <div className="space-y-2">
      {rows.map((row, rowIdx) => {
        const rowName = String(row.name ?? '');
        return (
          <Card
            key={rowName}
            className={expandedRowName === rowName ? 'border-primary' : undefined}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  #{rowIdx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <GridRowActions
                    rowName={rowName}
                    rowIdx={rowIdx}
                    editable={editable}
                    isExpanded={expandedRowName === rowName}
                    onToggleExpand={() => onToggleExpand(rowName)}
                    onDuplicate={() => onDuplicate(rowName)}
                    onInsertAbove={() => onInsertAbove(rowName)}
                    onInsertBelow={() => onInsertBelow(rowName)}
                    onDelete={() => onDelete(rowName)}
                  />
                </div>
              </div>
              {columns.map((col) => (
                <div key={col.fieldname} className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">
                    {col.label}
                    {col.field.reqd && <span className="text-red-500"> *</span>}
                  </label>
                  <GridCell
                    field={col.field}
                    value={row[col.fieldname]}
                    editable={editable}
                    onChange={(v) => onCellChange(rowName, col.field, v)}
                    row={row}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function GridSkeleton(): JSX.Element {
  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
