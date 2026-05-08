/* ═══════════════════════════════════════════════════════════
 * PDF Converter — unpdf (server-safe pdfjs-dist wrapper)
 * ═══════════════════════════════════════════════════════════ */

import type { Converter, ConvertResult, StreamInfo } from "../types";

export function createPdfConverter(): Converter {
  return {
    name: "PdfConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return ext === ".pdf" || mime === "application/pdf" || mime === "application/x-pdf";
    },

    async convert(buffer, _info, _options) {
      const { extractText } = await import("unpdf");
      const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true });
      return {
        markdown: `<!-- ${totalPages} page(s) -->\n\n${text}`,
      };
    },
  };
}
