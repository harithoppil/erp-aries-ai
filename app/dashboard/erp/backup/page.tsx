'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Download,
  Trash2,
  Upload,
  HardDrive,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
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
import {
  createBackup,
  listBackups,
  deleteBackup,
  restoreBackup,
  type BackupInfo,
} from '@/app/dashboard/erp/backup/actions';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatDatetime } from '@/lib/erpnext/locale';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [pending, startTransition] = useTransition();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadBackups = () => {
    startTransition(async () => {
      const list = await listBackups();
      setBackups(list);
    });
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = () => {
    startTransition(async () => {
      const result = await createBackup();
      if (result.success && result.backup) {
        toast.success(`Backup created: ${result.backup.filename}`);
        loadBackups();
      } else {
        toast.error(result.error || 'Failed to create backup');
      }
    });
  };

  const handleDelete = (filename: string) => {
    if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    setDeleting(filename);
    startTransition(async () => {
      const result = await deleteBackup(filename);
      if (result.success) {
        toast.success('Backup deleted');
        loadBackups();
      } else {
        toast.error(result.error || 'Failed to delete backup');
      }
      setDeleting(null);
    });
  };

  const handleRestore = (filename: string) => {
    if (!confirm(`Restore from "${filename}"? This will overwrite current data. Make sure you have a recent backup first.`)) return;
    setRestoring(filename);
    startTransition(async () => {
      const result = await restoreBackup(filename);
      if (result.success) {
        toast.success(result.message || 'Restore completed');
      } else {
        toast.error(result.error || 'Restore failed');
      }
      setRestoring(null);
    });
  };

  const handleDownload = async (filename: string) => {
    try {
      const resp = await fetch(`/api/erp/backup/download?file=${encodeURIComponent(filename)}`);
      if (!resp.ok) {
        toast.error('Failed to download backup');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download backup');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database Backup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, download, and restore PostgreSQL database backups.
          </p>
        </div>
        <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} gap-2`}>
          <Button variant="outline" onClick={loadBackups} disabled={pending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleCreateBackup} disabled={pending}>
            {pending && backups.length === 0 ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <HardDrive className="mr-2 h-4 w-4" />
                Create Backup
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Backups are full SQL dumps of the PostgreSQL database.</p>
          <p>Restore will overwrite existing data — always create a backup first.</p>
          <p>Backup files are stored on the server at <code className="bg-muted px-1 py-0.5 rounded text-xs">./backups/</code></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Backups</CardTitle>
          <CardDescription>
            {backups.length} backup{backups.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <HardDrive className="mx-auto mb-2 h-8 w-8" />
              <p>No backups yet. Click "Create Backup" to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">
                        {b.filename}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDatetime(b.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFileSize(b.size)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={b.status === 'completed' ? 'default' : 'destructive'}
                          className={b.status === 'completed' ? 'bg-green-100 text-green-900 hover:bg-green-100' : ''}
                        >
                          {b.status === 'completed' ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" /> Complete</>
                          ) : b.status === 'in_progress' ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running</>
                          ) : (
                            <><AlertTriangle className="mr-1 h-3 w-3" /> Failed</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} justify-end gap-1`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(b.filename)}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(b.filename)}
                            disabled={restoring === b.filename}
                            title="Restore"
                          >
                            {restoring === b.filename ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(b.filename)}
                            disabled={deleting === b.filename}
                            title="Delete"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deleting === b.filename ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
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
    </div>
  );
}
