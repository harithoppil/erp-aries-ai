'use client';

// ERPFormClient — metadata-driven Frappe-style detail/edit form.
//
// Wraps GenericDetailClient's top bar (status badge, edit/save/submit/cancel,
// delete dialog) and replaces its flat "renderFields" section with a
// Tabs/Sections/Columns/Fields layout parsed from the DocField metadata API.
// Falls back to GenericDetailClient when metadata isn't available (e.g. doctypes
// without tabDocField rows).

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Pencil, Save, X, Send, Ban, Trash2, MoreHorizontal, Copy, Printer, LucideIcon,
  CopyPlus, RotateCcw,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  updateDoctypeRecord,
  deleteDoctypeRecord,
  submitDoctypeRecord,
  cancelDoctypeRecord,
  createDoctypeRecord,
  saveChildTableRows,
  fetchLinkedRecordField,
} from '@/app/dashboard/erp/[doctype]/[name]/actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { errorMessage } from '@/lib/utils';
import { usePageContext } from '@/hooks/usePageContext';
import { useActionDispatcher, defineAction } from '@/store/useActionDispatcher';
import { useAppStore } from '@/store/useAppStore';
import { Sparkles } from 'lucide-react';

import { useDocTypeMeta } from './useDocTypeMeta';
import { ERPTabLayout } from './ERPTabLayout';
import { ERPGridClient } from './ERPGridClient';
import { useEditChildTables } from './use-edit-child-tables';
import type { DocFieldMeta, DocTypeInfo, DocTypeMeta } from '@/lib/erpnext/doctype-meta';

/**
 * Resolve a Frappe icon string (e.g. "building", "file-text") to a Lucide React
 * icon component. Returns null when no match is found.
 */
function resolveIcon(iconName: string | null): LucideIcon | null {
  if (!iconName) return null;
  // Frappe icon names may use hyphens; Lucide uses PascalCase or kebab-case.
  // Normalize: strip "fa fa-" prefix, replace hyphens, then PascalCase.
  const cleaned = iconName.replace(/^fa\s+fa-/, '').replace(/-/g, ' ');
  const pascal = cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic icon lookup
  const icon = (LucideIcons as Record<string, unknown>)[pascal];
  if (typeof icon === 'function') return icon as LucideIcon;
  return null;
}

interface ERPFormClientProps {
  doctype: string;                         // url slug, e.g. "supplier"
  record: Record<string, unknown>;
  childTables: Record<string, Record<string, unknown>[]>;
  isNew?: boolean;
  /** Server-loaded metadata — avoids a redundant client-side API fetch. */
  initialMeta?: DocTypeMeta | null;
}

function getDocStatus(record: Record<string, unknown>): number {
  return Number(record.docstatus ?? 0);
}

function statusBadge(docstatus: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (docstatus === 1) return { label: 'Submitted', variant: 'default' };
  if (docstatus === 2) return { label: 'Cancelled', variant: 'destructive' };
  return { label: 'Draft', variant: 'secondary' };
}

const PRINTABLE = new Set([
  'sales-invoice', 'purchase-invoice', 'sales-order', 'purchase-order',
  'quotation', 'delivery-note', 'purchase-receipt',
]);

