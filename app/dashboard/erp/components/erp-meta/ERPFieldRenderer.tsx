'use client';

import { type JSX, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LinkFieldCombobox } from '@/app/dashboard/erp/[doctype]/[name]/LinkFieldCombobox';
import { cn } from '@/lib/utils';
import type { DocFieldMeta } from '@/lib/erpnext/doctype-meta';
import { linkFiltersToWhere } from '@/lib/erpnext/depends-on';
import { ArrowDownToLine } from 'lucide-react';

interface ERPFieldRendererProps {
  field: DocFieldMeta;
  value: unknown;
  editable: boolean;
  onChange?: (val: unknown) => void;
  error?: string;
}

function formatNumber(value: unknown, fractionDigits = 2): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function parseSelectOptions(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Small indicator icon shown next to fields that auto-fetch from a linked doctype.
 * The actual fetch logic will be wired in a future stage (on Link field change).
 */
function FetchFromIndicator({ fetchFrom }: { fetchFrom: string | null }): JSX.Element | null {
  if (!fetchFrom) return null;
  return (
    <span title={`Auto-fetched from: ${fetchFrom}`} className="flex-shrink-0">
      <ArrowDownToLine className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}

/**
 * Render a single Frappe-typed field as the right shadcn/ui component.
 * Read-only mode renders a plain text display; edit mode renders an input.
 */
export function ERPFieldRenderer({
  field,
  value,
  editable,
  onChange,
  error,
}: ERPFieldRendererProps): JSX.Element {
  const readOnly = field.read_only || !editable;
  const errorClass = error ? 'border-red-500 focus-visible:ring-red-500/50' : '';
  const stringValue = typeof value === 'string' ? value : value == null ? '' : String(value);

  // ── Read-only display ────────────────────────────────────────────────────
  if (readOnly) {
    switch (field.fieldtype) {
      case 'Check':
        return (
          <Badge variant={value ? 'default' : 'outline'} className="text-xs">
            {value ? 'Yes' : 'No'}
          </Badge>
        );
      case 'Currency':
      case 'Float':
      case 'Percent':
        return <span className="text-sm">{value == null || value === '' ? '-' : formatNumber(value)}</span>;
      case 'Int':
        return <span className="text-sm">{value == null || value === '' ? '-' : formatNumber(value, 0)}</span>;
      case 'Date':
        return (
          <span className="text-sm">
            {value
              ? new Date(stringValue).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })
              : '-'}
          </span>
        );
      case 'Datetime':
        return (
          <span className="text-sm">
            {value
              ? new Date(stringValue).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : '-'}
          </span>
        );
      case 'Text':
      case 'Small Text':
      case 'Long Text':
      case 'Markdown Editor':
      case 'Text Editor':
        return (
          <p className="whitespace-pre-wrap text-sm text-foreground">{stringValue || '-'}</p>
        );
      case 'HTML':
      case 'HTML Editor':
        return <div className="text-sm" dangerouslySetInnerHTML={{ __html: stringValue }} />;
      default:
        return <span className="text-sm">{stringValue || '-'}</span>;
    }
  }

  // ── Editable inputs ──────────────────────────────────────────────────────
  const handleChange = (v: unknown) => onChange?.(v);
  const placeholder =
    field.placeholder ??
    (field.label ? `Enter ${field.label.toLowerCase()}` : `Enter ${field.fieldname.replace(/_/g, ' ')}`);

  switch (field.fieldtype) {
    case 'Check':
      return (
        <div className="flex items-center gap-3 h-8">
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => handleChange(checked)}
          />
          <span className="text-sm text-muted-foreground">{value ? 'Yes' : 'No'}</span>
        </div>
      );

    case 'Select':
    case 'Autocomplete': {
      const opts = parseSelectOptions(field.options);
      return (
        <>
          <Select value={stringValue} onValueChange={(v) => handleChange(v)}>
            <SelectTrigger className={cn('w-full', errorClass)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((opt) => (
                <SelectItem key={opt} value={opt || '__empty__'}>
                  {opt || '—'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );
    }

    case 'Link':
    case 'Dynamic Link': {
      const linkTo = field.options ?? '';
      if (!linkTo) {
        return (
          <>
            <Input
              id={field.fieldname}
              type="text"
              placeholder={placeholder}
              value={stringValue}
              onChange={(e) => handleChange(e.target.value)}
              className={cn('w-full', errorClass)}
            />
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </>
        );
      }
      // Parse link_filters into a Prisma where clause for the combobox.
      const parsedFilters = useMemo(() => {
        return linkFiltersToWhere(field.link_filters);
      }, [field.link_filters]);

      // Reuse the existing combobox; it expects the doctype's display label.
      return (
        <>
          <div className="flex items-center gap-1">
            <div className="flex-1">
              <LinkFieldCombobox
                linkTo={linkTo.replace(/[-_]/g, '').length ? linkTo : ''}
                value={stringValue}
                onChange={(v) => handleChange(v)}
                hasError={Boolean(error)}
                extraFilters={parsedFilters}
              />
            </div>
            <FetchFromIndicator fetchFrom={field.fetch_from} />
          </div>
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );
    }

    case 'Date':
      return (
        <>
          <Input
            id={field.fieldname}
            type="date"
            value={typeof value === 'string' ? value.slice(0, 10) : ''}
            onChange={(e) => handleChange(e.target.value)}
            className={cn('w-full', errorClass)}
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'Datetime':
      return (
        <>
          <Input
            id={field.fieldname}
            type="datetime-local"
            value={typeof value === 'string' ? value.slice(0, 16) : ''}
            onChange={(e) => handleChange(e.target.value)}
            className={cn('w-full', errorClass)}
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'Time':
      return (
        <>
          <Input
            id={field.fieldname}
            type="time"
            value={stringValue.slice(0, 8)}
            onChange={(e) => handleChange(e.target.value)}
            className={cn('w-full', errorClass)}
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'Int':
    case 'Float':
    case 'Currency':
    case 'Percent':
      return (
        <>
          <div className="flex items-center gap-1">
            <Input
              id={field.fieldname}
              type="number"
              placeholder={placeholder}
              value={value == null ? '' : String(value)}
              step={field.fieldtype === 'Int' ? 1 : 0.01}
              min={field.non_negative ? 0 : undefined}
              onChange={(e) => handleChange(e.target.value === '' ? null : Number(e.target.value))}
              className={cn('w-full', errorClass)}
            />
            <FetchFromIndicator fetchFrom={field.fetch_from} />
          </div>
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'Text':
    case 'Small Text':
      return (
        <>
          <Textarea
            id={field.fieldname}
            placeholder={placeholder}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            rows={3}
            className={cn('w-full', errorClass)}
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'Long Text':
    case 'Markdown Editor':
    case 'Code':
    case 'JSON':
      return (
        <>
          <Textarea
            id={field.fieldname}
            placeholder={placeholder}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            rows={6}
            className={cn('w-full font-mono text-xs', errorClass)}
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'Color':
      return (
        <Input
          id={field.fieldname}
          type="color"
          value={stringValue || '#000000'}
          onChange={(e) => handleChange(e.target.value)}
          className={cn('w-20', errorClass)}
        />
      );

    case 'Password':
      return (
        <>
          <Input
            id={field.fieldname}
            type="password"
            placeholder={placeholder}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            className={cn('w-full', errorClass)}
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );

    case 'HTML':
    case 'HTML Editor':
    case 'Heading':
    case 'Button':
    case 'Image':
      // No editable input — fall through to text input as a sensible default
      return (
        <Input
          id={field.fieldname}
          type="text"
          placeholder={placeholder}
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          className={cn('w-full', errorClass)}
        />
      );

    case 'Attach':
    case 'Attach Image':
      return (
        <div className="flex items-center gap-2">
          <Input
            id={field.fieldname}
            type="url"
            placeholder={placeholder || 'Enter file URL or upload'}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            className={cn('w-full', errorClass)}
          />
          {stringValue && (
            <a
              href={stringValue}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              {field.fieldtype === 'Attach Image' ? 'View' : 'Open'}
            </a>
          )}
        </div>
      );

    case 'Signature':
      return (
        <Input
          id={field.fieldname}
          type="text"
          placeholder={placeholder || 'Signature data (base64)'}
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          className={cn('w-full', errorClass)}
        />
      );

    case 'Rating': {
      const maxStars = 5;
      const ratingVal = Math.min(Math.max(Number(value) || 0, 0), maxStars);
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: maxStars }, (_, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                'text-lg',
                i < ratingVal ? 'text-yellow-500' : 'text-gray-300',
                editable ? 'cursor-pointer hover:scale-110' : 'cursor-default',
              )}
              onClick={() => editable && handleChange(i + 1)}
              disabled={!editable}
            >
              ★
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-1">{ratingVal}/{maxStars}</span>
        </div>
      );
    }

    case 'Phone':
      return (
        <Input
          id={field.fieldname}
          type="tel"
          placeholder={placeholder || '+971-XX-XXX-XXXX'}
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          className={cn('w-full', errorClass)}
        />
      );

    case 'Duration': {
      // Display as HH:MM:SS
      const totalSec = Number(value) || 0;
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const display = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      return (
        <Input
          id={field.fieldname}
          type="text"
          placeholder="00:00:00"
          value={display}
          onChange={(e) => {
            const parts = e.target.value.split(':').map(Number);
            const total = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
            handleChange(total);
          }}
          className={cn('w-full font-mono', errorClass)}
        />
      );
    }

    case 'Text Editor':
      return (
        <Textarea
          id={field.fieldname}
          placeholder={placeholder || 'Enter content…'}
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          rows={6}
          className={cn('w-full min-h-[120px]', errorClass)}
        />
      );

    default:
      return (
        <>
          <div className="flex items-center gap-1">
            <Input
              id={field.fieldname}
              type="text"
              placeholder={placeholder}
              value={stringValue}
              onChange={(e) => handleChange(e.target.value)}
              className={cn('w-full', errorClass)}
            />
            <FetchFromIndicator fetchFrom={field.fetch_from} />
          </div>
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </>
      );
  }
}
