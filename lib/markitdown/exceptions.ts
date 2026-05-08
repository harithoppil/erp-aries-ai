/* ═══════════════════════════════════════════════════════════
 * MarkItDown — Exception Types
 * ═══════════════════════════════════════════════════════════ */

export class MarkitdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkitdownError";
  }
}

export class UnsupportedFormatError extends MarkitdownError {
  constructor(message = "No converter accepted this file format") {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

export class ConversionError extends MarkitdownError {
  public attempts: { converter: string; error: string }[];

  constructor(attempts: { converter: string; error: string }[]) {
    const names = attempts.map((a) => `- ${a.converter}: ${a.error}`).join("\n");
    super(`Conversion failed. Attempts:\n${names}`);
    this.name = "ConversionError";
    this.attempts = attempts;
  }
}

export class MissingDependencyError extends MarkitdownError {
  constructor(converter: string, dep: string, installCmd: string) {
    super(
      `${converter} requires "${dep}". Install it:\n  ${installCmd}`
    );
    this.name = "MissingDependencyError";
  }
}
