/**
 * Context Builder for ERPNext document validation.
 *
 * Builds validation context by querying the database before calling controller
 * pure functions. This module bridges the gap between the database layer
 * (Prisma) and the pure-logic controller functions.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - All queries use the shared `prisma` singleton from `@/lib/prisma`.
 * - Handle missing data gracefully (return null for optional lookups).
 */

import { prisma } from "@/lib/prisma";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FiscalYearInfo {
  name: string;
  yearStart: Date;
  yearEnd: Date;
  disabled: boolean;
}

export interface CompanyDefaults {
  name: string;
  defaultCurrency: string;
  defaultCostCenter: string | null;
  defaultFinanceBook: string | null;
  defaultBankAccount: string | null;
  defaultCashAccount: string | null;
  defaultReceivableAccount: string | null;
  defaultPayableAccount: string | null;
  defaultIncomeAccount: string | null;
  defaultExpenseAccount: string | null;
  country: string;
  taxId: string | null;
}

export interface PartyInfo {
  name: string;
  disabled: boolean;
  onHold: boolean;
  onHoldType: string | null;
  releaseDate: Date | null;
  creditLimit: number;
  outstandingAmount: number;
  taxId: string | null;
  defaultCurrency: string | null;
  defaultPriceList: string | null;
}

export interface ValidationContext {
  fiscalYear: FiscalYearInfo | null;
  companyDefaults: CompanyDefaults | null;
  partyInfo: PartyInfo | null;
  accountBalances: Map<string, number>;
}

// ── Fiscal Year ───────────────────────────────────────────────────────────────

/**
 * Get fiscal year info for a posting date and company.
 * Queries `erpnext_port.FiscalYear` joined with `erpnext_port.FiscalYearCompany`
 * to find the fiscal year that contains the posting date for the given company.
 *
 * @param postingDate - The posting date (Date object or ISO string)
 * @param company     - The company name
 * @returns Fiscal year info or null if not found
 */
export async function getFiscalYearInfo(
  postingDate: Date | string,
  company: string,
): Promise<FiscalYearInfo | null> {
  try {
    const dateValue = typeof postingDate === "string" ? new Date(postingDate) : postingDate;

    // Find fiscal year linked to this company that contains the posting date
    const fiscalYearCompany = await prisma.fiscalYearCompany.findFirst({
      where: { company },
    });

    if (fiscalYearCompany?.parent) {
      const fy = await prisma.fiscalYear.findFirst({
        where: {
          name: fiscalYearCompany.parent,
          disabled: false,
          year_start_date: { lte: dateValue },
          year_end_date: { gte: dateValue },
        },
      });

      if (fy) {
        return {
          name: fy.name,
          yearStart: fy.year_start_date,
          yearEnd: fy.year_end_date,
          disabled: fy.disabled ?? false,
        };
      }
    }

    // Fallback: find any matching fiscal year (not company-specific)
    const fy = await prisma.fiscalYear.findFirst({
      where: {
        disabled: false,
        year_start_date: { lte: dateValue },
        year_end_date: { gte: dateValue },
      },
    });

    if (fy) {
      return {
        name: fy.name,
        yearStart: fy.year_start_date,
        yearEnd: fy.year_end_date,
        disabled: fy.disabled ?? false,
      };
    }

    return null;
  } catch (_e: unknown) {
    return null;
  }
}

// ── Company Defaults ──────────────────────────────────────────────────────────

/**
 * Get company default accounts and settings.
 * Queries `erpnext_port.Company` for default accounts and configuration.
 *
 * @param companyName - The company name (primary key)
 * @returns Company defaults or null if company not found
 */
export async function getCompanyDefaults(
  companyName: string,
): Promise<CompanyDefaults | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { name: companyName },
    });

    if (!company) return null;

    return {
      name: company.name,
      defaultCurrency: company.default_currency,
      defaultCostCenter: company.cost_center ?? null,
      defaultFinanceBook: company.default_finance_book ?? null,
      defaultBankAccount: company.default_bank_account ?? null,
      defaultCashAccount: company.default_cash_account ?? null,
      defaultReceivableAccount: company.default_receivable_account ?? null,
      defaultPayableAccount: company.default_payable_account ?? null,
      defaultIncomeAccount: company.default_income_account ?? null,
      defaultExpenseAccount: company.default_expense_account ?? null,
      country: company.country,
      taxId: company.tax_id ?? null,
    };
  } catch (_e: unknown) {
    return null;
  }
}

// ── Party Info ────────────────────────────────────────────────────────────────

/**
 * Get party (customer/supplier) info for credit limit checks and validation.
 * Queries `erpnext_port.Customer` or `erpnext_port.Supplier` depending on
 * the party type, then computes outstanding amount from GL entries.
 *
 * @param partyType - Either "Customer" or "Supplier"
 * @param partyName - The party name (primary key)
 * @returns Party info or null if party not found
 */
