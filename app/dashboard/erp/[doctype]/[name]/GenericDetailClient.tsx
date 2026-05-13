'use client';

// ── Generic Detail Client ─────────────────────────────────────────────────────
// Renders detail/edit view for ANY ERPNext doctype.
// Pattern 1: Mobile/Desktop split via useMediaQuery.
// Pattern 2: Skeleton loading.
// Pattern 4: Settings-style tabs at bottom.

import { useState, useMemo, useCallback, useEffect, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';

// shadcn
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Icons
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Send,
  Ban,
  Trash2,
  MoreHorizontal,
  Plus,
  MessageSquare,
  Paperclip,
  Activity,
  Copy,
  Sparkles,
  Printer,
} from 'lucide-react';

// Actions
import {
  updateDoctypeRecord,
  deleteDoctypeRecord,
  submitDoctypeRecord,
  cancelDoctypeRecord,
  createDoctypeRecord,
} from './actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import type { SchemaField } from './actions';
import { LinkFieldCombobox } from './LinkFieldCombobox';
import { usePageContext } from '@/hooks/usePageContext';
import { useActionDispatcher, defineAction } from '@/store/useActionDispatcher';
import { useAppStore } from '@/store/useAppStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenericDetailClientProps {
  doctype: string;
  record: Record<string, unknown>;
  childTables: Record<string, Record<string, unknown>[]>;
  isNew?: boolean;
  schemaFields?: SchemaField[];
  isSubmittable?: boolean;
}

// Stable empty default — declaring `schemaFields = []` inline creates a new
// array on every render, which makes the AI-action useEffect deps see a
// different identity each time and re-run, thrashing the Zustand store and
// triggering React error #185 (max update depth).
const EMPTY_SCHEMA_FIELDS: SchemaField[] = [];

// Doctypes that have a printable invoice/order/quotation layout. The Print PDF
// button only shows for these — generic master data (Customer, Item, …) has no
// useful "document" layout to print.
const PRINTABLE_DOCTYPES = new Set([
  'sales-invoice', 'salesinvoice', 'SalesInvoice',
  'purchase-invoice', 'purchaseinvoice', 'PurchaseInvoice',
  'sales-order', 'salesorder', 'SalesOrder',
  'purchase-order', 'purchaseorder', 'PurchaseOrder',
  'quotation', 'Quotation',
  'delivery-note', 'deliverynote', 'DeliveryNote',
  'purchase-receipt', 'purchasereceipt', 'PurchaseReceipt',
]);

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_FIELDS = new Set([
  'creation',
  'modified',
  'owner',
  'modified_by',
  'docstatus',
  'idx',
  'parent',
  'parentfield',
  'parenttype',
  '_user_tags',
  '_comments',
  '_assign',
  '_liked_by',
]);

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return true;
  if (typeof value === 'string') {
    // ISO 8601 or common date patterns
    return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value) && value.length >= 10 && value.length <= 30;
  }
  return false;
}

function isBooleanLike(value: unknown): boolean {
  return typeof value === 'boolean' || value === 0 || value === 1;
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === 'number') return true;
  if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) return true;
  return false;
}

type FieldType = 'date' | 'boolean' | 'number' | 'text' | 'textarea' | 'string';

/** Map Prisma DMMF type strings to our FieldType */
function prismaTypeToFieldType(prismaType: string): FieldType {
  const t = prismaType.toLowerCase();
  if (t === 'datetime' || t === 'date') return 'date';
  if (t === 'boolean') return 'boolean';
  if (['int', 'float', 'decimal', 'double', 'bigdecimal', 'bigint'].includes(t)) return 'number';
  if (t === 'text' || t === 'json') return 'textarea';
  return 'string';
}

function detectFieldType(key: string, value: unknown, prismaType?: string): FieldType {
  // Prefer Prisma schema type when available (especially for /new forms where values are empty)
  if (prismaType) return prismaTypeToFieldType(prismaType);
  if (isDateLike(value)) return 'date';
  if (isBooleanLike(value)) return 'boolean';
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value !== '')) {
    return 'number';
  }
  if (typeof value === 'string' && value.length > 100) return 'textarea';
  return 'string';
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ── Status Helpers ────────────────────────────────────────────────────────────

