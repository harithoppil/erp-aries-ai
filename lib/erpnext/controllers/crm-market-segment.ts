/**
 * Pure business logic ported from ERPNext CRM Market Segment DocType.
 * Source: erpnext/crm/doctype/market_segment/market_segment.py
 */

export interface MarketSegment {
  id: string;
  name: string;
  market_segment: string;
  docstatus: number;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  updates: Partial<T>;
}

export function validateMarketSegment(
  segment: MarketSegment
): ValidationResult<MarketSegment> {
  const errors: string[] = [];

  if (!segment.market_segment || segment.market_segment.trim().length === 0) {
    errors.push("Market Segment is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    updates: {},
  };
}

export function generateMarketSegmentName(segment: MarketSegment): string {
  return segment.market_segment;
}
