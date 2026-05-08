/* ═══════════════════════════════════════════════════════════
 * CSV Converter — csv-parse + smart charset detection
 * ═══════════════════════════════════════════════════════════ */

import { parse } from "csv-parse/sync";
import chardet from "chardet";
import iconv from "iconv-lite";
import type { Converter, ConvertResult, StreamInfo } from "../types";

const FALLBACK_ENCODINGS = [
  "utf-8",
  "shift_jis",
  "euc-jp",
  "iso-2022-jp",
  "gb2312",
  "gbk",
  "big5",
  "euc-kr",
  "windows-1252",
  "iso-8859-1",
];

function looksLikeMojibake(text: string): boolean {
  // Count replacement chars and control chars
  const bad = (text.match(/[\ufffd\u0000-\u0008\u000b-\u000c\u000e-\u001f]/g) || []).length;
  return bad / text.length > 0.05;
}

function tryDecode(buffer: Buffer): string {
  // First try provided charset or detected
  const detected = chardet.detect(buffer);
  const candidates = detected ? [detected, ...FALLBACK_ENCODINGS] : FALLBACK_ENCODINGS;

  for (const enc of candidates) {
    try {
      const text = iconv.decode(buffer, enc);
      if (!looksLikeMojibake(text)) return text;
    } catch {
      continue;
    }
  }

  // Last resort: UTF-8 with replacement chars
  return iconv.decode(buffer, "utf-8");
}

export function createCsvConverter(): Converter {
  return {
    name: "CsvConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return ext === ".csv" || mime === "text/csv" || mime === "application/csv";
    },

    async convert(buffer, info, _options): Promise<ConvertResult> {
      const text = info.charset
        ? iconv.decode(buffer, info.charset)
        : tryDecode(buffer);
      const records = parse(text, { columns: false, skip_empty_lines: true }) as string[][];

      if (records.length === 0) return { markdown: "" };

      const cols = records[0].length;
      const lines: string[] = [];
      lines.push("| " + records[0].join(" | ") + " |");
      lines.push("| " + records[0].map(() => "---").join(" | ") + " |");
      for (let i = 1; i < records.length; i++) {
        const row = records[i];
        while (row.length < cols) row.push("");
        lines.push("| " + row.slice(0, cols).join(" | ") + " |");
      }

      return { markdown: lines.join("\n") };
    },
  };
}
