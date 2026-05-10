'use client';

import { useState, useTransition } from 'react';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  importDoctypeFile,
  getImportTemplate,
  type ImportDoctype,
  type ImportResult,
} from './actions';

const DOCTYPE_OPTIONS: { value: ImportDoctype; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'item', label: 'Item' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'account', label: 'Account (Chart of Accounts)' },
];

export default function ImportPage() {
  const [doctype, setDoctype] = useState<ImportDoctype>('customer');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDownloadTemplate = async () => {
    try {
      const { filename, csv } = await getImportTemplate(doctype);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate template');
    }
  };

  const handleImport = () => {
    if (!file) {
      toast.error('Choose a file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    startTransition(async () => {
      const r = await importDoctypeFile(doctype, formData);
      setResult(r);
      if (r.inserted > 0) {
        toast.success(
          `Imported ${r.inserted} ${r.doctype}${r.inserted === 1 ? '' : 's'}` +
            (r.failed > 0 ? ` (${r.failed} failed)` : ''),
        );
      } else {
        toast.error(r.message || `No rows imported (${r.failed} failed)`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import master data from CSV or Excel. Customer, Item, Supplier, and Chart of Accounts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pick a doctype</CardTitle>
          <CardDescription>
            Each doctype has a different set of required columns. Download the
            template first if you're not sure what to include.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={doctype} onValueChange={(v) => setDoctype(v as ImportDoctype)}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCTYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Upload your file</CardTitle>
          <CardDescription>
            Accepts .csv and .xlsx. The first row must contain column headers.
            Rows that fail validation are skipped — successful rows commit in
            a single transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 hover:border-muted-foreground/60"
            htmlFor="import-file"
          >
            <FileSpreadsheet className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              {file ? file.name : 'Click to choose a CSV or Excel file'}
            </span>
            {file && (
              <span className="mt-1 text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
            <input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                setResult(null);
              }}
            />
          </label>

          <Button onClick={handleImport} disabled={!file || pending} className="w-full">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {DOCTYPE_OPTIONS.find((o) => o.value === doctype)?.label}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {result.inserted > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{result.total} rows in file</Badge>
              <Badge className="bg-green-100 text-green-900 hover:bg-green-100">
                {result.inserted} inserted
              </Badge>
              {result.failed > 0 && (
                <Badge className="bg-red-100 text-red-900 hover:bg-red-100">
                  {result.failed} failed
                </Badge>
              )}
            </div>

            {result.message && (
              <p className="text-sm text-muted-foreground">{result.message}</p>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-xs font-semibold text-red-900">
                  Failed rows ({result.errors.length}):
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-red-900">
                  {result.errors.slice(0, 100).map((e, i) => (
                    <li key={i} className="font-mono">
                      Row {e.rowIndex}: {e.message}
                    </li>
                  ))}
                  {result.errors.length > 100 && (
                    <li className="italic">
                      ...and {result.errors.length - 100} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
