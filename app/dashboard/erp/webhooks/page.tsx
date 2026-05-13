'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  listWebhookLogs,
  clearWebhookLogs,
  WEBHOOK_EVENTS,
  type WebhookEntryInfo,
  type WebhookLogInfo,
  type WebhookEvent,
  type CreateWebhookInput,
} from '@/app/dashboard/erp/webhooks/actions';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatDatetime } from '@/lib/erpnext/locale';

function NewWebhookDialog({ onCreated }: { onCreated: () => void }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [doctype, setDoctype] = useState('Customer');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(['after_insert']);
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');

  const handleSubmit = () => {
    if (!name || !doctype || selectedEvents.length === 0 || !url) {
      toast.error('Fill in all required fields');
      return;
    }
    startTransition(async () => {
      const input: CreateWebhookInput = {
        webhookName: name,
        referenceDoctype: doctype,
        events: selectedEvents,
        requestUrl: url,
        requestMethod: method,
        headers: headers ? JSON.parse(headers) : null,
        bodyTemplate: bodyTemplate || null,
      };
      const result = await createWebhook(input);
      if (result.success) {
        toast.success(`Webhook "${name}" created`);
        setOpen(false);
        setName('');
        setUrl('');
        setHeaders('');
        setBodyTemplate('');
        setSelectedEvents(['after_insert']);
        onCreated();
      } else {
        toast.error(result.error || 'Failed to create webhook');
      }
    });
  };

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className={isDesktop ? 'max-w-lg' : 'max-w-[95vw]'}>
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Configure an outgoing webhook that fires when DocType events occur.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Webhook Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Notify Slack on new Invoice" />
          </div>

          <div>
            <label className="text-sm font-medium">DocType *</label>
            <Input value={doctype} onChange={(e) => setDoctype(e.target.value)} placeholder="e.g. Sales Invoice" />
          </div>

          <div>
            <label className="text-sm font-medium">Events *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {WEBHOOK_EVENTS.map((ev) => (
                <Badge
                  key={ev.value}
                  variant={selectedEvents.includes(ev.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleEvent(ev.value)}
                >
                  {ev.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/..." />
            </div>
            <div>
              <label className="text-sm font-medium">Method</label>
              <Select value={method} onValueChange={(v) => { if (v !== null) setMethod(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Headers (JSON)</label>
            <Textarea value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder='{"Authorization": "Bearer ..."}' rows={2} />
          </div>

          <div>
            <label className="text-sm font-medium">Body Template (JSON with {'{{doctype}}, {{name}}, {{event}}, {{field}} placeholders'})</label>
            <Textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={3} />
          </div>

          <Button onClick={handleSubmit} disabled={pending} className="w-full">
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create Webhook'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WebhooksPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [webhooks, setWebhooks] = useState<WebhookEntryInfo[]>([]);
  const [logs, setLogs] = useState<WebhookLogInfo[]>([]);
  const [pending, startTransition] = useTransition();
  const [showLogs, setShowLogs] = useState(false);

  const loadData = () => {
    startTransition(async () => {
      const [whResult, logResult] = await Promise.all([
        listWebhooks(),
        listWebhookLogs(50),
      ]);
      if (whResult.success && whResult.webhooks) setWebhooks(whResult.webhooks);
      if (logResult.success && logResult.logs) setLogs(logResult.logs);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = (id: string) => {
    startTransition(async () => {
      const result = await toggleWebhook(id);
      if (result.success) {
        toast.success('Webhook toggled');
        loadData();
      } else {
        toast.error(result.error || 'Failed to toggle');
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete webhook "${name}"? This also deletes its logs.`)) return;
    startTransition(async () => {
      const result = await deleteWebhook(id);
      if (result.success) {
        toast.success('Webhook deleted');
        loadData();
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    });
  };

  const handleClearLogs = () => {
    if (!confirm('Clear all webhook logs?')) return;
    startTransition(async () => {
      const result = await clearWebhookLogs();
      if (result.success) {
        toast.success('Logs cleared');
        loadData();
      } else {
        toast.error(result.error || 'Failed to clear logs');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure outgoing webhooks triggered by DocType events.
          </p>
        </div>
        <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} gap-2`}>
          <Button variant="outline" onClick={() => setShowLogs(!showLogs)}>
            <FileText className="mr-2 h-4 w-4" />
            {showLogs ? 'Webhooks' : 'Logs'}
          </Button>
          <NewWebhookDialog onCreated={loadData} />
        </div>
      </div>

      {!showLogs ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Webhooks</CardTitle>
            <CardDescription>
              {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {webhooks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Webhook className="mx-auto mb-2 h-8 w-8" />
                <p>No webhooks yet. Click "Add Webhook" to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>DocType</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((wh) => (
                      <TableRow key={wh.id}>
                        <TableCell className="font-medium">{wh.webhookName}</TableCell>
                        <TableCell>{wh.referenceDoctype}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {wh.events.slice(0, 3).map((ev) => (
                              <Badge key={ev} variant="secondary" className="text-xs">
                                {ev.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                            {wh.events.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{wh.events.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-xs font-mono">
                          {wh.requestUrl}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={wh.enabled ? 'default' : 'outline'}
                            className={wh.enabled ? 'bg-green-100 text-green-900 hover:bg-green-100' : ''}
                          >
                            {wh.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} justify-end gap-1`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggle(wh.id)}
                              title={wh.enabled ? 'Disable' : 'Enable'}
                            >
                              {wh.enabled ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(wh.id, wh.webhookName)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Webhook Logs</CardTitle>
                <CardDescription>{logs.length} recent log entries</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearLogs}>
                <Trash2 className="mr-2 h-3 w-3" />
                Clear Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Clock className="mx-auto mb-2 h-8 w-8" />
                <p>No webhook logs yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead>DocType / Record</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {formatDatetime(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {log.webhookName}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.referenceDoctype} / {log.referenceName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {log.event.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge className="bg-green-100 text-green-900 hover:bg-green-100 text-xs">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> {log.responseStatus}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="mr-1 h-3 w-3" /> {log.responseStatus ?? 'Error'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-xs text-red-600">
                          {log.error || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
