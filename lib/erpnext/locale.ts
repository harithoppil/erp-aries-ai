// Centralized locale/formatting configuration.
// Provides consistent date, number, and currency formatting across the entire ERP UI.
// User-specific preferences can be loaded from the system_settings table.

// ── Types ────────────────────────────────────────────────────────────────────

export interface LocaleConfig {
  dateLocale: string;       // e.g. 'en-GB', 'en-US', 'ar-AE'
  numberLocale: string;     // e.g. 'en-AE', 'en-US'
  currencyCode: string;     // e.g. 'AED', 'USD', 'EUR'
  currencyLocale: string;   // e.g. 'en-AE', 'en-US'
  timeZone: string;         // e.g. 'Asia/Dubai', 'UTC'
  dateFormat: string;       // e.g. 'dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'
  timeFormat: '12h' | '24h';
  numberDecimals: number;   // default decimal places for numbers
}

export const DEFAULT_LOCALE: LocaleConfig = {
  dateLocale: 'en-GB',
  numberLocale: 'en-AE',
  currencyCode: 'AED',
  currencyLocale: 'en-AE',
  timeZone: 'Asia/Dubai',
  dateFormat: 'dd/mm/yyyy',
  timeFormat: '24h',
  numberDecimals: 2,
};

// ── Server-side: fetch system locale settings ────────────────────────────────

export async function getSystemLocale(): Promise<LocaleConfig> {
  // Future: read from a dedicated system_settings table or env vars.
  // For now, returns the default locale configuration.
  return DEFAULT_LOCALE;
}

function mapLanguageToDateLocale(language: string | null): string {
  if (!language) return DEFAULT_LOCALE.dateLocale;
  const lower = language.toLowerCase();
  if (lower.startsWith('ar')) return 'ar-AE';
  if (lower.startsWith('en') && lower.includes('us')) return 'en-US';
  if (lower.startsWith('fr')) return 'fr-FR';
  if (lower.startsWith('de')) return 'de-DE';
  if (lower.startsWith('hi')) return 'hi-IN';
  return DEFAULT_LOCALE.dateLocale;
}

function mapLanguageToNumberLocale(language: string | null): string {
  if (!language) return DEFAULT_LOCALE.numberLocale;
  const lower = language.toLowerCase();
  if (lower.startsWith('ar')) return 'ar-AE';
  if (lower.startsWith('en') && lower.includes('us')) return 'en-US';
  if (lower.startsWith('fr')) return 'fr-FR';
  if (lower.startsWith('de')) return 'de-DE';
  if (lower.startsWith('hi')) return 'hi-IN';
  return DEFAULT_LOCALE.numberLocale;
}

// ── Pure formatting functions (usable on both server & client) ───────────────

export function formatDate(
  value: unknown,
  locale: string = DEFAULT_LOCALE.dateLocale,
  timeZone?: string,
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return String(value);
  }
}

export function formatDatetime(
  value: unknown,
  locale: string = DEFAULT_LOCALE.dateLocale,
  timeFormat: '12h' | '24h' = '24h',
  timeZone?: string,
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    const datePart = d.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    });
    const timePart = d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
      ...(timeZone ? { timeZone } : {}),
    });
    return `${datePart} ${timePart}`;
  } catch {
    return String(value);
  }
}

export function formatNumber(
  value: unknown,
  fractionDigits: number = DEFAULT_LOCALE.numberDecimals,
  locale: string = DEFAULT_LOCALE.numberLocale,
): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  try {
    return n.toLocaleString(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    return n.toFixed(fractionDigits);
  }
}

export function formatCurrency(
  value: unknown,
  currencyCode: string = DEFAULT_LOCALE.currencyCode,
  locale: string = DEFAULT_LOCALE.currencyLocale,
): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  try {
    return n.toLocaleString(locale, {
      style: 'currency',
      currency: currencyCode,
    });
  } catch {
    return n.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ` ${currencyCode}`;
  }
}

export function formatPercent(
  value: unknown,
  fractionDigits: number = 1,
  locale: string = DEFAULT_LOCALE.numberLocale,
): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  try {
    return n.toLocaleString(locale, {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    return `${n.toFixed(fractionDigits)}%`;
  }
}
