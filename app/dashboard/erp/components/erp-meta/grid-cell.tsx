'use client';

import { type JSX, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { DocFieldMeta } from '@/lib/erpnext/doctype-meta';
import { LinkFieldCombobox } from '@/app/dashboard/erp/[doctype]/[name]/LinkFieldCombobox';
import { formatListCell } from './list-cell';

interface GridCellProps {
  field: DocFieldMeta;
  value: unknown;
  editable: boolean;
  onChange: (value: unknown) => void;
  /** Row data for formatListCell read-only rendering */
  row: Record<string, unknown>;
}

/**
 * Parse Select/Autocomplete options from the `\n`-delimited string format
 * that Frappe stores in DocField.options for Select fields.
 */
function parseSelectOptions(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Inline cell editor for the ERPGridClient table.
 *
 * Uses unstyled native inputs (transparent bg, fill cell).
 * On focus: border lights up with border-primary.
 * On invalid: red border via aria-invalid.
 */
export function GridCell({
  field,
  value,
  editable,
  onChange,
  row,
}: GridCellProps): JSX.Element {
  const readOnly = field.read_only || !editable;
  const stringValue =
    typeof value === 'string' ? value : value == null ? '' : String(value);

  // ── Read-only cell ────────────────────────────────────────────────────────
  if (readOnly) {
    return (
      <span className="block truncate text-sm px-2 py-1">
        {formatListCell(value, field, row) as React.ReactNode}
      </span>
    );
  }

  // ── Editable cells ────────────────────────────────────────────────────────
  const baseInputClass = cn(
    'w-full h-full bg-transparent border-0 outline-none text-sm px-2 py-1',
    'focus:ring-1 focus:ring-primary focus:border-primary rounded-none',
  );

  switch (field.fieldtype) {
    case 'Int': {
      return (
        <input
          type="number"
          step={1}
          min={field.non_negative ? 0 : undefined}
          value={value == null ? '' : String(value)}
          aria-invalid={field.reqd && (value == null || value === '') ? true : undefined}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
          className={cn(baseInputClass, 'text-right')}
        />
      );
    }

    case 'Float':
    case 'Currency':
    case 'Percent': {
      return (
        <input
          type="number"
          step={0.01}
          min={field.non_negative ? 0 : undefined}
          value={value == null ? '' : String(value)}
          aria-invalid={field.reqd && (value == null || value === '') ? true : undefined}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
          className={cn(baseInputClass, 'text-right')}
        />
      );
    }

    case 'Date': {
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );
    }

    case 'Datetime': {
      return (
        <input
          type="datetime-local"
          value={typeof value === 'string' ? value.slice(0, 16) : ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );
    }

    case 'Check': {
      const boolVal = value === true || value === 1 || value === '1';
      return (
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox"
            checked={boolVal}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        </div>
      );
    }

    case 'Link':
    case 'Dynamic Link': {
      const linkTo = field.options ?? '';
      if (!linkTo) {
        return (
          <input
            type="text"
            value={stringValue}
            aria-invalid={field.reqd && !stringValue ? true : undefined}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
          />
        );
      }
      return (
        <div className="h-full flex items-center">
          <LinkFieldCombobox
            linkTo={linkTo}
            value={stringValue}
            onChange={(v) => onChange(v)}
            hasError={field.reqd && !stringValue}
            className={cn(
              'h-8 text-sm border-0 shadow-none rounded-none px-1 py-0',
              'focus:ring-1 focus:ring-primary',
            )}
          />
        </div>
      );
    }

    case 'Select':
    case 'Autocomplete': {
      const opts = useMemo(() => parseSelectOptions(field.options), [field.options]);
      return (
        <select
          value={stringValue}
          aria-invalid={field.reqd && !stringValue ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(baseInputClass, 'appearance-none pr-6 bg-no-repeat bg-[right_4px_center]')}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          }}
        >
          <option value="">--</option>
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    case 'Data':
    case 'Small Text':
    case 'Read Only': {
      return (
        <input
          type="text"
          value={stringValue}
          aria-invalid={field.reqd && !stringValue ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );
    }

    case 'Text':
    case 'Long Text': {
      // In-grid: single-line preview. Full editing happens via expand panel.
      return (
        <input
          type="text"
          value={stringValue}
          aria-invalid={field.reqd && !stringValue ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
          title={stringValue}
        />
      );
    }

    default: {
      // Anything else: read-only text
      return (
        <span className="block truncate text-sm px-2 py-1 text-muted-foreground">
          {stringValue || '--'}
        </span>
      );
    }
  }
}
