/* ═══════════════════════════════════════════════════════════
 * HTML Converter — cheerio + turndown
 * ═══════════════════════════════════════════════════════════ */

import * as cheerio from "cheerio";
import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "@/lib/markitdown/types";
import { createTurndown } from "@/lib/markitdown/turndown";

export function createHtmlConverter(): Converter {
  return {
    name: "HtmlConverter",
    priority: 10,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return ext === ".html" || ext === ".htm" || mime.startsWith("text/html") || mime.startsWith("application/xhtml");
    },

    async convert(buffer, info, _options): Promise<ConvertResult> {
      const encoding = info.charset || "utf-8";
      const html = buffer.toString(encoding as BufferEncoding);
      const $ = cheerio.load(html);

      // Remove scripts, styles, noscript
 $("script, style, noscript").remove();

      const body = $("body").html() || $.html();
      const title = $("title").text() || undefined;

      const td = createTurndown();
      const markdown = td.turndown(body);
      return { markdown, title };
    },
  };
}
