'use client';

// ERPFilterBar — Horizontal filter bar above the metadata-driven list table.
// Renders per-fieldtype inputs based on StandardFilter definitions from
// loadDocTypeMeta(). Shows first 4 filters by default; the rest are accessible
// via "+ Add Filter" dropdown.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import type { StandardFilter } from '@/lib/erpnext/doctype-meta';
import type { FilterValue, FilterOperator } from './use-list-filters';
import { LinkFieldCombobox } from '@/app/dashboard/erp/[doctype]/[name]/LinkFieldCombobox';

// ── Types ────────────────────────────────────────────────────────────────────

interface ERPFilterBarProps {
  doctype: string;
  filters: StandardFilter[];
  value: Record<string, FilterValue>;
  onChange: (next: Record<string, FilterValue>) => void;
}

const VISIBLE_DEFAULT = 4;

// ── Component ────────────────────────────────────────────────────────────────

export default function ERPFilterBar({
  doctype,
  filters: filterDefs,
  value,
  onChange,
}: ERPFilterBarProps) {
  const [extraVisible, setExtraVisible] = useState<ReadonlySet<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(`erp-filter-visible:${doctype}`);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // Persist extra-visible filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        `erp-filter-visible:${doctype}`,
        JSON.stringify([...extraVisible]),
      );
    } catch { /* ignore */ }
  }, [doctype, extraVisible]);

  const visibleFilters = useMemo(() => {
    const first4 = filterDefs.slice(0, VISIBLE_DEFAULT);
    const first4Names = new Set(first4.map((f) => f.fieldname));
    const extra = filterDefs.filter(
      (f) => !first4Names.has(f.fieldname) && extraVisible.has(f.fieldname),
    );
    return [...first4, ...extra];
  }, [filterDefs, extraVisible]);

  const hiddenFilters = useMemo(() => {
    const visibleNames = new Set(visibleFilters.map((f) => f.fieldname));
    return filterDefs.filter((f) => !visibleNames.has(f.fieldname));
  }, [filterDefs, visibleFilters]);

  const handleAddFilter = useCallback(
    (fieldname: string) => {
      setExtraVisible((prev) => new Set([...prev, fieldname]));
    },
    [],
  );

  const handleRemoveFilter = useCallback(
    (fieldname: string) => {
      setExtraVisible((prev) => {
        const next = new Set(prev);
        next.delete(fieldname);
        return next;
      });
      // Clear the filter value too
      if (fieldname in value) {
        const next = { ...value };
        delete next[fieldname];
        onChange(next);
      }
    },
    [value, onChange],
  );

  const handleClearAll = useCallback(() => {
    onChange({});
  }, [onChange]);

  const hasActiveFilters = Object.keys(value).length > 0;

  if (filterDefs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {visibleFilters.map((f) => (
        <div
          key={f.fieldname}
          className="flex items-end gap-1.5 min-w-[160px]"
        >
          <FilterInput
            filter={f}
            value={value[f.fieldname] ?? null}
            onChange={(v) => {
              const next = { ...value };
              if (v === null || v === undefined || v === '') {
                delete next[f.fieldname];
              } else {
                next[f.fieldname] = v;
              }
              onChange(next);
            }}
          />
          {/* Remove button for extra (non-default) filters */}
          {filterDefs.findIndex((d) => d.fieldname === f.fieldname) >= VISIBLE_DEFAULT && (
            <button
              type="button"
              className="mb-1.5 text-gray-400 hover:text-gray-600"
              onClick={() => handleRemoveFilter(f.fieldname)}
              aria-label={`Remove ${f.label} filter`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {/* Add Filter dropdown */}
      {hiddenFilters.length > 0 && (
        <Popover>
          <PopoverTrigger
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus size={14} /> Add Filter
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {hiddenFilters.map((f) => (
                <label
                  key={f.fieldname}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={extraVisible.has(f.fieldname)}
                    onCheckedChange={(checked) => {
                      if (checked) handleAddFilter(f.fieldname);
                      else handleRemoveFilter(f.fieldname);
                    }}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-gray-500 hover:text-gray-700"
          onClick={handleClearAll}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

// ── FilterInput — per-fieldtype rendering ────────────────────────────────────

interface FilterInputProps {
  filter: StandardFilter;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}

function FilterInput({ filter, value, onChange }: FilterInputProps) {
  switch (filter.fieldtype) {
    case 'Link':
      return <LinkFilterInput filter={filter} value={value} onChange={onChange} />;
    case 'Select':
      return <SelectFilterInput filter={filter} value={value} onChange={onChange} />;
    case 'Date':
    case 'Datetime':
      return <DateRangeFilterInput filter={filter} value={value} onChange={onChange} />;
    case 'Check':
      return <CheckFilterInput filter={filter} value={value} onChange={onChange} />;
    case 'Int':
    case 'Float':
    case 'Currency':
      return <NumberRangeFilterInput filter={filter} value={value} onChange={onChange} />;
    case 'Data':
    case 'Small Text':
    default:
      return <TextFilterInput filter={filter} value={value} onChange={onChange} />;
  }
}

// ── Link filter ──────────────────────────────────────────────────────────────

function LinkFilterInput({ filter, value, onChange }: FilterInputProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <LinkFieldCombobox
        linkTo={filter.options ?? ''}
        value={typeof value === 'string' ? value : ''}
        onChange={(v) => onChange(v || null)}
        placeholder={`Select ${filter.label}…`}
        className="h-8 text-sm"
      />
    </div>
  );
}

// ── Select filter ────────────────────────────────────────────────────────────

function SelectFilterInput({ filter, value, onChange }: FilterInputProps) {
  const options = (filter.options ?? '').split('\n').filter(Boolean);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <Select
        value={typeof value === 'string' && value ? value : '__all__'}
        onValueChange={(v) => onChange(v === '__all__' ? null : v)}
      >
        <SelectTrigger className="h-8 text-sm w-[160px]">
          <SelectValue placeholder={`All ${filter.label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Date range filter ────────────────────────────────────────────────────────

function DateRangeFilterInput({ filter, value, onChange }: FilterInputProps) {
  const range = typeof value === 'object' && value !== null && 'from' in value
    ? (value as { from: string; to: string })
    : { from: '', to: '' };

  const inputType = filter.fieldtype === 'Datetime' ? 'datetime-local' : 'date';

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type={inputType}
          value={range.from}
          onChange={(e) =>
            onChange({ from: e.target.value, to: range.to })
          }
          className="h-8 text-sm w-[150px]"
          placeholder="From"
        />
        <span className="text-muted-foreground text-xs">—</span>
        <Input
          type={inputType}
          value={range.to}
          onChange={(e) =>
            onChange({ from: range.from, to: e.target.value })
          }
          className="h-8 text-sm w-[150px]"
          placeholder="To"
        />
      </div>
    </div>
  );
}

// ── Check (tri-state) filter ────────────────────────────────────────────────

function CheckFilterInput({ filter, value, onChange }: FilterInputProps) {
  const strVal =
    value === true ? 'yes' : value === false ? 'no' : 'any';

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <Select
        value={strVal}
        onValueChange={(v) => {
          if (v === 'yes') onChange(true);
          else if (v === 'no') onChange(false);
          else onChange(null);
        }}
      >
        <SelectTrigger className="h-8 text-sm w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Number range filter ──────────────────────────────────────────────────────

function NumberRangeFilterInput({ filter, value, onChange }: FilterInputProps) {
  const range = typeof value === 'object' && value !== null && 'from' in value
    ? (value as { from: string; to: string })
    : { from: '', to: '' };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={range.from}
          onChange={(e) =>
            onChange({ from: e.target.value, to: range.to })
          }
          className="h-8 text-sm w-[100px]"
          placeholder="Min"
        />
        <span className="text-muted-foreground text-xs">—</span>
        <Input
          type="number"
          value={range.to}
          onChange={(e) =>
            onChange({ from: range.from, to: e.target.value })
          }
          className="h-8 text-sm w-[100px]"
          placeholder="Max"
        />
      </div>
    </div>
  );
}

// ── Text filter (debounced) with operator ────────────────────────────────────

const TEXT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: 'like', label: 'contains' },
  { value: 'not like', label: 'not contains' },
  { value: 'is set', label: 'is set' },
  { value: 'is not set', label: 'is not set' },
];

function TextFilterInput({ filter, value, onChange }: FilterInputProps) {
  // Parse structured { operator, value } or legacy string
  const isStructured = typeof value === 'object' && value !== null && 'operator' in value;
  const operator: FilterOperator = isStructured
    ? (value as { operator: FilterOperator; value: unknown }).operator
    : 'like';
  const rawVal = isStructured
    ? String((value as { operator: FilterOperator; value: unknown }).value ?? '')
    : typeof value === 'string' ? value : '';

  const [local, setLocal] = useState(rawVal);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const emitChange = useCallback((op: FilterOperator, v: string) => {
    if (op === 'is set' || op === 'is not set') {
      onChange({ operator: op, value: null });
    } else if (!v) {
      onChange(null);
    } else {
      onChange({ operator: op, value: v });
    }
  }, [onChange]);

  const handleChange = useCallback(
    (newVal: string) => {
      setLocal(newVal);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        emitChange(operator, newVal);
      }, 250);
    },
    [operator, emitChange],
  );

  const handleOperatorChange = useCallback(
    (op: FilterOperator) => {
      emitChange(op, local);
    },
    [local, emitChange],
  );

  const noValueNeeded = operator === 'is set' || operator === 'is not set';

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{filter.label}</Label>
      <div className="flex items-center gap-1">
        <Select value={operator} onValueChange={(v) => handleOperatorChange(v as FilterOperator)}>
          <SelectTrigger className="h-8 text-xs w-[110px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!noValueNeeded && (
          <Input
            value={local}
            onChange={(e) => handleChange(e.target.value)}
            className="h-8 text-sm w-[140px]"
            placeholder={`Search ${filter.label}…`}
          />
        )}
      </div>
    </div>
  );
}
