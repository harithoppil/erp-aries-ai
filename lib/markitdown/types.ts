/* ═══════════════════════════════════════════════════════════
 * MarkItDown — Shared Types (no classes, pure interfaces)
 * ═══════════════════════════════════════════════════════════ */

export interface StreamInfo {
  mimetype?: string;
  extension?: string;
  charset?: string;
  filename?: string;
  localPath?: string;
  url?: string;
}

export interface ConvertResult {
  markdown: string;
  title?: string;
}

export interface Converter {
  name: string;
  priority: number;
  accepts: (buffer: Buffer, info: StreamInfo) => boolean | Promise<boolean>;
  convert: (buffer: Buffer, info: StreamInfo, options: ConvertOptions) => Promise<ConvertResult>;
}

export interface ConvertOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  imagePrompt?: string;
  parentConverters?: Converter[];
  styleMap?: string;
}

export interface FailedAttempt {
  converter: string;
  error: Error;
}
