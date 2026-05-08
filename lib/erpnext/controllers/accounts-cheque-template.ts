/**
 * accounts-cheque-template.ts
 * Ported business logic from ERPNext accounts/doctype/cheque_print_template/cheque_print_template.py
 * Pure template generation logic — NO database calls.
 */

export type ChequeSize = "" | "Regular" | "A4";

export interface ChequePrintTemplate {
  name: string;
  bank_name: string;
  cheque_size: ChequeSize;
  cheque_width: number;
  cheque_height: number;
  starting_position_from_top_edge: number;
  acc_pay_dist_from_top_edge: number;
  acc_pay_dist_from_left_edge: number;
  message_to_show?: string;
  date_dist_from_top_edge: number;
  date_dist_from_left_edge: number;
  acc_no_dist_from_top_edge: number;
  acc_no_dist_from_left_edge: number;
  payer_name_from_top_edge: number;
  payer_name_from_left_edge: number;
  amt_in_words_from_top_edge: number;
  amt_in_words_from_left_edge: number;
  amt_in_word_width: number;
  amt_in_words_line_spacing: number;
  amt_in_figures_from_top_edge: number;
  amt_in_figures_from_left_edge: number;
  signatory_from_top_edge: number;
  signatory_from_left_edge: number;
  is_account_payable: boolean;
  has_print_format: boolean;
  scanned_cheque?: string;
}

export interface PaymentEntryData {
  reference_date?: string;
  account_no?: string;
  party_name: string;
  base_paid_amount?: number;
  base_received_amount?: number;
  company: string;
}

/* ── Template Generation ─────────────────────────────────── */

export interface GeneratedChequeHTML {
  html: string;
  print_format_name: string;
}

export function createOrUpdateChequePrintFormat(
  template: ChequePrintTemplate,
  paymentEntry: PaymentEntryData,
  referenceDateFormatted?: string,
  amountInWords?: string,
  formattedAmount?: string,
): GeneratedChequeHTML {
  const startingPosition =
    template.cheque_size === "A4" ? template.starting_position_from_top_edge : 0.0;

  const messageToShow = template.message_to_show || "Account Pay Only";

  const html = `<style>
  .print-format {
    padding: 0px;
  }
  @media screen {
    .print-format {
      padding: 0in;
    }
  }
</style>
<div style="position: relative; top:${startingPosition}cm">
  <div style="width:${template.cheque_width}cm;height:${template.cheque_height}cm;">
    <span style="top:${template.acc_pay_dist_from_top_edge}cm; left:${template.acc_pay_dist_from_left_edge}cm;
      border-bottom: solid 1px;border-top:solid 1px; width:2cm;text-align: center; position: absolute;">
        ${messageToShow}
    </span>
    <span style="top:${template.date_dist_from_top_edge}cm; left:${template.date_dist_from_left_edge}cm;
      position: absolute;">
      ${referenceDateFormatted || ""}
    </span>
    <span style="top:${template.acc_no_dist_from_top_edge}cm;left:${template.acc_no_dist_from_left_edge}cm;
      position: absolute;  min-width: 6cm;">
      ${paymentEntry.account_no || ""}
    </span>
    <span style="top:${template.payer_name_from_top_edge}cm;left: ${template.payer_name_from_left_edge}cm;
      position: absolute;  min-width: 6cm;">
      ${paymentEntry.party_name}
    </span>
    <span style="top:${template.amt_in_words_from_top_edge}cm; left:${template.amt_in_words_from_left_edge}cm;
      position: absolute; display: block; width: ${template.amt_in_word_width}cm;
      line-height:${template.amt_in_words_line_spacing}cm; word-wrap: break-word;">
        ${amountInWords || ""}
    </span>
    <span style="top:${template.amt_in_figures_from_top_edge}cm;left: ${template.amt_in_figures_from_left_edge}cm;
      position: absolute; min-width: 4cm;">
      ${formattedAmount || ""}
    </span>
    <span style="top:${template.signatory_from_top_edge}cm;left: ${template.signatory_from_left_edge}cm;
      position: absolute;  min-width: 6cm;">
      ${paymentEntry.company}
    </span>
  </div>
</div>`;

  return {
    html,
    print_format_name: template.name,
  };
}

/* ── Field Validation ────────────────────────────────────── */

export interface ChequeTemplateValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateChequePrintTemplate(template: ChequePrintTemplate): ChequeTemplateValidationResult {
  const errors: string[] = [];

  if (!template.bank_name) {
    errors.push("Bank Name is required");
  }

  if (template.cheque_width <= 0) {
    errors.push("Cheque Width must be greater than 0");
  }

  if (template.cheque_height <= 0) {
    errors.push("Cheque Height must be greater than 0");
  }

  return { valid: errors.length === 0, errors };
}

/* ── Measurement Helpers ─────────────────────────────────── */

export interface ChequeMeasurements {
  width: number;
  height: number;
  startingTop: number;
}

export function getChequeMeasurements(template: ChequePrintTemplate): ChequeMeasurements {
  return {
    width: template.cheque_width,
    height: template.cheque_height,
    startingTop:
      template.cheque_size === "A4" ? template.starting_position_from_top_edge : 0.0,
  };
}