function getDocStatus(record: Record<string, unknown>): number {
  return Number(record.docstatus ?? 0);
}

function getStatusBadge(docstatus: number): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (docstatus) {
    case 1:
      return { label: 'Submitted', variant: 'default' };
    case 2:
      return { label: 'Cancelled', variant: 'destructive' };
    default:
      return { label: 'Draft', variant: 'secondary' };
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GenericDetailClient({
  doctype,
  record: initialRecord,
  childTables: initialChildTables,
  isNew = false,
  schemaFields = EMPTY_SCHEMA_FIELDS,
  isSubmittable = false,
}: GenericDetailClientProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // ── State ─────────────────────────────────────────────────────────────
  const [record, setRecord] = useState<Record<string, unknown>>(initialRecord);
  const [childTables, setChildTables] = useState<Record<string, Record<string, unknown>[]>>(initialChildTables);
  const [isEditing, setIsEditing] = useState(isNew);
  const [editData, setEditData] = useState<Record<string, unknown>>(isNew ? { ...initialRecord } : {});
  const [editChildTables, setEditChildTables] = useState<Record<string, Record<string, unknown>[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [commentText, setCommentText] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const docstatus = getDocStatus(record);
  const statusBadge = getStatusBadge(docstatus);
  const recordName = (record.name as string) || '';
  const doctypeLabel = toDisplayLabel(doctype);
  const displayTitle = isNew ? `New ${doctypeLabel}` : `${doctypeLabel} / ${recordName}`;

  // ── Scalar fields ─────────────────────────────────────────────────────
  // Build a Prisma type lookup from schemaFields so we get correct input types
  const schemaTypeMap = useMemo(() => {
    const map = new Map<string, { type: string; required: boolean; linkTo?: string }>();
    for (const f of schemaFields) {
      map.set(f.name, { type: f.type, required: f.required, linkTo: f.linkTo });
    }
    return map;
  }, [schemaFields]);

  const scalarFields = useMemo(() => {
    const fields: Array<{ key: string; value: unknown; type: FieldType; required: boolean; linkTo?: string }> = [];
    for (const [key, value] of Object.entries(record)) {
      if (SYSTEM_FIELDS.has(key)) continue;
      if (Array.isArray(value)) continue;
      if (value !== null && value !== undefined && typeof value === 'object' && !(value instanceof Date)) continue;
      const schemaInfo = schemaTypeMap.get(key);
      const type = detectFieldType(key, value, schemaInfo?.type);
      const required = schemaInfo?.required ?? false;
      fields.push({ key, value, type, required, linkTo: schemaInfo?.linkTo });
    }
    return fields;
  }, [record, schemaTypeMap]);

  // ── AI: Page context ───────────────────────────────────────────────────
  const uiActionActive = useAppStore((s) => s.uiActionActive);

  const fieldSummary = scalarFields.slice(0, 8).map((f) => `${f.key}: ${String(f.value ?? '').slice(0, 50)}`).join(', ');
  const childSummary = Object.entries(childTables).map(([k, v]) => `${k}: ${v.length} rows`).join(', ');
  const contextSummary = isNew
    ? `New ${doctypeLabel} form. Fields: ${schemaFields.map((f) => f.name).join(', ') || 'none'}`
    : `${doctypeLabel} detail: ${recordName}. Status: ${['Draft', 'Submitted', 'Cancelled'][docstatus]}. Fields: ${fieldSummary}.${childSummary ? ` Child tables: ${childSummary}.` : ''}`;
  usePageContext(contextSummary);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleEditStart = useCallback(() => {
    const editableData: Record<string, unknown> = {};
    for (const { key, value } of scalarFields) {
      editableData[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
    }
    setEditData(editableData);
    setEditChildTables(JSON.parse(JSON.stringify(childTables)));
    setFieldErrors({});
    setIsEditing(true);
  }, [scalarFields, childTables]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditData({});
    setEditChildTables({});
    setFieldErrors({});
  }, []);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleChildCellChange = useCallback(
    (tableKey: string, rowIndex: number, fieldKey: string, value: unknown) => {
      setEditChildTables((prev) => {
        const updated = { ...prev };
        const rows = [...(updated[tableKey] || [])];
        rows[rowIndex] = { ...rows[rowIndex], [fieldKey]: value };
        updated[tableKey] = rows;
        return updated;
      });
    },
    [],
  );

  const handleAddChildRow = useCallback(
    (tableKey: string) => {
      setEditChildTables((prev) => {
        const updated = { ...prev };
        const rows = [...(updated[tableKey] || [])];
        const firstRow = rows[0] || {};
        const newRow: Record<string, unknown> = {};
        for (const key of Object.keys(firstRow)) {
          if (key === 'name') newRow[key] = `new-${Date.now()}-${rows.length}`;
          else if (key === 'idx') newRow[key] = rows.length + 1;
          else if (key === 'parent') newRow[key] = recordName;
          else if (key === 'parenttype') newRow[key] = doctype;
          else if (key === 'parentfield') newRow[key] = tableKey;
          else newRow[key] = null;
        }
        rows.push(newRow);
        updated[tableKey] = rows;
        return updated;
      });
    },
    [recordName, doctype],
  );

  const handleDeleteChildRow = useCallback(
    (tableKey: string, rowIndex: number) => {
      setEditChildTables((prev) => {
        const updated = { ...prev };
        const rows = [...(updated[tableKey] || [])];
        rows.splice(rowIndex, 1);
        updated[tableKey] = rows;
        return updated;
      });
    },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    const data = isNew ? editData : editData;

    for (const { key, required, type } of scalarFields) {
      if (!required) continue;
      const val = data[key];
      if (val === undefined || val === null || val === '') {
        errors[key] = `${formatFieldName(key)} is required`;
      }
      // Date validation: ensure it's a valid date string
      if (type === 'date' && val && typeof val === 'string') {
        const parsed = new Date(val);
        if (isNaN(parsed.getTime())) {
          errors[key] = `${formatFieldName(key)} must be a valid date`;
        }
      }
      // Number validation
      if (type === 'number' && val !== undefined && val !== null && val !== '') {
        if (isNaN(Number(val))) {
          errors[key] = `${formatFieldName(key)} must be a valid number`;
        }
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the errors below');
      return false;
    }
    return true;
  }, [scalarFields, editData, isNew]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Build a set of date field keys so we can coerce YYYY-MM-DD → ISO DateTime
      const dateFieldKeys = new Set(scalarFields.filter((f) => f.type === 'date').map((f) => f.key));

      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editData)) {
        if (value === '' || value === null || value === undefined) continue;
        // Prisma DateTime fields require ISO-8601 strings, not bare YYYY-MM-DD
        if (dateFieldKeys.has(key) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          payload[key] = new Date(value + 'T00:00:00.000Z').toISOString();
        } else {
          payload[key] = value;
        }
      }
      for (const [tableKey, rows] of Object.entries(editChildTables)) {
        payload[tableKey] = rows.map((row, i) => ({
          ...row,
          idx: i + 1,
        }));
      }

      if (isNew) {
        const result = await createDoctypeRecord(doctype, payload);
        if (result.success) {
          toast.success(`${doctypeLabel} created successfully`);
          const createdName = (result.data as Record<string, unknown>)?.name;
          if (createdName) {
            router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(String(createdName))}`);
          } else {
            router.push(`/dashboard/erp/${doctype}`);
          }
        } else {
          toast.error(result.error || 'Failed to create record');
        }
      } else {
        const result = await updateDoctypeRecord(doctype, recordName, payload);
        if (result.success) {
          toast.success(`${doctypeLabel} updated successfully`);
          // Update local record state so the UI reflects changes immediately
          setRecord((prev) => ({ ...prev, ...payload, ...(result.data as Record<string, unknown>) }));
          router.refresh();
          setIsEditing(false);
        } else {
          toast.error(result.error || 'Failed to update record');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, editData, editChildTables, doctype, doctypeLabel, recordName, isNew, scalarFields, router]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await submitDoctypeRecord(doctype, recordName);
      if (result.success) {
        toast.success(`${doctype} submitted successfully`);
        setRecord((prev) => ({ ...prev, docstatus: 1 }));
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(!result.success ? result.error : 'Submit failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [doctype, recordName, router]);

  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      const result = await cancelDoctypeRecord(doctype, recordName);
      if (result.success) {
        toast.success(`${doctype} cancelled successfully`);
        setRecord((prev) => ({ ...prev, docstatus: 2 }));
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(!result.success ? result.error : 'Cancel failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  }, [doctype, recordName, router]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await deleteDoctypeRecord(doctype, recordName);
      if (result.success) {
        toast.success(`${doctype} deleted`);
        // Navigate back to list
        const slug = doctype.replace(/ /g, '-').toLowerCase();
        router.push(`/dashboard/erp/${slug}`);
      } else {
        toast.error(!result.success ? result.error : 'Delete failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [doctype, recordName, router]);

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(recordName);
    toast.success('Name copied to clipboard');
  }, [recordName]);

  const isPrintable = PRINTABLE_DOCTYPES.has(doctype) || PRINTABLE_DOCTYPES.has(doctype.toLowerCase());

  const handlePrintPdf = useCallback(() => {
    if (!recordName) return;
    const url = `/api/erp-pdf/${encodeURIComponent(doctype)}/${encodeURIComponent(recordName)}`;
    window.open(url, '_blank', 'noopener');
  }, [doctype, recordName]);

  // ── AI: Action registration (must be after all handlers) ───────────────
  // Select only the methods (stable refs) — subscribing to the whole store
  // would re-render this component on every registerActions() call.
  const registerActions = useActionDispatcher((s) => s.registerActions);
  const unregisterActions = useActionDispatcher((s) => s.unregisterActions);
  useEffect(() => {
    const actionPrefix = doctype.replace(/[-_]/g, '_');
    const fieldProps: Record<string, { type: string; description: string }> = {};
    const fields = isNew ? schemaFields : scalarFields;
    for (const f of fields) {
      const name = 'name' in f ? (f as { name: string }).name : (f as { key: string }).key;
      if (name && name !== 'name') {
        fieldProps[name] = { type: 'string', description: `${name} field` };
      }
    }

    const actions = [
      defineAction({
        name: `${actionPrefix}_set_field`,
        description: `Set field values on the ${doctypeLabel} ${isNew ? 'form' : 'record'}. Opens edit mode if not already editing.`,
        parameters: { type: 'object', properties: fieldProps },
      }),
      defineAction({
        name: `${actionPrefix}_save`,
        description: `Save the ${doctypeLabel} ${isNew ? 'record' : 'changes'}`,
        parameters: { type: 'object', properties: {} },
      }),
    ];

    if (!isNew) {
      actions.push(
        defineAction({
          name: `${actionPrefix}_submit`,
          description: `Submit the ${doctypeLabel} record (changes status from Draft to Submitted)`,
          parameters: { type: 'object', properties: {} },
        }),
        defineAction({
          name: `${actionPrefix}_cancel`,
          description: `Cancel the ${doctypeLabel} record (changes status from Submitted to Cancelled)`,
          parameters: { type: 'object', properties: {} },
        }),
        defineAction({
          name: `${actionPrefix}_delete`,
          description: `Delete the ${doctypeLabel} record`,
          parameters: { type: 'object', properties: {} },
        }),
      );
    }

    const handlerMap: Record<string, (args: Record<string, unknown>) => void> = {
      [`${actionPrefix}_set_field`]: (args) => {
        if (!isEditing) {
          setIsEditing(true);
          const editableData: Record<string, unknown> = {};
          for (const { key, value } of scalarFields) {
            editableData[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
          }
          setEditData(editableData);
          setEditChildTables(JSON.parse(JSON.stringify(childTables)));
        }
        setEditData((prev) => ({ ...prev, ...args }));
        const filledFields = Object.keys(args);
        if (filledFields.length > 0) {
          toast.info(`AI filled: ${filledFields.join(', ')}`);
        }
      },
      [`${actionPrefix}_save`]: () => handleSave(),
    };

    if (!isNew) {
      handlerMap[`${actionPrefix}_submit`] = () => handleSubmit();
      handlerMap[`${actionPrefix}_cancel`] = () => handleCancel();
      handlerMap[`${actionPrefix}_delete`] = () => setDeleteDialogOpen(true);
    }

    registerActions(actions, handlerMap);
    return () => unregisterActions();
  }, [doctype, doctypeLabel, isNew, isEditing, scalarFields, childTables, schemaFields, recordName, registerActions, unregisterActions, handleSave, handleSubmit, handleCancel]);

  // ── Render Field ──────────────────────────────────────────────────────

  const renderField = (
    key: string,
    value: unknown,
    type: FieldType,
    editable: boolean,
    onChange?: (val: unknown) => void,
    linkTo?: string,
  ): JSX.Element => {
    const error = fieldErrors[key];

    if (editable && onChange) {
      const errorClass = error ? 'border-red-500 focus-visible:ring-red-500/50' : '';

      // FK / Link field: searchable combobox over the target doctype
      if (linkTo) {
        return (
          <>
            <LinkFieldCombobox
              linkTo={linkTo}
              value={typeof value === 'string' ? value : String(value ?? '')}
              onChange={(v) => onChange(v)}
              hasError={Boolean(error)}
            />
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </>
        );
      }

      switch (type) {
        case 'boolean':
          return (
            <div className="flex items-center gap-3 h-8">
              <Switch
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange(checked)}
              />
              <span className="text-sm text-muted-foreground">
                {value ? 'Yes' : 'No'}
              </span>
            </div>
          );
        case 'date':
          return (
            <>
              <Input
                id={key}
                type="date"
                value={typeof value === 'string' ? value.slice(0, 10) : ''}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full ${errorClass}`}
              />
              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            </>
          );
        case 'number':
          return (
            <>
              <Input
                id={key}
                type="number"
                placeholder={`Enter ${formatFieldName(key).toLowerCase()}`}
                value={value === null || value === undefined ? '' : String(value)}
                onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                className={`w-full ${errorClass}`}
              />
              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            </>
          );
        case 'textarea':
          return (
            <>
              <Textarea
                id={key}
                placeholder={`Enter ${formatFieldName(key).toLowerCase()}`}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className={`w-full ${errorClass}`}
              />
              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            </>
          );
        default:
          return (
            <>
              <Input
                id={key}
                type="text"
                placeholder={`Enter ${formatFieldName(key).toLowerCase()}`}
                value={typeof value === 'string' ? value : String(value ?? '')}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full ${errorClass}`}
              />
              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            </>
          );
      }
    }

    // Read-only display
    return (
      <div className="min-h-[32px] flex items-center">
        {type === 'boolean' ? (
          <Badge variant={value ? 'default' : 'outline'} className="text-xs">
            {value ? 'Yes' : 'No'}
          </Badge>
        ) : (
          <span className="text-sm text-gray-700">
            {formatValue(value)}
          </span>
        )}
      </div>
    );
  };

  // ── Child Table Columns ───────────────────────────────────────────────

  const getChildColumns = useCallback(
    (rows: Record<string, unknown>[]): string[] => {
      if (rows.length === 0) return [];
      const firstRow = rows[0];
      return Object.keys(firstRow).filter(
        (k) => !SYSTEM_FIELDS.has(k) && k !== 'parent' && k !== 'parenttype' && k !== 'parentfield' && k !== 'doctype',
      );
    },
    [],
  );

  // ── Render Child Table ────────────────────────────────────────────────

  const renderChildTable = (
    tableKey: string,
    rows: Record<string, unknown>[],
  ): JSX.Element => {
    const displayKey = formatFieldName(tableKey);
    const columns = getChildColumns(rows);
    const editableRows = isEditing ? editChildTables[tableKey] || [] : null;

    return (
      <Card key={tableKey}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{displayKey}</CardTitle>
              <CardDescription>
                {rows.length} row{rows.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {isEditing && editableRows && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddChildRow(tableKey)}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && (!editableRows || editableRows.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No rows
            </p>
          ) : isMobile ? (
            // Mobile: stacked cards
            <div className="space-y-3">
              {(editableRows || rows).map((row, i) => (
                <div
                  key={(row.name as string) || i}
                  className="border rounded-lg p-3 space-y-2"
                >
                  {columns.map((col) => (
                    <div key={col} className="flex justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatFieldName(col)}
                      </span>
                      {isEditing && editableRows ? (
                        <Input
                          className="h-8 text-xs flex-1 max-w-[60%]"
                          value={String(row[col] ?? '')}
                          onChange={(e) =>
                            handleChildCellChange(tableKey, i, col, e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-xs text-right">
                          {formatValue(row[col])}
                        </span>
                      )}
                    </div>
                  ))}
                  {isEditing && editableRows && (
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => handleDeleteChildRow(tableKey, i)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Desktop: table
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col}>{formatFieldName(col)}</TableHead>
                    ))}
                    {isEditing && editableRows && (
                      <TableHead className="w-[60px]" />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(editableRows || rows).map((row, i) => (
                    <TableRow key={(row.name as string) || i}>
                      <TableCell className="text-muted-foreground text-xs">
                        {i + 1}
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col}>
                          {isEditing && editableRows ? (
                            <Input
                              className="h-8 text-xs"
                              value={String(row[col] ?? '')}
                              onChange={(e) =>
                                handleChildCellChange(tableKey, i, col, e.target.value)
                              }
                            />
                          ) : (
                            <span className="text-sm">
                              {formatValue(row[col])}
                            </span>
                          )}
                        </TableCell>
                      ))}
                      {isEditing && editableRows && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => handleDeleteChildRow(tableKey, i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Render: Activity Tab ──────────────────────────────────────────────

  const renderActivityTab = (): JSX.Element => {
    const createdAt = record.creation as string | undefined;
    const modifiedAt = record.modified as string | undefined;
    const owner = record.owner as string | undefined;
    const modifiedBy = record.modified_by as string | undefined;

    const events: Array<{ label: string; value: string; sub?: string }> = [];

    if (createdAt) {
      events.push({
        label: 'Created',
        value: new Date(createdAt).toLocaleString(),
        sub: owner || undefined,
      });
    }
    if (modifiedAt && modifiedAt !== createdAt) {
      events.push({
        label: 'Last Modified',
        value: new Date(modifiedAt).toLocaleString(),
        sub: modifiedBy || undefined,
      });
    }
    if (docstatus >= 1) {
      events.push({
        label: docstatus === 1 ? 'Submitted' : 'Cancelled',
        value: docstatus === 1 ? 'Document was submitted' : 'Document was cancelled',
      });
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>Timeline of changes to this document</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity recorded
            </p>
          ) : (
            <div className="space-y-4">
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{ev.value}</p>
                    {ev.sub && (
                      <p className="text-xs text-muted-foreground">by {ev.sub}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Render: Comments Tab ──────────────────────────────────────────────

  const renderCommentsTab = (): JSX.Element => {
    const comments: Array<{ content: string; by: string; at: string }> = [];
    try {
      const raw = record._comments as string | undefined;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            comments.push({
              content: c.comment || c.content || '',
              by: c.by || c.comment_by || 'Unknown',
              at: c.creation || new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // No valid comments
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments</CardTitle>
          <CardDescription>
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add comment */}
          {docstatus !== 2 && (
            <div className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 h-10 rounded-xl border-gray-200"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentText.trim()) {
                    toast.info('Comment feature requires API support');
                    setCommentText('');
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!commentText.trim()}
                onClick={() => {
                  toast.info('Comment feature requires API support');
                  setCommentText('');
                }}
              >
                Send
              </Button>
            </div>
          )}

          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.by}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Render: Attachments Tab ───────────────────────────────────────────

  const renderAttachmentsTab = (): JSX.Element => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attachments</CardTitle>
          <CardDescription>Files attached to this document</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No attachments. File upload requires API support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Render: Top Bar ───────────────────────────────────────────────────

  const renderTopBar = (): JSX.Element => {
    return isMobile ? renderTopBarMobile() : renderTopBarDesktop();
  };

  const renderTopBarDesktop = (): JSX.Element => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold truncate">{displayTitle}</h1>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{doctype}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditCancel}
              disabled={isSaving}
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </>
        ) : (
          <>
            {/* Edit — only for draft */}
            {docstatus === 0 && (
              <Button variant="outline" size="sm" onClick={handleEditStart} className="gap-1">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}

            {/* Submit — only for draft submittable doctypes */}
            {docstatus === 0 && isSubmittable && (
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="gap-1">
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            )}

            {/* Cancel — only for submitted */}
            {docstatus === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
                className="gap-1"
              >
                <Ban className="h-3.5 w-3.5" />
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
            )}

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
                  <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyName}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Name
                </DropdownMenuItem>
                {isPrintable && !isNew && (
                  <DropdownMenuItem onClick={handlePrintPdf}>
                    <Printer className="h-4 w-4 mr-2" /> Print PDF
                  </DropdownMenuItem>
                )}
                {docstatus === 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );

  const renderTopBarMobile = (): JSX.Element => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="flex-shrink-0 h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold truncate">{recordName}</h1>
            <Badge variant={statusBadge.variant} className="text-xs flex-shrink-0">
              {statusBadge.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{doctype}</p>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditCancel}
              disabled={isSaving}
              className="gap-1 flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1 flex-shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </>
        ) : (
          <>
            {docstatus === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditStart}
                className="gap-1 flex-shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {docstatus === 0 && isSubmittable && (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-1 flex-shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? '...' : 'Submit'}
              </Button>
            )}
            {docstatus === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
                className="gap-1 flex-shrink-0"
              >
                <Ban className="h-3.5 w-3.5" />
                {isCancelling ? '...' : 'Cancel'}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 w-9 flex-shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
                  <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyName}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Name
                </DropdownMenuItem>
                {isPrintable && !isNew && (
                  <DropdownMenuItem onClick={handlePrintPdf}>
                    <Printer className="h-4 w-4 mr-2" /> Print PDF
                  </DropdownMenuItem>
                )}
                {docstatus === 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );

  // ── Render: Fields Section (Revolyzz-style dynamic form) ─────────────

  const renderFields = (): JSX.Element => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            {scalarFields.length} field{scalarFields.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scalarFields.map(({ key, value, type, required, linkTo }) => (
              <div key={key} className={type === 'textarea' ? 'md:col-span-2' : ''}>
                <div className="space-y-1">
                  <label htmlFor={key} className="block font-medium text-sm">
                    {formatFieldName(key)}
                    {required && <span className="text-red-500"> *</span>}
                  </label>
                  {renderField(
                    key,
                    isEditing ? editData[key] : value,
                    type,
                    isEditing,
                    isEditing ? (val: unknown) => handleFieldChange(key, val) : undefined,
                    linkTo,
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Render: Bottom Tabs ───────────────────────────────────────────────

  const renderBottomTabs = (): JSX.Element => {
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 bg-gray-100 rounded-xl p-1">
          <TabsTrigger
            value="activity"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 gap-1.5"
          >
            <Activity className="h-3.5 w-3.5" />
            {!isMobile && <span>Activity</span>}
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {!isMobile && <span>Comments</span>}
          </TabsTrigger>
          <TabsTrigger
            value="attachments"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 gap-1.5"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {!isMobile && <span>Attachments</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-0">
          {renderActivityTab()}
        </TabsContent>
        <TabsContent value="comments" className="mt-0">
          {renderCommentsTab()}
        </TabsContent>
        <TabsContent value="attachments" className="mt-0">
          {renderAttachmentsTab()}
        </TabsContent>
      </Tabs>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="space-y-6 p-4 sm:p-6">
      {uiActionActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-sm animate-pulse">
          <Sparkles size={14} className="animate-spin" />
          <span>AI is controlling the interface...</span>
        </div>
      )}
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-4 sm:pt-6">
        {renderTopBar()}
      </div>

      {/* Fields section */}
      {renderFields()}

      {/* Child tables */}
      {Object.keys(childTables).length > 0 && (
        <div className="space-y-4">
          {Object.entries(childTables).map(([key, rows]) =>
            renderChildTable(key, rows),
          )}
        </div>
      )}

      <Separator />

      {/* Bottom tabs (Pattern 4) */}
      {renderBottomTabs()}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {doctype}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{recordName}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
