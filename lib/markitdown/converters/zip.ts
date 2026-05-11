/* ═══════════════════════════════════════════════════════════
 * ZIP Converter — adm-zip → recursive conversion
 * ═══════════════════════════════════════════════════════════ */

import AdmZip from "adm-zip";
import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "@/lib/markitdown/types";
import type { UnsupportedFormatError, ConversionError } from "@/lib/markitdown/exceptions";

function isMarkitdownError(err: unknown, name: string): boolean {
  return err instanceof Error && err.name === name;
}

export function createZipConverter(): Converter {
  return {
    name: "ZipConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return ext === ".zip" || mime === "application/zip";
    },

    async convert(buffer, info, options): Promise<ConvertResult> {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const parts: string[] = [];
      const name = info.filename || info.url || "archive.zip";
      parts.push(`Content from the zip file \`${name}\`:`, "");

      // Use parent converters passed from the engine for recursive conversion
      const converters = options.parentConverters || [];

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryBuffer = entry.getData();
        const ext = entry.entryName.includes(".")
          ? "." + entry.entryName.split(".").pop()
          : "";

        // Try each converter on the inner file
        let converted = false;
        for (const converter of converters) {
          if (converter.name === "ZipConverter") continue; // Avoid infinite recursion
          try {
            const accepted = await converter.accepts(entryBuffer, {
              extension: ext,
              filename: entry.name,
            });
            if (!accepted) continue;
            const result = await converter.convert(entryBuffer, {
              extension: ext,
              filename: entry.name,
            }, options);
            if (result?.markdown) {
              parts.push(`## File: ${entry.entryName}`, "", result.markdown, "");
              converted = true;
              break;
            }
          } catch (err) {
            if (isMarkitdownError(err, "UnsupportedFormatError") || isMarkitdownError(err, "ConversionError")) {
              continue;
            }
            // Log but don't fail the whole ZIP for one bad file
            console.warn(`[zip] ${entry.entryName} failed with ${converter.name}:`, err);
          }
        }

        if (!converted) {
          parts.push(`## File: ${entry.entryName}`, "", "_Unsupported format_", "");
        }
      }

      return { markdown: parts.join("\n").trim() };
    },
  };
}
