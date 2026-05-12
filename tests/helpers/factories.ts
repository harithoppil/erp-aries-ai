/**
 * Test data factories — build records with sensible defaults.
 *
 * Mirrors Frappe's `create_sales_invoice(**args)` pattern:
 * functions that create test data with defaults, accepting overrides.
 *
 * These use the Prisma client directly (not server actions) so they work
 * inside transaction-rolled-back tests.
 */
import type { TransactionClient } from './test-db';

// ── Shared helpers ───────────────────────────────────────────────────────────

function makeName(prefix: string): string {
  return `TEST-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── Company ──────────────────────────────────────────────────────────────────

export async function ensureCompany(
  prisma: TransactionClient,
  name = 'AM-Dubai',
): Promise<string> {
  const existing = await (prisma as unknown as { company: { findUnique: (a: unknown) => Promise<unknown> } })
    .company.findUnique({ where: { name } });
  if (existing) return name;

  await (prisma as unknown as { company: { create: (a: unknown) => Promise<unknown> } })
    .company.create({
      data: {
        name,
        abbr: 'AD',
        company_name: name,
        country: 'United Arab Emirates',
        default_currency: 'AED',
        monthly_sales_target: 0,
        total_monthly_sales: 0,
        docstatus: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
  return name;
}

// ── Customer ─────────────────────────────────────────────────────────────────

export interface CustomerOverrides {
  name?: string;
  customer_name?: string;
  customer_type?: string;
  customer_group?: string;
  territory?: string;
}

export async function createCustomer(
  prisma: TransactionClient,
  overrides: CustomerOverrides = {},
): Promise<string> {
  const id = overrides.name ?? makeName('CUST');
  await (prisma as unknown as { customer: { create: (a: unknown) => Promise<unknown> } })
    .customer.create({
      data: {
        name: id,
        customer_name: overrides.customer_name ?? id,
        customer_type: overrides.customer_type ?? 'Company',
        customer_group: overrides.customer_group ?? 'Commercial',
        territory: overrides.territory ?? 'United Arab Emirates',
        default_commission_rate: 0,
        docstatus: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
  return id;
}

// ── Item ─────────────────────────────────────────────────────────────────────

export interface ItemOverrides {
  name?: string;
  item_name?: string;
  item_code?: string;
  item_group?: string;
  stock_uom?: string;
  is_stock_item?: boolean;
}

export async function createItem(
  prisma: TransactionClient,
  overrides: ItemOverrides = {},
): Promise<string> {
  const code = overrides.item_code ?? overrides.name ?? makeName('ITEM');
  await (prisma as unknown as { item: { create: (a: unknown) => Promise<unknown> } })
    .item.create({
      data: {
        name: code,
        item_code: code,
        item_name: overrides.item_name ?? code,
        item_group: overrides.item_group ?? 'All Item Groups',
        stock_uom: overrides.stock_uom ?? 'Nos',
        is_stock_item: overrides.is_stock_item ?? false,
        opening_stock: 0,
        valuation_rate: 0,
        standard_rate: 0,
        shelf_life_in_days: 0,
        weight_per_unit: 0,
        sample_quantity: 0,
        safety_stock: 0,
        lead_time_days: 0,
        last_purchase_rate: 0,
        max_discount: 0,
        no_of_months: 0,
        no_of_months_exp: 0,
        total_projected_qty: 0,
        over_delivery_receipt_allowance: 0,
        over_billing_allowance: 0,
        production_capacity: 0,
        docstatus: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
  return code;
}

// ── Account ──────────────────────────────────────────────────────────────────

export interface AccountOverrides {
  name?: string;
  account_name?: string;
  root_type?: string;
  is_group?: boolean;
  company?: string;
}

export async function createAccount(
  prisma: TransactionClient,
  overrides: AccountOverrides = {},
): Promise<string> {
  const id = overrides.name ?? makeName('ACC');
  await (prisma as unknown as { account: { create: (a: unknown) => Promise<unknown> } })
    .account.create({
      data: {
        name: id,
        account_name: overrides.account_name ?? id,
        account_number: id,
        root_type: overrides.root_type ?? 'Asset',
        is_group: overrides.is_group ?? false,
        company: overrides.company ?? 'AM-Dubai',
        parent_account: 'Application of Funds (Assets) - AD',
        tax_rate: 0,
        lft: 9999,
        rgt: 10000,
        docstatus: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
  return id;
}

// ── Sales Invoice (with items) ───────────────────────────────────────────────

export interface CreateSalesInvoiceArgs {
  customer?: string;
  company?: string;
  items?: Array<{ item_code: string; qty: number; rate: number }>;
  do_not_save?: boolean;
  do_not_submit?: boolean;
}

function zeroDecimal() {
  return 0;
}

export async function createSalesInvoice(
  prisma: TransactionClient,
  args: CreateSalesInvoiceArgs = {},
): Promise<{ name: string; docstatus: number }> {
  const company = args.company ?? 'AM-Dubai';
  const customer = args.customer ?? await createCustomer(prisma);
  const itemCode = args.items?.[0]?.item_code ?? await createItem(prisma);

  const items = args.items ?? [{ item_code: itemCode, qty: 1, rate: 100 }];
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const totalAmount = items.reduce((s, it) => s + it.qty * it.rate, 0);

  const name = makeName('SINV');

  await (prisma as unknown as { salesInvoice: { create: (a: unknown) => Promise<unknown> } })
    .salesInvoice.create({
      data: {
        name,
        customer,
        company,
        naming_series: 'SINV-.YYYY.-',
        posting_date: new Date(),
        due_date: new Date(),
        currency: 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        total_qty: totalQty,
        base_total: totalAmount,
        base_net_total: totalAmount,
        total: totalAmount,
        net_total: totalAmount,
        total_net_weight: 0,
        base_total_taxes_and_charges: 0,
        total_taxes_and_charges: 0,
        loyalty_points: 0,
        loyalty_amount: 0,
        base_discount_amount: 0,
        additional_discount_percentage: 0,
        discount_amount: 0,
        base_grand_total: totalAmount,
        base_rounding_adjustment: 0,
        base_rounded_total: totalAmount,
        grand_total: totalAmount,
        rounding_adjustment: 0,
        rounded_total: totalAmount,
        total_advance: 0,
        outstanding_amount: totalAmount,
        base_paid_amount: 0,
        paid_amount: 0,
        base_change_amount: 0,
        change_amount: 0,
        write_off_amount: 0,
        base_write_off_amount: 0,
        debit_to: 'Debtors - AD',
        commission_rate: 0,
        total_commission: 0,
        total_billing_hours: 0,
        amount_eligible_for_commission: totalAmount,
        docstatus: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

  // Save child items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const amount = item.qty * item.rate;
    await (prisma as unknown as { salesInvoiceItem: { create: (a: unknown) => Promise<unknown> } })
      .salesInvoiceItem.create({
        data: {
          name: `${name}-item-${i + 1}`,
          parent: name,
          parenttype: 'Sales Invoice',
          parentfield: 'items',
          idx: i + 1,
          item_code: item.item_code,
          item_name: item.item_code,
          qty: item.qty,
          uom: 'Nos',
          conversion_factor: 1,
          stock_qty: item.qty,
          price_list_rate: item.rate,
          base_price_list_rate: item.rate,
          margin_rate_or_amount: 0,
          rate_with_margin: item.rate,
          discount_percentage: 0,
          discount_amount: 0,
          base_rate_with_margin: item.rate,
          rate: item.rate,
          amount,
          base_rate: item.rate,
          base_amount: amount,
          net_rate: item.rate,
          net_amount: amount,
          base_net_rate: item.rate,
          base_net_amount: amount,
          income_account: 'Sales - AD',
          weight_per_unit: 0,
          total_weight: 0,
          actual_batch_qty: 0,
          actual_qty: 0,
          delivered_qty: 0,
          incoming_rate: 0,
          stock_uom_rate: 0,
          distributed_discount_amount: 0,
          company_total_stock: 0,
          docstatus: 0,
          creation: new Date(),
          modified: new Date(),
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
  }

  return { name, docstatus: 0 };
}

// ── Generic record creator ───────────────────────────────────────────────────

export async function createRecord(
  prisma: TransactionClient,
  accessor: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const model = (prisma as unknown as Record<string, { create: (a: unknown) => Promise<unknown> }>)[accessor];
  if (!model) throw new Error(`No Prisma model for accessor "${accessor}"`);
  return model.create({ data }) as Promise<Record<string, unknown>>;
}
