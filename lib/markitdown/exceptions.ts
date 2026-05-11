/* ═══════════════════════════════════════════════════════════
 * MarkItDown — Exception Types (factory functions)
 * ═══════════════════════════════════════════════════════════ */

export interface MarkitdownError extends Error {
  name: string;
}

export function createMarkitdownError(message: string): MarkitdownError {
  const error = new Error(message) as MarkitdownError;
  error.name = "MarkitdownError";
  return error;
}

export interface UnsupportedFormatError extends MarkitdownError {
  name: string;
}

export function createUnsupportedFormatError(
  message = "No converter accepted this file format"
): UnsupportedFormatError {
  const error = new Error(message) as UnsupportedFormatError;
  error.name = "UnsupportedFormatError";
  return error;
}

export interface ConversionError extends MarkitdownError {
  name: string;
  attempts: { converter: string; error: string }[];
}

export function createConversionError(
  attempts: { converter: string; error: string }[]
): ConversionError {
  const names = attempts.map((a) => `- ${a.converter}: ${a.error}`).join("\n");
  const error = new Error(`Conversion failed. Attempts:\n${names}`) as ConversionError;
  error.name = "ConversionError";
  error.attempts = attempts;
  return error;
}

export interface MissingDependencyError extends MarkitdownError {
  name: string;
}

export function createMissingDependencyError(
  converter: string,
  dep: string,
  installCmd: string
): MissingDependencyError {
  const error = new Error(
    `${converter} requires "${dep}". Install it:\n  ${installCmd}`
  ) as MissingDependencyError;
  error.name = "MissingDependencyError";
  return error;
}
