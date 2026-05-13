'use client';

// Client-side hook providing locale-aware formatters.
// Falls back to DEFAULT_LOCALE when server preferences aren't available.

import { useMemo } from 'react';
import {
  DEFAULT_LOCALE,
  formatDate,
  formatDatetime,
  formatNumber,
  formatCurrency,
  formatPercent,
  type LocaleConfig,
} from '@/lib/erpnext/locale';

export function useLocaleFormat(config?: Partial<LocaleConfig>) {
  const locale = useMemo<LocaleConfig>(
    () => ({ ...DEFAULT_LOCALE, ...config }),
    [config],
  );

  return useMemo(
    () => ({
      /** Format a date value */
      date: (value: unknown) =>
        formatDate(value, locale.dateLocale, locale.timeZone),
      /** Format a datetime value */
      datetime: (value: unknown) =>
        formatDatetime(value, locale.dateLocale, locale.timeFormat, locale.timeZone),
      /** Format a number */
      number: (value: unknown, fractionDigits?: number) =>
        formatNumber(value, fractionDigits ?? locale.numberDecimals, locale.numberLocale),
      /** Format a currency value */
      currency: (value: unknown, currencyCode?: string) =>
        formatCurrency(value, currencyCode ?? locale.currencyCode, locale.currencyLocale),
      /** Format a percentage value */
      percent: (value: unknown, fractionDigits?: number) =>
        formatPercent(value, fractionDigits, locale.numberLocale),
      /** The active locale config */
      locale,
    }),
    [locale],
  );
}
