/* ═══════════════════════════════════════════════════════════
 * Turndown — HTML → Markdown with GFM plugins
 * ═══════════════════════════════════════════════════════════ */

import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "_",
    strongDelimiter: "**",
  });

  // Add GFM support (tables, strikethrough, task lists)
  td.use(gfm);

  // Remove script and style tags entirely
  td.remove(["script", "style", "noscript"]);

  // Truncate data URIs in images
  td.addRule("dataUriImage", {
    filter: (node: any) =>
      node.nodeName === "IMG" &&
      node.getAttribute("src")?.startsWith("data:"),
    replacement: (_content: string, node: any) => {
      const alt = node.getAttribute("alt") || "";
      return `![${alt}](data:...)`;
    },
  });

  return td;
}

export function normalizeWhitespace(text: string): string {
  // Strip trailing whitespace per line
  const lines = text.split("\n").map((l) => l.trimEnd());
  // Collapse 3+ newlines down to 2
  const collapsed = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return collapsed.trim();
}
