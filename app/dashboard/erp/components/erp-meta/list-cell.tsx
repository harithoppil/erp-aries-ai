'use client';

// list-cell.tsx — Pure render helpers for metadata-driven list/table cells.
// Reused by ERPListClient (Stage 1) and ERPGridClient (Stage 2).

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { DocFieldMeta } from '@/lib/erpnext/doctype-meta';
import { toKebabCase } from '@/lib/erpnext/utils';

// ── Status badge palette ─────────────────────────────────────────────────────

interface StatusStyle {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}

const STATUS_PALETTE: Record<string, StatusStyle> = {
  draft: {
    variant: 'outline',
    className: 'bg-gray-50 text-gray-600 border-gray-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  submitted: {
    variant: 'default',
    className: 'bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  cancelled: {
    variant: 'destructive',
    className: 'bg-red-50 text-red-700 border-red-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  open: {
    variant: 'default',
    className: 'bg-blue-50 text-blue-700 border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  closed: {
    variant: 'outline',
    className: 'bg-gray-50 text-gray-600 border-gray-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  paid: {
    variant: 'default',
    className: 'bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  overdue: {
    variant: 'destructive',
    className: 'bg-red-50 text-red-700 border-red-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  approved: {
    variant: 'default',
    className: 'bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  pending: {
    variant: 'secondary',
    className: 'bg-amber-50 text-amber-700 border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  active: {
    variant: 'default',
    className: 'bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
  disabled: {
    variant: 'outline',
    className: 'bg-gray-50 text-gray-600 border-gray-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
  },
};

// ── Exports ──────────────────────────────────────────────────────────────────

/**
 * Format a single cell value based on the field's metadata type.
 * Returns a React node (string, Badge, Link, etc.).
 */
export function formatListCell(
  value: unknown,
  field: DocFieldMeta,
  row: Record<string, unknown>,
): React.ReactNode {
  if (value === null || value === undefined) return '--';

  switch (field.fieldtype) {
    case 'Data':
    case 'Small Text':
    case 'Read Only':
    case 'Password': {
      const text = String(value);
      return text.length > 60 ? text.slice(0, 60) + '…' : text;
    }

    case 'Int': {
      const num = Number(value);
      return isNaN(num) ? String(value) : num.toLocaleString();
    }

    case 'Float':
    case 'Percent': {
      const fnum = Number(value);
      return isNaN(fnum)
        ? String(value)
        : fnum.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    }

    case 'Currency': {
      const cnum = Number(value);
      if (isNaN(cnum)) return String(value);
      const rowCurrency =
        'currency' in row && typeof row.currency === 'string'
          ? row.currency
          : 'AED';
      try {
        return cnum.toLocaleString('en-AE', {
          style: 'currency',
          currency: rowCurrency,
        });
      } catch {
        return cnum.toLocaleString('en-AE', {
          style: 'currency',
          currency: 'AED',
        });
      }
    }

    case 'Date': {
      const d = new Date(String(value));
      return isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
    }

    case 'Datetime': {
      const dt = new Date(String(value));
      if (isNaN(dt.getTime())) return String(value);
      const datePart = dt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timePart = dt.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${datePart} ${timePart}`;
    }

    case 'Check': {
      const boolVal = value === true || value === 1 || value === '1';
      return (
        <Badge variant={boolVal ? 'default' : 'outline'}>
          {boolVal ? 'Yes' : 'No'}
        </Badge>
      );
    }

    case 'Link': {
      const linkVal = String(value);
      const targetDoctype = field.options ?? '';
      const slug = toKebabCase(targetDoctype);
      return (
        <Link
          href={`/dashboard/erp/${slug}/${encodeURIComponent(linkVal)}`}
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {linkVal}
        </Link>
      );
    }

    case 'Select': {
      const selectVal = String(value);
      const style = STATUS_PALETTE[selectVal.toLowerCase()];
      if (style) {
        return (
          <Badge variant={style.variant} className={style.className}>
            {selectVal}
          </Badge>
        );
      }
      return selectVal;
    }

    default: {
      const fallback = String(value);
      return fallback.length > 60 ? fallback.slice(0, 60) + '…' : fallback;
    }
  }
}

/**
 * Return the human-readable label for a list column.
 * Uses `field.label` if present, else prettifies `field.fieldname`.
 */
export function listColumnLabel(field: DocFieldMeta): string {
  if (field.label) return field.label;
  return field.fieldname
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Render a status badge for a known status value.
 * Falls back to outline-style Badge for unknown statuses.
 */
export function statusBadge(status: unknown, fieldtype: string): React.ReactNode {
  // docstatus numeric handling
  if (fieldtype === 'Int' && (status === 0 || status === 1 || status === 2)) {
    const numStatus = Number(status);
    if (numStatus === 1) {
      return (
        <Badge
          variant="default"
          className="bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium"
        >
          Submitted
        </Badge>
      );
    }
    if (numStatus === 2) {
      return (
        <Badge
          variant="destructive"
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

  const strStatus = String(status ?? '');
  const style = STATUS_PALETTE[strStatus.toLowerCase()];
  if (style) {
    return (
      <Badge variant={style.variant} className={style.className}>
        {strStatus}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
      {strStatus}
    </Badge>
  );
}
