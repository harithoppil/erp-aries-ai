/* ═══════════════════════════════════════════════════════════
 * Outlook MSG Converter — @kenjiuno/msgreader
 * ═══════════════════════════════════════════════════════════ */

import type { Converter, ConvertResult, ConvertOptions, StreamInfo } from "@/lib/markitdown/types";
import { MissingDependencyError } from "@/lib/markitdown/exceptions";

interface MsgFileData {
  senderName?: string;
  senderEmail?: string;
  to?: string;
  subject?: string;
  creationTime?: string;
  body?: string;
  bodyHTML?: string;
}

interface MsgReaderClass {
  new (buffer: Buffer): { getFileData(): MsgFileData };
}

export function createMsgConverter(): Converter {
  return {
    name: "MsgConverter",
    priority: 0,

    accepts(_buffer, info) {
      const mime = (info.mimetype || "").toLowerCase();
      const ext = (info.extension || "").toLowerCase();
      return ext === ".msg" || mime === "application/vnd.ms-outlook";
    },

    async convert(buffer, _info, _options): Promise<ConvertResult> {
      let MsgReader: MsgReaderClass;
      try {
        // turbopackOptional: suppresses build error if optional dep is missing
        const mod = await import(/* turbopackOptional: true */ "@kenjiuno/msgreader");
        const Ctor = (mod as Record<string, unknown>).default || (mod as Record<string, unknown>).MsgReader;
        if (typeof Ctor !== "function") {
          throw new Error("MsgReader export not found");
        }
        MsgReader = Ctor as MsgReaderClass;
      } catch {
        throw new MissingDependencyError(
          "MsgConverter",
          "@kenjiuno/msgreader",
          "bun add --optional @kenjiuno/msgreader"
        );
      }

      const reader = new MsgReader(buffer);
      const msg = reader.getFileData();

      const parts: string[] = ["# Email Message", ""];
      if (msg.senderName || msg.senderEmail) {
        parts.push(`**From:** ${msg.senderName || ""} <${msg.senderEmail || ""}>`);
      }
      if (msg.to) {
        parts.push(`**To:** ${msg.to}`);
      }
      if (msg.subject) {
        parts.push(`**Subject:** ${msg.subject}`);
      }
      if (msg.creationTime) {
        parts.push(`**Date:** ${msg.creationTime}`);
      }
      parts.push("", "## Content", "");
      if (msg.body) {
        parts.push(msg.body);
      } else if (msg.bodyHTML) {
        // If HTML body exists, strip tags for plain markdown
        parts.push(msg.bodyHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      }

      return { markdown: parts.join("\n").trim(), title: msg.subject };
    },
  };
}
