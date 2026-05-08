/**
 * Pure business logic ported from ERPNext CRM Campaign DocType.
 * Source: erpnext/crm/doctype/campaign/campaign.py
 */

export interface CampaignEmailSchedule {
  id: string;
  name: string;
  parent_id?: string | null;
  send_after_days: number;
  email_template: string;
  idx: number;
}

export interface Campaign {
  id: string;
  name: string;
  campaign_name: string;
  naming_series?: string | null;
  description?: string | null;
  campaign_schedules: CampaignEmailSchedule[];
  docstatus: number;
}

export interface UTMCampaignData {
  name: string;
  campaign_description?: string | null;
  crm_campaign: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  updates: Partial<T>;
}

/* ────────────────────────────────────────────────────────────────
 *  Validation
 * ──────────────────────────────────────────────────────────────── */

export function validateCampaign(campaign: Campaign): ValidationResult<Campaign> {
  const errors: string[] = [];
  const updates: Partial<Campaign> = {};

  if (!campaign.campaign_name || campaign.campaign_name.trim().length === 0) {
    errors.push("Campaign Name is required.");
  }

  const scheduleErrors = validateCampaignSchedules(campaign.campaign_schedules);
  errors.push(...scheduleErrors);

  return {
    valid: errors.length === 0,
    errors,
    updates,
  };
}

export function validateCampaignSchedules(
  schedules: CampaignEmailSchedule[]
): string[] {
  const errors: string[] = [];

  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i];
    if (s.send_after_days < 0) {
      errors.push(`Campaign Schedule row ${i + 1}: Send After (days) must be >= 0.`);
    }
    if (!s.email_template || s.email_template.trim().length === 0) {
      errors.push(`Campaign Schedule row ${i + 1}: Email Template is required.`);
    }
  }

  return errors;
}

/* ────────────────────────────────────────────────────────────────
 *  Naming
 * ──────────────────────────────────────────────────────────────── */

export function generateCampaignName(
  campaign: Campaign,
  namingBy: string
): string {
  if (namingBy !== "Naming Series") {
    return campaign.campaign_name;
  }
  // Caller is responsible for generating a naming-series value when this
  // function returns null / indicates series naming.
  return "";
}

/* ────────────────────────────────────────────────────────────────
 *  UTM Campaign sync (after_insert / on_change logic)
 * ──────────────────────────────────────────────────────────────── */

export function getUTMCampaignSyncData(
  campaign: Campaign
): UTMCampaignData {
  return {
    name: campaign.campaign_name,
    campaign_description: campaign.description,
    crm_campaign: campaign.campaign_name,
  };
}
