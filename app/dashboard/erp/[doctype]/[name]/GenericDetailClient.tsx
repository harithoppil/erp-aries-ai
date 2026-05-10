'use client';

// ── Generic Detail Client ─────────────────────────────────────────────────────
// Renders detail/edit view for ANY ERPNext doctype.
// Pattern 1: Mobile/Desktop split via useMediaQuery.
// Pattern 2: Skeleton loading.
// Pattern 4: Settings-style tabs at bottom.

import { useState, useMemo, useCallback, type JSX } from 'react';
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
} from 'lucide-react';

// Actions
import {
  updateDoctypeRecord,
  deleteDoctypeRecord,
  submitDoctypeRecord,
  cancelDoctypeRecord,
} from './actions';
import { toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenericDetailClientProps {
  doctype: string;
  record: Record<string, unknown>;
  childTables: Record<string, Record<string, unknown>[]>;
}

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

function detectFieldType(key: string, value: unknown): FieldType {
  if (isDateLike(value)) return 'date';
  if (isBooleanLike(value)) return 'boolean';
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value !== '')) {
    // If key contains common amount/qty/rate patterns, treat as number
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
}: GenericDetailClientProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // ── State ─────────────────────────────────────────────────────────────
  const [record, setRecord] = useState<Record<string, unknown>>(initialRecord);
  const [childTables, setChildTables] = useState<Record<string, Record<string, unknown>[]>>(initialChildTables);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [editChildTables, setEditChildTables] = useState<Record<string, Record<string, unknown>[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [commentText, setCommentText] = useState('');

  const docstatus = getDocStatus(record);
  const statusBadge = getStatusBadge(docstatus);
  const recordName = (record.name as string) || '';
  const displayTitle = `${toDisplayLabel(doctype)} / ${recordName}`;

  // ── Scalar fields ─────────────────────────────────────────────────────
  const scalarFields = useMemo(() => {
    const fields: Array<{ key: string; value: unknown; type: FieldType }> = [];
    for (const [key, value] of Object.entries(record)) {
      if (SYSTEM_FIELDS.has(key)) continue;
      if (Array.isArray(value)) continue;
      if (value !== null && value !== undefined && typeof value === 'object' && !(value instanceof Date)) continue;
      const type = detectFieldType(key, value);
      fields.push({ key, value, type });
    }
    return fields;
  }, [record]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleEditStart = useCallback(() => {
    const editableData: Record<string, unknown> = {};
    for (const { key, value } of scalarFields) {
      editableData[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
    }
    setEditData(editableData);
    setEditChildTables(JSON.parse(JSON.stringify(childTables)));
    setIsEditing(true);
  }, [scalarFields, childTables]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditData({});
    setEditChildTables({});
  }, []);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
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

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Build the payload — only changed scalar fields + child tables
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editData)) {
        payload[key] = value;
      }
      // Include child tables in the payload
      for (const [tableKey, rows] of Object.entries(editChildTables)) {
        payload[tableKey] = rows.map((row, i) => ({
          ...row,
          idx: i + 1,
        }));
      }

      const result = await updateDoctypeRecord(doctype, recordName, payload);
      if (result.success) {
        toast.success(`${doctype} updated successfully`);
        // Re-fetch by reloading
        router.refresh();
        setIsEditing(false);
      } else {
        toast.error(!result.success ? result.error : 'Failed to update record');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [editData, editChildTables, doctype, recordName, router]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await submitDoctypeRecord(doctype, recordName);
      if (result.success) {
        toast.success(`${doctype} submitted successfully`);
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

  // ── Render Field ──────────────────────────────────────────────────────

  const renderField = (
    key: string,
    value: unknown,
    type: FieldType,
    editable: boolean,
    onChange?: (val: unknown) => void,
  ): JSX.Element => {
    if (editable && onChange) {
      switch (type) {
        case 'boolean':
          return (
            <div className="flex items-center gap-2">
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
            <Input
              type="date"
              value={typeof value === 'string' ? value.slice(0, 10) : ''}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 rounded-xl border-gray-200"
            />
          );
        case 'number':
          return (
            <Input
              type="number"
              value={value === null || value === undefined ? '' : String(value)}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              className="h-10 rounded-xl border-gray-200"
            />
          );
        case 'textarea':
          return (
            <Textarea
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              className="rounded-xl border-gray-200"
            />
          );
        default:
          return (
            <Input
              type="text"
              value={typeof value === 'string' ? value : String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 rounded-xl border-gray-200"
            />
          );
      }
    }

    // Read-only display
    return (
      <div className="min-h-[40px] flex items-center">
        <span className="text-sm">
          {type === 'boolean' ? (
            <Badge variant={value ? 'default' : 'outline'} className="text-xs">
              {value ? 'Yes' : 'No'}
            </Badge>
          ) : (
            formatValue(value)
          )}
        </span>
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

            {/* Submit — only for draft */}
            {docstatus === 0 && (
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
            {docstatus === 0 && (
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

  // ── Render: Fields Section ────────────────────────────────────────────

  const renderFields = (): JSX.Element => {
    const gridCols = isMobile
      ? 'grid-cols-1'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            {scalarFields.length} field{scalarFields.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid ${gridCols} gap-4`}>
            {scalarFields.map(({ key, value, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {formatFieldName(key)}
                </Label>
                {renderField(
                  key,
                  isEditing ? editData[key] : value,
                  type,
                  isEditing,
                  isEditing ? (val: unknown) => handleFieldChange(key, val) : undefined,
                )}
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
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Comments</span>
          </TabsTrigger>
          <TabsTrigger
            value="attachments"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 gap-1.5"
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Attachments</span>
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
    <div className="space-y-6 p-4 sm:p-6">
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
  );
}
