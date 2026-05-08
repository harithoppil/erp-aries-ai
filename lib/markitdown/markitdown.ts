/* ═══════════════════════════════════════════════════════════
 * MarkItDown Engine — Factory function, no classes
 *
 * Pipeline: raw Buffer → detect type → converter → HTML/text → turndown → markdown
 * ═══════════════════════════════════════════════════════════ */

import { type StreamInfo, type Converter, type ConvertResult, type ConvertOptions } from "./types";
import { UnsupportedFormatError, ConversionError } from "./exceptions";
import { buildStreamInfoGuesses } from "./stream-info";
import { normalizeWhitespace } from "./turndown";

/* ── Built-in converters (import lazily to avoid loading unused deps) ── */

async function getBuiltinConverters(): Promise<Converter[]> {
  const [
    { createPdfConverter },
    { createDocxConverter },
    { createXlsxConverter },
    { createXlsConverter },
    { createHtmlConverter },
    { createImageConverter },
    { createCsvConverter },
    { createZipConverter },
    { createMsgConverter },
    { createPlainTextConverter },
  ] = await Promise.all([
    import("./converters/pdf"),
    import("./converters/docx"),
    import("./converters/xlsx"),
    import("./converters/xlsx"),
    import("./converters/html"),
    import("./converters/image"),
    import("./converters/csv"),
    import("./converters/zip"),
    import("./converters/msg"),
    import("./converters/text"),
  ]);

  return [
    createPdfConverter(),      // priority 0  — specific format
    createDocxConverter(),     // priority 0
    createXlsxConverter(),     // priority 0
    createXlsConverter(),      // priority 0
    createImageConverter(),    // priority 0
    createCsvConverter(),      // priority 0
    createMsgConverter(),      // priority 0
    createZipConverter(),      // priority 0
    createHtmlConverter(),     // priority 10 — generic (catches HTML from others)
    createPlainTextConverter(), // priority 10 — catch-all for text/*
  ];
}

/* ── Factory function: creates the MarkItDown engine ── */

export interface MarkItDownEngine {
  convert: (buffer: Buffer, info?: StreamInfo, options?: ConvertOptions) => Promise<ConvertResult>;
  convertUrl: (url: string, options?: ConvertOptions) => Promise<ConvertResult>;
}

export async function createMarkItDown(
  opts: { enableBuiltin?: boolean } = {}
): Promise<MarkItDownEngine> {
  const enableBuiltin = opts.enableBuiltin !== false;

  // Converter registry: sorted by priority ascending (lower = more specific)
  let converters: Converter[] = [];

  if (enableBuiltin) {
    converters = await getBuiltinConverters();
    converters.sort((a, b) => a.priority - b.priority);
  }

  /* ── Internal convert implementation ── */
  async function _convert(
    buffer: Buffer,
    info: StreamInfo,
    options: ConvertOptions
  ): Promise<ConvertResult> {
    const guesses = await buildStreamInfoGuesses(buffer, info);
    const failed: { converter: string; error: string }[] = [];

    for (const guess of guesses) {
      for (const converter of converters) {
        const accepted = await converter.accepts(buffer, guess);
        if (!accepted) continue;

        try {
          const result = await converter.convert(buffer, guess, {
            ...options,
            parentConverters: converters,
          });
          if (result?.markdown != null) {
            return {
              markdown: normalizeWhitespace(result.markdown),
              title: result.title,
            };
          }
        } catch (err) {
          failed.push({
            converter: converter.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (failed.length > 0) {
      throw new ConversionError(failed);
    }

    throw new UnsupportedFormatError(
      `No converter accepted file: ${info.filename || info.url || "unknown"}`
    );
  }

  /* ── Public API ── */
  return {
    async convert(buffer, info = {}, options = {}) {
      return _convert(buffer, info, options);
    },

    async convertUrl(url, options = {}) {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());

      const contentType = res.headers.get("content-type") || undefined;
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, "") : undefined;
      const extension = filename ? `.${filename.split(".").pop()}` : undefined;

      return _convert(buffer, {
        url,
        mimetype: contentType?.split(";")[0],
        filename,
        extension,
      }, options);
    },
  };
}