export async function getPartyInfo(
  partyType: string,
  partyName: string,
): Promise<PartyInfo | null> {
  try {
    if (partyType === "Customer") {
      return await getCustomerInfo(partyName);
    }

    if (partyType === "Supplier") {
      return await getSupplierInfo(partyName);
    }

    return null;
  } catch (_e: unknown) {
    return null;
  }
}

/**
 * Get customer info including credit limit and outstanding amount.
 */
async function getCustomerInfo(customerName: string): Promise<PartyInfo | null> {
  const customer = await prisma.customer.findUnique({
    where: { name: customerName },
  });

  if (!customer) return null;

  // Get credit limit from CustomerCreditLimit child table
  let creditLimit = 0;
  try {
    const creditLimits = await prisma.customerCreditLimit.findMany({
      where: { parent: customerName },
    });
    if (creditLimits.length > 0) {
      creditLimit = Number(creditLimits[0].credit_limit ?? 0);
    }
  } catch (_e: unknown) {
    // Table may not have data — default to 0
  }

  // Compute outstanding amount from GL entries
  const outstandingAmount = await computeOutstandingAmount("Customer", customerName);

  return {
    name: customer.name,
    disabled: customer.disabled ?? false,
    onHold: customer.is_frozen ?? false,
    onHoldType: null, // Customer model doesn't have hold_type
    releaseDate: null,
    creditLimit,
    outstandingAmount,
    taxId: customer.tax_id ?? null,
    defaultCurrency: customer.default_currency ?? null,
    defaultPriceList: customer.default_price_list ?? null,
  };
}

/**
 * Get supplier info including on-hold status and outstanding amount.
 */
async function getSupplierInfo(supplierName: string): Promise<PartyInfo | null> {
  const supplier = await prisma.supplier.findUnique({
    where: { name: supplierName },
  });

  if (!supplier) return null;

  // Compute outstanding amount from GL entries
  const outstandingAmount = await computeOutstandingAmount("Supplier", supplierName);

  return {
    name: supplier.name,
    disabled: supplier.disabled ?? false,
    onHold: supplier.on_hold ?? false,
    onHoldType: supplier.hold_type ?? null,
    releaseDate: supplier.release_date ?? null,
    creditLimit: 0, // Suppliers typically don't have credit limits
    outstandingAmount,
    taxId: supplier.tax_id ?? null,
    defaultCurrency: supplier.default_currency ?? null,
    defaultPriceList: supplier.default_price_list ?? null,
  };
}

/**
 * Compute outstanding amount for a party by summing GL entries
 * where the party has an outstanding debit or credit balance.
 */
async function computeOutstandingAmount(
  partyType: string,
  partyName: string,
): Promise<number> {
  try {
    const result = await prisma.glEntry.aggregate({
      _sum: {
        debit: true,
        credit: true,
      },
      where: {
        party_type: partyType,
        party: partyName,
        is_cancelled: false,
      },
    });

    const totalDebit = Number(result._sum.debit ?? 0);
    const totalCredit = Number(result._sum.credit ?? 0);

    // For customers: outstanding = debit (receivable) - credit (payments received)
    // For suppliers: outstanding = credit (payable) - debit (payments made)
    if (partyType === "Customer") {
      return Math.max(0, totalDebit - totalCredit);
    }
    return Math.max(0, totalCredit - totalDebit);
  } catch (_e: unknown) {
    return 0;
  }
}

// ── Account Balances ──────────────────────────────────────────────────────────

/**
 * Get account balances for a set of accounts by summing GL entries.
 * Returns a Map where keys are account names and values are the net balance.
 *
 * For accounts with root_type "Asset" or "Expense": balance = debit - credit
 * For accounts with root_type "Liability", "Equity", or "Income": balance = credit - debit
 *
 * @param accountNames - Array of account name strings
 * @param company      - The company name to filter GL entries
 * @returns Map of account name to net balance
 */
