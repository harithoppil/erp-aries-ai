"use client";

import { useState, useCallback } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportToCSV, downloadCSV, type ColumnConfig } from "@/lib/export/csv-export";
import { exportToExcel, type ExcelColumnConfig } from "@/lib/export/excel-export";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ExportButtonProps {
  /** Row data to export. */
  data: Record<string, unknown>[];
  /** Filename without extension (e.g. "sales-invoices"). */
  filename: string;
  /** Optional column config for CSV export. */
  csvColumns?: ColumnConfig[];
  /** Optional column config for Excel export. */
  excelColumns?: ExcelColumnConfig[];
  /** Disable the button (e.g. while data is loading). */
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ExportButton({
  data,
  filename,
  csvColumns,
  excelColumns,
  disabled = false,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleCSVExport = useCallback(() => {
    if (!data.length) {
      toast.error("No data to export");
      return;
    }

    setExporting("csv");
    try {
      const csv = exportToCSV(data, filename, csvColumns);
      if (!csv) {
        toast.error("Export produced no data");
        return;
      }
      downloadCSV(csv, filename);
      toast.success(`Exported ${data.length} rows as CSV`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "CSV export failed";
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  }, [data, filename, csvColumns]);

  const handleExcelExport = useCallback(async () => {
    if (!data.length) {
      toast.error("No data to export");
      return;
    }

    setExporting("excel");
    try {
      const buffer = await exportToExcel(data, filename, {
        columns: excelColumns,
        sheetName: filename
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      });

      // Create a Blob and trigger download
      const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.length} rows as Excel`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Excel export failed";
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  }, [data, filename, excelColumns]);

  const isExporting = exporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          disabled={disabled || isExporting}
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isExporting
            ? exporting === "csv"
              ? "Exporting CSV..."
              : "Exporting Excel..."
            : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSVExport}>
          <FileText size={14} className="mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcelExport}>
          <FileSpreadsheet size={14} className="mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
