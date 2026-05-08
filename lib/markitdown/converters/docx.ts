/* ═══════════════════════════════════════════════════════════
 * DOCX Converter — mammoth → HTML → turndown
 * ═══════════════════════════════════════════════════════════ */

import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "../types";
import { createTurndown } from "../turndown";

export function createDocxConverter(): Converter {
  return {
    name: "DocxConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return (
        ext === ".docx" ||
        mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    },

    async convert(buffer, _info, options): Promise<ConvertResult> {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ buffer }, { styleMap: options.styleMap });
      const html = result.value;
      const td = createTurndown();
      return { markdown: td.turndown(html) };
    },
  };
}
