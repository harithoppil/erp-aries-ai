'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { Printer, X, Loader2, FileText } from 'lucide-react';
import {
  fetchPrintFormats,
  fetchPrintFormatData,
  renderJinjaTemplate,
  type PrintFormatOption,
  type FetchPrintFormatsResult,
  type FetchPrintFormatResult,
} from '@/app/dashboard/erp/print-format-actions';

interface ERPPrintPreviewProps {
  doctype: string;
  recordName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PrintPreviewSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-[600px] w-full rounded-lg" />
    </div>
  );
}

export function ERPPrintPreview({
  doctype,
  recordName,
  open,
  onOpenChange,
}: ERPPrintPreviewProps): JSX.Element {
  const [formats, setFormats] = useState<PrintFormatOption[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Load available print formats when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingFormats(true);
    fetchPrintFormats(doctype).then((result: FetchPrintFormatsResult) => {
      if (cancelled) return;
      if (result.success) {
        setFormats(result.formats);
        // Auto-select first format
        if (result.formats.length > 0) {
          setSelectedFormat(result.formats[0].name);
        }
      }
      setLoadingFormats(false);
    });
    return () => { cancelled = true; };
  }, [doctype, open]);

  // Render selected format
  useEffect(() => {
    if (!open || !selectedFormat) return;
    let cancelled = false;
    setLoading(true);
    fetchPrintFormatData(doctype, recordName, selectedFormat).then((result: FetchPrintFormatResult) => {
      if (cancelled) return;
      if (result.success) {
        const template = result.data.format.html;
        if (template) {
          const html = renderJinjaTemplate(template, result.data.record, result.data.childTables);
          setRenderedHtml(html);
        } else if (result.data.format.format_data) {
          // format_data-based layout (standard format builder)
          setRenderedHtml(renderStandardFormat(result.data.format.format_data, result.data.record));
        } else {
          setRenderedHtml('<p>No template available for this print format.</p>');
        }
      } else {
        toast.error(result.error);
        setRenderedHtml(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [doctype, recordName, selectedFormat, open]);

  const handlePrint = useCallback(() => {
    if (!renderedHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print - ${doctype} - ${recordName}</title>
          <style>
            body { font-family: "Inter", -apple-system, sans-serif; margin: 20px; color: #171717; font-size: 14px; }
            table { border-collapse: collapse; width: 100%; }
            td, th { padding: 6px 8px; }
            .page-break { page-break-after: always; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${renderedHtml}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [renderedHtml, doctype, recordName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? 'max-w-full' : 'max-w-4xl'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Preview
          </DialogTitle>
          <DialogDescription>
            {doctype} — {recordName}
          </DialogDescription>
        </DialogHeader>

        {/* Format selector */}
        {loadingFormats ? (
          <Skeleton className="h-8 w-64" />
        ) : formats.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Format:</span>
            <select
              value={selectedFormat ?? ''}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="h-7 rounded-md border bg-transparent px-2 text-xs"
            >
              {formats.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={handlePrint} disabled={loading || !renderedHtml}>
              <Printer className="h-3 w-3 mr-1" /> Print
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No print formats available for this DocType</p>
        )}

        {/* Preview area */}
        <div className="border rounded-lg overflow-auto bg-white" style={{ maxHeight: isMobile ? '60vh' : '70vh' }}>
          {loading ? (
            <PrintPreviewSkeleton />
          ) : renderedHtml ? (
            <div
              className="p-6 print-format"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Select a print format to preview</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Render a standard format (format_data JSON) into HTML.
 * format_data is an array of field definitions with layout info.
 */
function renderStandardFormat(
  formatDataJson: string,
  record: Record<string, unknown>,
): string {
  try {
    const fields = JSON.parse(formatDataJson) as Array<Record<string, unknown>>;
    let html = '<div class="space-y-4">';

    for (const field of fields) {
      const fieldtype = String(field.fieldtype ?? '');
      const fieldname = String(field.fieldname ?? '');
      const label = String(field.label ?? fieldname);

      if (fieldtype === 'Section Break') {
        html += '</div><div class="mt-4 pt-2 border-t">';
        if (label) html += `<h3 class="text-sm font-semibold mb-2">${label}</h3>`;
      } else if (fieldtype === 'Column Break') {
        html += '<div class="mb-2">';
      } else if (fieldtype === 'Custom HTML') {
        const options = String(field.options ?? '');
        html += renderJinjaTemplate(options, record, {});
      } else if (fieldname && fieldname !== 'print_heading_template') {
        const val = record[fieldname];
        const displayVal = val !== null && val !== undefined ? String(val) : '—';
        html += `<div class="flex justify-between py-1 border-b border-gray-100">
          <span class="text-xs text-muted-foreground">${label}</span>
          <span class="text-xs font-medium">${displayVal}</span>
        </div>`;
      }
    }

    html += '</div>';
    return html;
  } catch {
    return '<p class="text-muted-foreground">Failed to parse format data</p>';
  }
}
