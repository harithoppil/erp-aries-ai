/* ═══════════════════════════════════════════════════════════
 * Image Converter — EXIF metadata + Gemini vision caption
 * ═══════════════════════════════════════════════════════════ */

import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "@/lib/markitdown/types";

export function createImageConverter(): Converter {
  return {
    name: "ImageConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      const imageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
      const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
      return imageMimes.some((m) => mime.startsWith(m)) || imageExts.includes(ext);
    },

    async convert(buffer, info, options): Promise<ConvertResult> {
      const parts: string[] = [];

      // ── EXIF metadata ──
      try {
        const exifr = await import("exifr");
        const meta = await exifr.parse(buffer, true);
        if (meta) {
          const fields: Record<string, string | undefined> = {
            ImageSize: meta.ImageWidth && meta.ImageHeight
              ? `${meta.ImageWidth}x${meta.ImageHeight}`
              : undefined,
            Title: meta.ImageDescription || meta.DocumentName,
            Description: meta.ImageDescription,
            Artist: meta.Artist,
            Author: meta.Copyright,
            DateTimeOriginal: meta.DateTimeOriginal,
            CreateDate: meta.CreateDate,
            GPSPosition: meta.latitude && meta.longitude
              ? `${meta.latitude}, ${meta.longitude}`
              : undefined,
          };
          for (const [k, v] of Object.entries(fields)) {
            if (v) parts.push(`${k}: ${v}`);
          }
        }
      } catch {
        // EXIF read failed — continue without metadata
      }

      // ── Gemini vision caption ──
      if (options.geminiApiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: options.geminiApiKey });
          const model = options.geminiModel || "gemini-2.0-flash";
          const prompt = options.imagePrompt?.trim() || "Write a detailed caption for this image.";

          const base64 = buffer.toString("base64");
          const mimeType = info.mimetype || "image/jpeg";

          const result = await ai.models.generateContent({
            model,
            contents: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          });

          const text = result.text;
          if (text) {
            parts.push("", "# Description:", text.trim());
          }
        } catch {
          // Gemini failed — continue without caption
        }
      }

      return { markdown: parts.join("\n").trim() };
    },
  };
}