export default function ERPFormClient({
  doctype,
  record: initialRecord,
  childTables,
  isNew = false,
  initialMeta,
}: ERPFormClientProps): JSX.Element {
  const router = useRouter();

  // Use server-provided metadata when available, otherwise fetch client-side.
  const clientMeta = useDocTypeMeta(doctype);
  const meta = initialMeta ?? clientMeta.meta;
  const metaLoading = initialMeta ? false : clientMeta.loading;
  const metaError = initialMeta ? null : clientMeta.error;

  const [record, setRecord] = useState<Record<string, unknown>>(initialRecord);
  const [isEditing, setIsEditing] = useState(isNew);
  const [editData, setEditData] = useState<Record<string, unknown>>(isNew ? { ...initialRecord } : {});

  // Sync record state when prop changes (client-side navigation between records)
  useEffect(() => {
    setRecord(initialRecord);
    setIsEditing(isNew);
    setEditData(isNew ? { ...initialRecord } : {});
    setFieldErrors({});
  }, [initialRecord, isNew]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Child table edit state
  const {
    editChildTables,
    setEditChildTables,
  } = useEditChildTables(childTables);

  const docstatus = getDocStatus(record);
  const badge = statusBadge(docstatus);
  const recordName = (record.name as string) || '';
  const doctypeLabel = toDisplayLabel(doctype);
  const isPrintable = PRINTABLE.has(doctype);

  // ── DocTypeInfo-derived values ──────────────────────────────────────────────
  const doctypeInfo: DocTypeInfo | null = meta?.doctype_info ?? null;
  const isSubmittable = doctypeInfo?.is_submittable ?? false;
  const isSingle = doctypeInfo?.issingle ?? false;

  /** Resolve the display title using title_field when available. */
  const displayTitle = useMemo(() => {
    if (!doctypeInfo?.title_field) return recordName;
    return (record[doctypeInfo.title_field] as string) || recordName;
  }, [doctypeInfo, record, recordName]);

  /** Resolve the doctype icon from DocTypeInfo.icon (e.g. "building"). */
  const DoctypeIcon = useMemo(() => resolveIcon(doctypeInfo?.icon ?? null), [doctypeInfo]);

  // Merge record + editData so the layout shows the in-progress edit values
  // while remaining a single source of truth.
  const displayRecord = useMemo(() => {
    if (!isEditing) return record;
    return { ...record, ...editData };
  }, [record, editData, isEditing]);

  /** Resolve thumbnail image URL when doctype has image_field and the record has a value. */
  const imageThumbnailUrl = useMemo(() => {
    const imageField = doctypeInfo?.image_field;
    if (!imageField) return null;
    const val = displayRecord[imageField];
    if (!val || typeof val !== 'string' || val.trim() === '') return null;
    return val;
  }, [doctypeInfo, displayRecord]);

  // ── AI: Page context ─────────────────────────────────────────────────────
  const uiActionActive = useAppStore((s) => s.uiActionActive);

  const contextSummary = useMemo(() => {
    const fieldSummary = meta
      ? meta.fields
          .filter((f) => !f.hidden && !f.read_only && f.fieldtype !== 'Table')
          .slice(0, 10)
          .map((f) => `${f.fieldname}: ${String(record[f.fieldname] ?? '').slice(0, 40)}`)
          .join(', ')
      : '';
    const childSummary = Object.entries(childTables)
      .map(([k, v]) => `${k}: ${v.length} rows`)
      .join(', ');
    if (isNew) {
      return `New ${doctypeLabel} form. Fields: ${meta ? meta.fields.filter((f) => !f.hidden).map((f) => f.fieldname).join(', ') || 'none' : 'unknown'}`;
    }
    return `${doctypeLabel} detail: ${recordName}. Status: ${['Draft', 'Submitted', 'Cancelled'][docstatus]}. Fields: ${fieldSummary}.${childSummary ? ` Child tables: ${childSummary}.` : ''}`;
  }, [meta, record, childTables, isNew, doctypeLabel, recordName, docstatus]);
  usePageContext(contextSummary);

  const handleEditStart = useCallback(() => {
    setEditData({ ...record });
    setEditChildTables({ ...childTables });
    setFieldErrors({});
    setIsEditing(true);
  }, [record, childTables, setEditChildTables]);

  const handleEditCancel = useCallback(() => {
    setEditData({});
    setFieldErrors({});
    setIsEditing(false);
  }, []);

  const handleFieldChange = useCallback(async (fieldname: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [fieldname]: value }));
    setFieldErrors((prev) => {
      if (!prev[fieldname]) return prev;
      const next = { ...prev };
      delete next[fieldname];
      return next;
    });

    // If this field is a Link field, check if other fields fetch_from it
    if (!meta || !value || typeof value !== 'string') return;

    // Find all fields with fetch_from that reference this field
    const fetchFields = meta.fields.filter((f) => {
      if (!f.fetch_from) return false;
      const parts = f.fetch_from.split('.');
      return parts.length === 2 && parts[0] === fieldname;
    });

    if (fetchFields.length === 0) return;

    // Determine the link doctype from the Link field's options
    const linkField = meta.fields.find((f) => f.fieldname === fieldname);
    if (!linkField?.options) return;

    const fieldsToFetch = fetchFields.map((f) => f.fetch_from!.split('.')[1]);

    try {
      const linkedData = await fetchLinkedRecordField(linkField.options, value, fieldsToFetch);
      if (linkedData) {
        setEditData((prev) => {
          const updated = { ...prev };
          for (const ff of fetchFields) {
            const sourceField = ff.fetch_from!.split('.')[1];
            if (linkedData[sourceField] !== undefined) {
              // Respect fetch_if_empty: only overwrite if target field is currently empty
              if (ff.fetch_if_empty) {
                const currentVal = updated[ff.fieldname];
                if (currentVal !== undefined && currentVal !== null && currentVal !== '') continue;
              }
              updated[ff.fieldname] = linkedData[sourceField];
            }
          }
          return updated;
        });
      }
    } catch {
      // Silently fail — fetch_from is best-effort
    }
  }, [meta]);

  const validate = useCallback((): boolean => {
    if (!meta) return true;
    const errors: Record<string, string> = {};

    // Validate parent fields
    for (const f of meta.fields) {
      if (!f.reqd || f.hidden || f.read_only) continue;
      if (f.fieldtype === 'Table') continue; // child tables validated below
      const v = (isEditing ? editData : record)[f.fieldname];
      if (v === undefined || v === null || v === '') {
        errors[f.fieldname] = `${f.label ?? f.fieldname} is required`;
      }
    }

    // Validate child table required fields
    for (const f of meta.fields) {
      if (f.fieldtype !== 'Table' || !f.reqd) continue;
      const rows = editChildTables[f.fieldname] ?? [];
      if (rows.length === 0) {
        errors[f.fieldname] = `${f.label ?? f.fieldname} requires at least one row`;
        continue;
      }
      // Check each row's required child columns
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Get child fields from grid metadata — for now check common required fields
        // by looking at what's marked reqd in the child doctype fields
        const childMeta = meta.fields.find(mf => mf.fieldname === f.fieldname);
        if (childMeta?.options) {
          // Use the grid's column metadata if available
        }
        // Basic validation: item_code is required for Sales Invoice Items
        const requiredChildFields = ['item_code', 'item_name', 'account', 'party_type', 'party'];
        for (const cf of requiredChildFields) {
          if (row[cf] === undefined || row[cf] === null || row[cf] === '') {
            // Only flag if the row has any content at all (skip completely empty rows)
            const hasContent = Object.values(row).some(
              v => typeof v === 'string' && v.trim() && !v.startsWith('new-')
            );
            if (hasContent) {
              errors[`${f.fieldname}[${i}].${cf}`] = `Row ${i + 1}: ${cf} is required`;
            }
          }
        }
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const parentErrors = Object.values(errors).filter(e => !e.includes('Row'));
      const childErrors = Object.values(errors).filter(e => e.includes('Row'));
      toast.error(
        parentErrors.length > 0
          ? `Please fix ${parentErrors.length} error(s)`
          : `${childErrors.length} child row error(s)`,
      );
      return false;
    }
    return true;
  }, [meta, isEditing, editData, record, editChildTables]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      // Drop child arrays from the scalar payload — the orchestrator handles
      // children separately via dedicated grid components.
      // Also exclude is_virtual fields — they are computed, not stored.
      const virtualFieldNames = new Set(
        meta ? meta.fields.filter((f) => f.is_virtual).map((f) => f.fieldname) : [],
      );
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editData)) {
        if (k === 'creation' || k === 'modified') continue;
        if (Array.isArray(v)) continue;
        if (virtualFieldNames.has(k)) continue;
        payload[k] = v;
      }
      if (isNew) {
        const result = await createDoctypeRecord(doctype, payload);
        if (result.success) {
          const name = (result.data as Record<string, unknown>).name as string | undefined;
          // Save child tables for the new record
          const childFieldNames = Object.keys(editChildTables).filter(
            (fn) => editChildTables[fn].length > 0,
          );
          if (childFieldNames.length > 0 && name) {
            const childResults = await Promise.all(
              childFieldNames.map((fn) =>
                saveChildTableRows(doctype, name, fn, editChildTables[fn]),
              ),
            );
            const failed = childResults.find((r) => !r.success);
            if (failed && !failed.success) {
              toast.error(`Record created, but child table failed: ${failed.error}`);
              if (name) router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(name)}`);
              setIsSaving(false);
              return;
            }
          }
          toast.success(`${doctypeLabel} created`);
          if (name) router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(name)}`);
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await updateDoctypeRecord(doctype, recordName, payload);
        if (result.success) {
          // Save child tables in parallel
          const childFieldNames = Object.keys(editChildTables);
          if (childFieldNames.length > 0) {
            toast.info(`Saving ${childFieldNames.length} child table(s)...`);
            const childResults = await Promise.all(
              childFieldNames.map((fn) =>
                saveChildTableRows(doctype, recordName, fn, editChildTables[fn]),
              ),
            );
            const failed = childResults.find((r) => !r.success);
            if (failed && !failed.success) {
              toast.error(`Parent saved, but child table failed: ${failed.error}`);
              // Don't exit edit mode — let user retry
              setIsSaving(false);
              return;
            }
          }
          toast.success(`${doctypeLabel} updated`);
          setRecord((prev) => ({ ...prev, ...payload, ...(result.data as Record<string, unknown>) }));
          router.refresh();
          setIsEditing(false);
        } else {
          toast.error(result.error);
        }
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [validate, editData, isNew, doctype, doctypeLabel, recordName, router, meta, editChildTables]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const r = await submitDoctypeRecord(doctype, recordName);
      if (r.success) {
        toast.success(`${doctypeLabel} submitted`);
        setRecord((prev) => prev ? { ...prev, docstatus: 1 } : prev);
        setIsEditing(false);
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setIsSubmitting(false);
    }
  }, [doctype, doctypeLabel, recordName, router]);

  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      const r = await cancelDoctypeRecord(doctype, recordName);
      if (r.success) {
        toast.success(`${doctypeLabel} cancelled`);
        setRecord((prev) => prev ? { ...prev, docstatus: 2 } : prev);
        setIsEditing(false);
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setIsCancelling(false);
    }
  }, [doctype, doctypeLabel, recordName, router]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const r = await deleteDoctypeRecord(doctype, recordName);
      if (r.success) {
        toast.success(`${doctypeLabel} deleted`);
        router.push(`/dashboard/erp/${doctype}`);
      } else toast.error(r.error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [doctype, doctypeLabel, recordName, router]);

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(recordName);
    toast.success('Name copied');
  }, [recordName]);

  const handlePrintPdf = useCallback(() => {
    if (!recordName) return;
    window.open(
      `/api/erp-pdf/${encodeURIComponent(doctype)}/${encodeURIComponent(recordName)}`,
      '_blank', 'noopener',
    );
  }, [doctype, recordName]);

  // ── AI: Action registration (must be after all handlers) ───────────────
  const registerActions = useActionDispatcher((s) => s.registerActions);
  const unregisterActions = useActionDispatcher((s) => s.unregisterActions);
  useEffect(() => {
    const actionPrefix = doctype.replace(/[-_]/g, '_');

    // Build field parameter schema from DocFieldMeta (not Prisma DMMF).
    // Only include editable, non-hidden, non-virtual, non-table fields.
    const fieldProps: Record<string, { type: string; description: string }> = {};
    if (meta) {
      for (const f of meta.fields) {
        if (f.hidden || f.read_only || f.is_virtual) continue;
        if (f.fieldtype === 'Table' || f.fieldtype === 'Table MultiSelect') continue;
        if (f.fieldname === 'name') continue;
        fieldProps[f.fieldname] = {
          type: 'string',
          description: f.label ?? f.fieldname,
        };
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
          // Enter edit mode with current record values
          const editableData: Record<string, unknown> = {};
          if (meta) {
            for (const f of meta.fields) {
              if (f.hidden || f.read_only || f.is_virtual) continue;
              if (f.fieldtype === 'Table' || f.fieldtype === 'Table MultiSelect') continue;
              const val = record[f.fieldname];
              editableData[f.fieldname] = val instanceof Date ? val.toISOString().slice(0, 10) : val;
            }
          } else {
            Object.assign(editableData, record);
          }
          setEditData(editableData);
          setFieldErrors({});
          setIsEditing(true);
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
  }, [doctype, doctypeLabel, isNew, isEditing, meta, record, childTables, recordName, registerActions, unregisterActions, handleSave, handleSubmit, handleCancel]);

  // Child-table renderer — uses ERPGridClient for inline editing.
  const renderTable = useCallback((field: DocFieldMeta) => {
    const rows = (isEditing ? editChildTables : childTables)[field.fieldname] ?? [];
    const onRowsChange = (next: Record<string, unknown>[]) =>
      setEditChildTables((prev) => ({ ...prev, [field.fieldname]: next }));
    return (
      <ERPGridClient
        parentDoctype={doctype}
        parentName={recordName || null}
        childDoctype={field.options ?? ''}
        fieldname={field.fieldname}
        rows={rows}
        editable={isEditing}
        reqd={field.reqd}
        label={field.label}
        onRowsChange={onRowsChange}
      />
    );
  }, [doctype, recordName, isEditing, childTables, editChildTables, setEditChildTables]);

  // ── Top bar ──────────────────────────────────────────────────────────────
  const topBar = (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            {imageThumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageThumbnailUrl}
                alt=""
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <h1 className="text-lg font-semibold">
              {DoctypeIcon && <DoctypeIcon className="mr-1 inline h-4 w-4" />}
              {doctypeLabel}{!isNew && !isSingle && <span className="text-muted-foreground"> / {displayTitle}</span>}
            </h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{doctype}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={isSaving}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-1 h-4 w-4" /> {isSaving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </Button>
          </>
        ) : (
          <>
            {docstatus === 0 && (
              <Button variant="outline" size="sm" onClick={handleEditStart}>
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </Button>
            )}
            {docstatus === 0 && isSubmittable && (
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="mr-1 h-4 w-4" /> {isSubmitting ? 'Submitting…' : 'Submit'}
              </Button>
            )}
            {docstatus === 1 && isSubmittable && (
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isCancelling}>
                <Ban className="mr-1 h-4 w-4" /> {isCancelling ? 'Cancelling…' : 'Cancel'}
              </Button>
            )}
            {docstatus === 2 && isSubmittable && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/erp/${doctype}/new?amend=${recordName}`)}>
                <RotateCcw className="mr-1 h-4 w-4" /> Amend
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyName}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Name
                </DropdownMenuItem>
                {!isNew && (
                  <DropdownMenuItem onClick={() => router.push(`/dashboard/erp/${doctype}/new?source=${recordName}`)}>
                    <CopyPlus className="mr-2 h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                )}
                {isPrintable && !isNew && (
                  <DropdownMenuItem onClick={handlePrintPdf}>
                    <Printer className="mr-2 h-4 w-4" /> Print PDF
                  </DropdownMenuItem>
                )}
                {docstatus === 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {uiActionActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-sm animate-pulse">
          <Sparkles size={14} className="animate-spin" />
          <span>AI is controlling the interface...</span>
        </div>
      )}
      {topBar}

      {metaLoading && (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">Loading layout…</div>
      )}
      {metaError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Could not load DocField metadata for <b>{doctypeLabel}</b>. Falling back to a flat field list.
          <pre className="mt-2 text-xs">{metaError}</pre>
        </div>
      )}
      {meta && (
        <ERPTabLayout
          tree={meta.layout_tree}
          record={displayRecord}
          editable={isEditing}
          errors={fieldErrors}
          onFieldChange={handleFieldChange}
          renderTable={renderTable}
          isNew={isNew}
          docstatus={docstatus}
          isSubmittable={isSubmittable}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {doctypeLabel}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{displayTitle}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Keep
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isNew && String(record.creation || '') && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t pt-3">
          {record.owner ? (
            <span>Created by <b className="text-foreground">{String(record.owner)}</b></span>
          ) : null}
          {record.creation ? (
            <span>on {new Date(String(record.creation)).toLocaleString()}</span>
          ) : null}
          {record.modified_by && String(record.modified_by) !== String(record.owner ?? '') ? (
            <span>| Modified by <b className="text-foreground">{String(record.modified_by)}</b></span>
          ) : null}
          {record.modified ? (
            <span>on {new Date(String(record.modified)).toLocaleString()}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
