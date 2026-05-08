/* ═══════════════════════════════════════════════════════════
 * Stream Info — File type detection (Magika + mime + ext)
 * ═══════════════════════════════════════════════════════════ */

import { type StreamInfo } from "./types";

let magikaInstance: any = null;

async function getMagika() {
  if (magikaInstance) return magikaInstance;
  const mod = await import("magika");
  const MagikaClass = (mod as any).Magika;
  magikaInstance = new MagikaClass();
  await magikaInstance.load();
  return magikaInstance;
}

function guessMimetypeFromExt(ext: string): string | undefined {
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".epub": "application/epub+zip",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/x-wav",
    ".msg": "application/vnd.ms-outlook",
  };
  return map[ext.toLowerCase()];
}

function guessExtFromMimetype(mime: string): string | undefined {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "text/csv": ".csv",
    "text/html": ".html",
    "text/plain": ".txt",
    "application/json": ".json",
    "application/zip": ".zip",
    "image/jpeg": ".jpg",
    "image/png": ".png",
  };
  for (const [k, v] of Object.entries(map)) {
    if (mime.startsWith(k)) return v;
  }
  return undefined;
}

/** Build a list of StreamInfo guesses for a buffer.
 *  Returns: [enhancedBaseGuess, magikaGuess?, emptyFallback]
 */
export async function buildStreamInfoGuesses(
  buffer: Buffer,
  base: StreamInfo
): Promise<StreamInfo[]> {
  const guesses: StreamInfo[] = [];

  // 1. Enhance base guess
  const enhanced: StreamInfo = { ...base };
  if (enhanced.extension && !enhanced.mimetype) {
    enhanced.mimetype = guessMimetypeFromExt(enhanced.extension);
  }
  if (enhanced.mimetype && !enhanced.extension) {
    enhanced.extension = guessExtFromMimetype(enhanced.mimetype);
  }
  guesses.push(enhanced);

  // 2. Magika content analysis
  try {
    const magika = await getMagika();
    const result = await magika.identify(buffer);
    if (result?.label && result.label !== "unknown") {
      const magikaGuess: StreamInfo = {
        ...enhanced,
        mimetype: result.mime_type || enhanced.mimetype,
        extension: result.extensions?.[0]
          ? `.${result.extensions[0]}`
          : enhanced.extension,
      };
      // If Magika disagrees significantly, add as separate guess
      const mimeMismatch =
        enhanced.mimetype &&
        magikaGuess.mimetype &&
        !enhanced.mimetype.startsWith(magikaGuess.mimetype) &&
        !magikaGuess.mimetype.startsWith(enhanced.mimetype);
      const extMismatch =
        enhanced.extension &&
        magikaGuess.extension &&
        enhanced.extension.toLowerCase() !== magikaGuess.extension.toLowerCase();

      if (mimeMismatch || extMismatch) {
        guesses.push(magikaGuess);
      } else {
        // Merge: overwrite with Magika's more specific info
        guesses[0] = magikaGuess;
      }
    }
  } catch {
    // Magika failed — continue with base guess only
  }

  // 3. Empty fallback (lets generic converters have a shot)
  guesses.push({});

  return guesses;
}
