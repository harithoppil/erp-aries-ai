/* ═══════════════════════════════════════════════════════════
 * Plain Text Converter — charset detection + decode
 * ═══════════════════════════════════════════════════════════ */

import chardet from "chardet";
import iconv from "iconv-lite";
import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "@/lib/markitdown/types";

export function createPlainTextConverter(): Converter {
  return {
    name: "PlainTextConverter",
    priority: 10,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      if (info.charset) return true; // If charset known, it's text
      if ([".txt", ".text", ".md", ".markdown", ".json", ".jsonl"].includes(ext)) return true;
      if (mime.startsWith("text/")) return true;
      if (mime === "application/json" || mime === "application/markdown") return true;
      return false;
    },

    async convert(buffer, info, _options): Promise<ConvertResult> {
      let text: string;
      if (info.charset) {
        text = iconv.decode(buffer, info.charset);
      } else {
        const detected = chardet.detect(buffer);
        text = iconv.decode(buffer, detected || "utf-8");
      }
      return { markdown: text };
    },
  };
}