export async function getAccountBalances(
  accountNames: string[],
  company: string,
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();

  if (accountNames.length === 0) return balances;

  try {
    // Fetch account root types for balance direction
    const accounts = await prisma.account.findMany({
      where: {
        name: { in: accountNames },
        company,
      },
      select: {
        name: true,
        root_type: true,
      },
    });

    const rootTypeMap = new Map<string, string>();
    for (const acct of accounts) {
      rootTypeMap.set(acct.name, acct.root_type ?? "Asset");
    }

    // Aggregate GL entries per account
    for (const accountName of accountNames) {
      const result = await prisma.glEntry.aggregate({
        _sum: {
          debit: true,
          credit: true,
        },
        where: {
          account: accountName,
          company,
          is_cancelled: false,
        },
      });

      const totalDebit = Number(result._sum.debit ?? 0);
      const totalCredit = Number(result._sum.credit ?? 0);

      const rootType = rootTypeMap.get(accountName) ?? "Asset";
      const isDebitBalance = ["Asset", "Expense"].includes(rootType);

      const balance = isDebitBalance
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;

      balances.set(accountName, balance);
    }
  } catch (_e: unknown) {
    // Return partial results — accounts with no data default to 0
    for (const accountName of accountNames) {
      if (!balances.has(accountName)) {
        balances.set(accountName, 0);
      }
    }
  }

  return balances;
}

// ── Build Full Validation Context ─────────────────────────────────────────────

/**
 * Build the full validation context for a document.
 * Queries the database for all information needed by controller pure functions.
 *
 * @param doc - The document as a generic record (must contain company, posting_date, and party fields)
 * @returns Complete validation context
 */
export async function buildValidationContext(
  doc: Record<string, unknown>,
): Promise<ValidationContext> {
  const company = typeof doc.company === "string" ? doc.company : "";
  const rawPostingDate = doc.posting_date;
  const postingDateValue: Date | string =
    typeof rawPostingDate === "string" ? rawPostingDate
    : rawPostingDate instanceof Date ? rawPostingDate
    : new Date();

  // Determine party type and name
  let partyType = "";
  let partyName = "";

  if (typeof doc.customer === "string" && doc.customer) {
    partyType = "Customer";
    partyName = doc.customer;
  } else if (typeof doc.supplier === "string" && doc.supplier) {
    partyType = "Supplier";
    partyName = doc.supplier;
  }

  // Build all context parts in parallel for efficiency
  const [fiscalYear, companyDefaults, partyInfo] = await Promise.all([
    company ? getFiscalYearInfo(postingDateValue, company) : Promise.resolve(null),
    company ? getCompanyDefaults(company) : Promise.resolve(null),
    partyType && partyName ? getPartyInfo(partyType, partyName) : Promise.resolve(null),
  ]);

  // Collect account names from the document for balance lookup
  const accountNames = collectAccountNames(doc);
  const accountBalances = accountNames.length > 0 && company
    ? await getAccountBalances(accountNames, company)
    : new Map<string, number>();

  return {
    fiscalYear,
    companyDefaults,
    partyInfo,
    accountBalances,
  };
}

// ── Helper: Collect account names from a document ────────────────────────────

/**
 * Extract all account name references from a document for balance lookups.
 * Checks top-level account fields and item-level account fields.
 *
 * @param doc - The document record
 * @returns Array of unique, non-empty account name strings
 */
function collectAccountNames(doc: Record<string, unknown>): string[] {
  const names = new Set<string>();

  // Top-level account fields
  const topLevelFields = [
    "debit_to",
    "credit_to",
    "cash_bank_account",
    "write_off_account",
    "income_account",
    "expense_account",
  ];

  for (const field of topLevelFields) {
    const value = doc[field];
    if (typeof value === "string" && value) {
      names.add(value);
    }
  }

  // Item-level account fields
  const items = doc.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item && typeof item === "object") {
        const itemRecord = item as Record<string, unknown>;
        const itemFields = [
          "income_account",
          "expense_account",
          "deferred_revenue_account",
          "deferred_expense_account",
        ];

        for (const field of itemFields) {
          const value = itemRecord[field];
          if (typeof value === "string" && value) {
            names.add(value);
          }
        }
      }
    }
  }

  // Tax-level account fields
  const taxes = doc.taxes;
  if (Array.isArray(taxes)) {
    for (const tax of taxes) {
      if (tax && typeof tax === "object") {
        const taxRecord = tax as Record<string, unknown>;
        const value = taxRecord.account_head;
        if (typeof value === "string" && value) {
          names.add(value);
        }
      }
    }
  }

  return Array.from(names);
}

// ── Helper: Get fiscal year range for controller validation ───────────────────

/**
 * Get fiscal year range in the format expected by controller validation functions.
 * Returns `{ year_start_date, year_end_date }` as ISO date strings, or null.
 *
 * @param postingDate - The posting date
 * @param company     - The company name
 * @returns Fiscal year range or null
 */
export async function getFiscalYearRange(
  postingDate: Date | string,
  company: string,
): Promise<{ year_start_date: string; year_end_date: string } | null> {
  const fyInfo = await getFiscalYearInfo(postingDate, company);
  if (!fyInfo) return null;

  return {
    year_start_date: fyInfo.yearStart.toISOString().split("T")[0],
    year_end_date: fyInfo.yearEnd.toISOString().split("T")[0],
  };
}
