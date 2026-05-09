/**
 * Email Template Builder — ERP-specific HTML email templates.
 *
 * Adapted from the Revolyzz pattern but tailored for ERP documents
 * (invoices, purchase orders, delivery notes, payment receipts).
 *
 * All templates are DORMANT: they generate HTML but the actual
 * sending is controlled by the EMAIL_ENABLED flag in email-sender.ts.
 */

// ── Environment ────────────────────────────────────────────────────────────────

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Aries';
const COMPANY_LOGO_URL = process.env.NEXT_PUBLIC_COMPANY_LOGO_URL || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aries.erp.dev';

// ── Shared Types ───────────────────────────────────────────────────────────────

interface EmailTemplateContext {
  companyName: string;
  logoUrl: string;
  appUrl: string;
  year: number;
}

function getContext(): EmailTemplateContext {
  return {
    companyName: COMPANY_NAME,
    logoUrl: COMPANY_LOGO_URL,
    appUrl: APP_URL,
    year: new Date().getFullYear(),
  };
}

// ── Base Template ───────────────────────────────────────────────────────────────

/**
 * Base email template with ERP branding.
 * Wraps arbitrary content HTML in a professional, responsive, print-friendly layout.
 */
export function getBaseEmailTemplate(content: string, companyNameOverride?: string): string {
  const baseCtx = getContext();
  const ctx: EmailTemplateContext = companyNameOverride
    ? { ...baseCtx, companyName: companyNameOverride }
    : baseCtx;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ctx.companyName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f7fa;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #1e3a5f;
      padding: 24px 30px;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h1 {
      color: #ffffff;
      font-size: 20px;
      margin: 0;
      font-weight: 700;
    }
    .header .logo {
      max-width: 140px;
      height: auto;
    }
    .content {
      padding: 30px;
      background-color: #ffffff;
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    .button {
      display: inline-block;
      background-color: #1e3a5f;
      color: white !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      margin: 20px 0;
      font-weight: bold;
      text-align: center;
    }
    .button:hover {
      background-color: #152a45;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #6b7280;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }
    .table th {
      background-color: #f3f4f6;
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #d1d5db;
    }
    .table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      color: #4b5563;
    }
    .table tr:last-child td {
      border-bottom: none;
    }
    .text-right {
      text-align: right;
    }
    .text-bold {
      font-weight: 700;
    }
    .highlight {
      font-size: 24px;
      font-weight: bold;
      color: #1e3a5f;
      margin: 20px 0;
      text-align: center;
    }
    .badge-draft {
      display: inline-block;
      background-color: #f3f4f6;
      color: #6b7280;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-paid {
      display: inline-block;
      background-color: #ecfdf5;
      color: #047857;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-unpaid {
      display: inline-block;
      background-color: #fef2f2;
      color: #b91c1c;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    @media print {
      body { background-color: #fff; }
      .container { padding: 0; }
      .header { border-radius: 0; }
      .content { border-radius: 0; box-shadow: none; }
      .button { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${ctx.companyName}</h1>
      ${ctx.logoUrl ? `<img src="${ctx.logoUrl}" alt="${ctx.companyName}" class="logo" />` : ''}
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${ctx.year} ${ctx.companyName}. All rights reserved.</p>
      <p>This is an automated message from your ERP system. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Invoice Email Template ─────────────────────────────────────────────────────

interface InvoiceEmailData {
  invoiceId: string;
  customerName: string;
  postingDate: string;
  dueDate: string;
  grandTotal: string;
  currency: string;
  outstandingAmount: string;
  status: string;
  items: Array<{ itemCode: string; itemName: string; qty: number; rate: string; amount: string }>;
  paymentLink?: string;
}

export function getInvoiceEmailTemplate(
  invoice: InvoiceEmailData,
  company: string,
  paymentLink?: string,
): string {
  const badgeClass =
    invoice.status === 'Paid' ? 'badge-paid' :
    invoice.status === 'Unpaid' || invoice.status === 'Partly Paid' ? 'badge-unpaid' :
    'badge-draft';

  const itemsRows = invoice.items.map(
    (item) => `<tr>
      <td>${item.itemCode || item.itemName}</td>
      <td>${item.itemName}</td>
      <td class="text-right">${item.qty}</td>
      <td class="text-right">${item.rate}</td>
      <td class="text-right">${item.amount}</td>
    </tr>`,
  ).join('');

  const paymentSection = paymentLink
    ? `<div style="text-align: center; margin: 24px 0;">
         <a href="${paymentLink}" class="button">Pay Now</a>
       </div>`
    : '';

  const content = `
    <h2 style="margin-top:0; color: #1e3a5f;">Sales Invoice</h2>
    <p>Hello ${invoice.customerName},</p>
    <p>Please find your invoice details below:</p>

    <div class="card">
      <table style="width:100%; font-size:14px;">
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Invoice ID</td>
          <td style="padding:4px 0; font-weight:600;">${invoice.invoiceId}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Date</td>
          <td style="padding:4px 0;">${invoice.postingDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Due Date</td>
          <td style="padding:4px 0;">${invoice.dueDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Status</td>
          <td style="padding:4px 0;"><span class="${badgeClass}">${invoice.status}</span></td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Outstanding</td>
          <td style="padding:4px 0; font-weight:700; color: #b91c1c;">${invoice.currency} ${invoice.outstandingAmount}</td>
        </tr>
      </table>
    </div>

    <h3 style="color:#374151;">Line Items</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Item Code</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div style="text-align: right; margin-top: 12px; padding-top: 12px; border-top: 2px solid #1e3a5f;">
      <span style="font-size: 18px; font-weight: 700; color: #1e3a5f;">Grand Total: ${invoice.currency} ${invoice.grandTotal}</span>
    </div>

    ${paymentSection}

    <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
      If you have questions about this invoice, please contact us.
    </p>
  `;

  return getBaseEmailTemplate(content, company);
}

// ── Purchase Order Email Template ───────────────────────────────────────────────

interface PurchaseOrderEmailData {
  poId: string;
  supplierName: string;
  postingDate: string;
  deliveryDate: string;
  grandTotal: string;
  currency: string;
  status: string;
  items: Array<{ itemCode: string; itemName: string; qty: number; rate: string; amount: string }>;
}

export function getPurchaseOrderEmailTemplate(
  po: PurchaseOrderEmailData,
  company: string,
): string {
  const itemsRows = po.items.map(
    (item) => `<tr>
      <td>${item.itemCode || item.itemName}</td>
      <td>${item.itemName}</td>
      <td class="text-right">${item.qty}</td>
      <td class="text-right">${item.rate}</td>
      <td class="text-right">${item.amount}</td>
    </tr>`,
  ).join('');

  const content = `
    <h2 style="margin-top:0; color: #1e3a5f;">Purchase Order</h2>
    <p>Dear ${po.supplierName},</p>
    <p>We are pleased to issue the following purchase order:</p>

    <div class="card">
      <table style="width:100%; font-size:14px;">
        <tr>
          <td style="padding:4px 0; color:#6b7280;">PO ID</td>
          <td style="padding:4px 0; font-weight:600;">${po.poId}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Date</td>
          <td style="padding:4px 0;">${po.postingDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Required By</td>
          <td style="padding:4px 0; font-weight:600;">${po.deliveryDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Status</td>
          <td style="padding:4px 0;"><span class="badge-draft">${po.status}</span></td>
        </tr>
      </table>
    </div>

    <h3 style="color:#374151;">Items Requested</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Item Code</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div style="text-align: right; margin-top: 12px; padding-top: 12px; border-top: 2px solid #1e3a5f;">
      <span style="font-size: 18px; font-weight: 700; color: #1e3a5f;">Total: ${po.currency} ${po.grandTotal}</span>
    </div>

    <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
      Please confirm receipt of this order and advise on delivery timeline.
    </p>
  `;

  return getBaseEmailTemplate(content, company);
}

// ── Delivery Note Email Template ───────────────────────────────────────────────

interface DeliveryNoteEmailData {
  dnId: string;
  customerName: string;
  postingDate: string;
  grandTotal: string;
  currency: string;
  status: string;
  shippingAddress?: string;
  items: Array<{ itemCode: string; itemName: string; qty: number; rate: string; amount: string }>;
}

export function getDeliveryNoteEmailTemplate(
  dn: DeliveryNoteEmailData,
  company: string,
): string {
  const itemsRows = dn.items.map(
    (item) => `<tr>
      <td>${item.itemCode || item.itemName}</td>
      <td>${item.itemName}</td>
      <td class="text-right">${item.qty}</td>
      <td class="text-right">${item.amount}</td>
    </tr>`,
  ).join('');

  const addressSection = dn.shippingAddress
    ? `<tr>
        <td style="padding:4px 0; color:#6b7280;">Shipping Address</td>
        <td style="padding:4px 0;">${dn.shippingAddress}</td>
      </tr>`
    : '';

  const content = `
    <h2 style="margin-top:0; color: #1e3a5f;">Delivery Note</h2>
    <p>Dear ${dn.customerName},</p>
    <p>Your order has been dispatched. Delivery details below:</p>

    <div class="card">
      <table style="width:100%; font-size:14px;">
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Delivery Note</td>
          <td style="padding:4px 0; font-weight:600;">${dn.dnId}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Date</td>
          <td style="padding:4px 0;">${dn.postingDate}</td>
        </tr>
        ${addressSection}
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Status</td>
          <td style="padding:4px 0;"><span class="badge-draft">${dn.status}</span></td>
        </tr>
      </table>
    </div>

    <h3 style="color:#374151;">Items Shipped</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Item Code</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div style="text-align: right; margin-top: 12px; padding-top: 12px; border-top: 2px solid #1e3a5f;">
      <span style="font-size: 18px; font-weight: 700; color: #1e3a5f;">Total: ${dn.currency} ${dn.grandTotal}</span>
    </div>

    <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
      If you have any questions about this delivery, please contact our logistics team.
    </p>
  `;

  return getBaseEmailTemplate(content, company);
}

// ── Payment Receipt Email Template ─────────────────────────────────────────────

interface PaymentReceiptEmailData {
  paymentId: string;
  partyName: string;
  paymentType: string;
  amount: string;
  currency: string;
  referenceNumber: string;
  postingDate: string;
  invoiceId?: string;
}

export function getPaymentReceiptEmailTemplate(
  payment: PaymentReceiptEmailData,
  company: string,
): string {
  const invoiceRef = payment.invoiceId
    ? `<tr>
        <td style="padding:4px 0; color:#6b7280;">Against Invoice</td>
        <td style="padding:4px 0; font-weight:600;">${payment.invoiceId}</td>
      </tr>`
    : '';

  const content = `
    <h2 style="margin-top:0; color: #1e3a5f;">Payment Receipt</h2>
    <p>Dear ${payment.partyName},</p>
    <p>We confirm receipt of your payment:</p>

    <div class="card">
      <table style="width:100%; font-size:14px;">
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Payment ID</td>
          <td style="padding:4px 0; font-weight:600;">${payment.paymentId}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Date</td>
          <td style="padding:4px 0;">${payment.postingDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Type</td>
          <td style="padding:4px 0;">${payment.paymentType}</td>
        </tr>
        ${invoiceRef}
        <tr>
          <td style="padding:4px 0; color:#6b7280;">Reference</td>
          <td style="padding:4px 0;">${payment.referenceNumber || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <div class="highlight">
      ${payment.currency} ${payment.amount}
    </div>

    <p style="color: #047857; font-weight: 600; text-align: center;">
      Payment received — thank you!
    </p>

    <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
      Please retain this email as your receipt. For questions, contact our finance team.
    </p>
  `;

  return getBaseEmailTemplate(content, company);
}
