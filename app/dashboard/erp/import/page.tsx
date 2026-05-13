'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Eye,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  importDoctypeFile,
  getImportTemplate,
  previewImport,
  listImportableDocTypes,
  type ImportableDocType,
  type ImportResult,
  type PreviewResult,
} from '@/app/dashboard/erp/import/actions';
import { useMediaQuery } from '@/hooks/use-media-query';

type Step = 'select' | 'upload' | 'preview' | 'result';

export default function ImportPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [doctypes, setDoctypes] = useState<ImportableDocType[]>([]);
  const [selectedDoctype, setSelectedDoctype] = useState('');
  const [doctypeMeta, setDoctypeMeta] = useState<ImportableDocType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingDoctypes, setLoadingDoctypes] = useState(true);

  // Load DocType list on mount
  useEffect(() => {
    listImportableDocTypes()
      .then((list) => {
        setDoctypes(list);
        if (list.length > 0) {
          setSelectedDoctype(list[0].name);
        }
      })
      .catch(() => toast.error('Failed to load DocTypes'))
      .finally(() => setLoadingDoctypes(false));
  }, []);

  // Update meta when selection changes
  useEffect(() => {
    setDoctypeMeta(doctypes.find((d) => d.name === selectedDoctype) ?? null);
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep('select');
  }, [selectedDoctype, doctypes]);

  const handleDownloadTemplate = async () => {
    try {
      const { filename, csv } = await getImportTemplate(selectedDoctype);
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

  const handlePreview = () => {
    if (!file) {
      toast.error('Choose a file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    startTransition(async () => {
      const p = await previewImport(selectedDoctype, formData);
      setPreview(p);
      setStep('preview');
      if (p.total === 0) {
        toast.error('No rows found in file');
      } else if (p.failed > 0 && p.valid === 0) {
        toast.error(`All ${p.total} rows have validation errors`);
      } else if (p.failed > 0) {
        toast.warning(`${p.valid} valid, ${p.failed} rows with errors`);
      } else {
        toast.success(`${p.valid} rows ready to import`);
      }
    });
  };

  const handleImport = () => {
    if (!file) {
      toast.error('Choose a file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    startTransition(async () => {
      const r = await importDoctypeFile(selectedDoctype, formData);
      setResult(r);
      setStep('result');
      if (r.inserted > 0) {
        toast.success(
          `Imported ${r.inserted} ${selectedDoctype}${r.inserted === 1 ? '' : 's'}` +
            (r.failed > 0 ? ` (${r.failed} failed)` : ''),
        );
      } else {
        toast.error(r.message || `No rows imported (${r.failed} failed)`);
      }
    });
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep('select');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import master data from CSV or Excel. Supports any DocType — field
          requirements are auto-discovered from the schema.
        </p>
      </div>

      {/* Step 1: Pick DocType */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pick a DocType</CardTitle>
          <CardDescription>
            Each DocType has different required columns. Download the template
            first if you&apos;re not sure what to include.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex ${isDesktop ? 'flex-row items-center' : 'flex-col'} gap-3`}>
            <Select value={selectedDoctype} onValueChange={(v) => { if (v !== null) setSelectedDoctype(v); }}>
              <SelectTrigger className={isDesktop ? 'w-72' : 'w-full'}>
                <SelectValue placeholder={loadingDoctypes ? 'Loading...' : 'Select DocType'} />
              </SelectTrigger>
              <SelectContent>
                {doctypes.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    {d.label}
                    {d.category === 'enhanced' && ' ✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              disabled={!selectedDoctype}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
          </div>

          {/* Show required/optional fields for selected DocType */}
          {doctypeMeta && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Required fields:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {doctypeMeta.requiredFields.map((f) => (
                  <Badge key={f.fieldname} variant="secondary" className="text-xs">
                    {f.label}
                    <span className="ml-1 text-muted-foreground">({f.type})</span>
                  </Badge>
                ))}
                {doctypeMeta.requiredFields.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No required fields without defaults
                  </span>
                )}
              </div>
              {doctypeMeta.optionalFields.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    Optional fields:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {doctypeMeta.optionalFields.slice(0, 20).map((f) => (
                      <Badge key={f.fieldname} variant="outline" className="text-xs">
                        {f.label}
                      </Badge>
                    ))}
                    {doctypeMeta.optionalFields.length > 20 && (
                      <Badge variant="outline" className="text-xs">
                        +{doctypeMeta.optionalFields.length - 20} more
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Upload file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Upload your file</CardTitle>
          <CardDescription>
            Accepts .csv and .xlsx. The first row must contain column headers
            matching the field names above.
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
                setPreview(null);
                setResult(null);
                setStep(f ? 'upload' : 'select');
              }}
            />
          </label>

          <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} gap-3`}>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!file || !selectedDoctype || pending}
              className={isDesktop ? '' : 'w-full'}
            >
              {pending && step !== 'result' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview & Validate
                </>
              )}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || !selectedDoctype || pending}
              className={isDesktop ? '' : 'w-full'}
            >
              {pending && step === 'result' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {doctypeMeta?.label || selectedDoctype}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Preview */}
      {preview && step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-5 w-5 text-blue-600" />
              Preview
            </CardTitle>
            <CardDescription>
              Review validation results before importing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{preview.total} rows in file</Badge>
              <Badge className="bg-green-100 text-green-900 hover:bg-green-100">
                {preview.valid} valid
              </Badge>
              {preview.failed > 0 && (
                <Badge className="bg-red-100 text-red-900 hover:bg-red-100">
                  {preview.failed} failed
                </Badge>
              )}
            </div>

            {/* Preview data table */}
            {preview.previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {preview.requiredFields.map((f) => (
                        <TableHead key={f} className="font-semibold">
                          {f}*
                        </TableHead>
                      ))}
                      {preview.optionalFields.slice(0, 5).map((f) => (
                        <TableHead key={f}>{f}</TableHead>
                      ))}
                      {preview.optionalFields.length > 5 && (
                        <TableHead>+{preview.optionalFields.length - 5}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.previewRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {preview.requiredFields.map((f) => (
                          <TableCell key={f} className="font-medium">
                            {String(row[f] ?? '')}
                          </TableCell>
                        ))}
                        {preview.optionalFields.slice(0, 5).map((f) => (
                          <TableCell key={f} className="text-muted-foreground">
                            {String(row[f] ?? '')}
                          </TableCell>
                        ))}
                        {preview.optionalFields.length > 5 && (
                          <TableCell className="text-muted-foreground">…</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.valid > 20 && (
                  <p className="p-2 text-xs text-muted-foreground text-center">
                    Showing 20 of {preview.valid} valid rows
                  </p>
                )}
              </div>
            )}

            {/* Validation errors */}
            {preview.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-xs font-semibold text-red-900">
                  Validation errors ({preview.errors.length}):
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-red-900">
                  {preview.errors.slice(0, 50).map((e, i) => (
                    <li key={i} className="font-mono">
                      Row {e.rowIndex}: {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 50 && (
                    <li className="italic">
                      ...and {preview.errors.length - 50} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className={`flex ${isDesktop ? 'flex-row' : 'flex-col'} gap-3`}>
              <Button
                onClick={handleImport}
                disabled={preview.valid === 0 || pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import {preview.valid} {doctypeMeta?.label || selectedDoctype}{preview.valid !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {result && step === 'result' && (
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

            <Button variant="outline" onClick={handleReset}>
              Import Another
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
