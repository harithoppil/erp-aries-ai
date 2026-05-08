/**
 * Pure business logic ported from ERPNext CRM Competitor DocType.
 * Source: erpnext/crm/doctype/competitor/competitor.py
 */

export interface Competitor {
  id: string;
  name: string;
  competitor_name: string;
  website?: string | null;
  docstatus: number;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  updates: Partial<T>;
}

export function validateCompetitor(competitor: Competitor): ValidationResult<Competitor> {
  const errors: string[] = [];

  if (!competitor.competitor_name || competitor.competitor_name.trim().length === 0) {
    errors.push("Competitor Name is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    updates: {},
  };
}

export function generateCompetitorName(competitor: Competitor): string {
  return competitor.competitor_name;
}
