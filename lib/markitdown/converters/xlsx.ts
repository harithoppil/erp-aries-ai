/* ═══════════════════════════════════════════════════════════
 * XLSX / XLS Converter — exceljs → markdown tables
 * ═══════════════════════════════════════════════════════════ */

import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "@/lib/markitdown/types";

function rowsToMarkdown(rows: unknown[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, ci) =>
    Math.max(...rows.map((r) => String(r[ci] ?? "").length))
  );
  const fmt = (row: unknown[]) =>
    "| " + row.map((c, i) => String(c ?? "").padEnd(widths[i])).join(" | ") + " |";

  const lines: string[] = [];
  lines.push(fmt(rows[0]));
  lines.push("| " + rows[0].map((_, i) => "-".repeat(widths[i])).join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) lines.push(fmt(rows[i]));
  return lines.join("\n");
}

export function createXlsxConverter(): Converter {
  return {
    name: "XlsxConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return (
        ext === ".xlsx" ||
        mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    },

    async convert(buffer, _info, _options): Promise<ConvertResult> {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const parts: string[] = [];
      workbook.eachSheet((sheet) => {
        parts.push(`## ${sheet.name}`);
        const rows: unknown[][] = [];
        sheet.eachRow((row) => {
          const vals = (row as any).values as unknown[];
          rows.push(vals.slice(1));
        });
        parts.push(rowsToMarkdown(rows));
        parts.push("");
      });

      return { markdown: parts.join("\n").trim() };
    },
  };
}

export function createXlsConverter(): Converter {
  return {
    name: "XlsConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return ext === ".xls" || mime === "application/vnd.ms-excel" || mime === "application/excel";
    },

    async convert(buffer, _info, _options): Promise<ConvertResult> {
      // exceljs does NOT read .xls (binary BIFF format).
      // For now, delegate to xlsx converter via a note.
      // If we need real XLS support, we'd add the `xlsx` package (SheetJS).
      return {
        markdown:
          "<!-- XLS (binary format) not yet supported. Convert to XLSX or install SheetJS. -->",
      };
    },
  };
}
