/**
 * Ported from erpnext/setup/doctype/company/company.py
 * Pure business logic for Company DocType.
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: number | string | boolean | undefined): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  const v = typeof value === "string" ? parseInt(value, 10) : value ?? 0;
  return Number.isNaN(v) ? 0 : v;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CompanyDoc {
  name?: string;
  company_name: string;
  abbr?: string;
  country: string;
  default_currency: string;
  is_group?: number;
  parent_company?: string;
  reporting_currency?: string;
  create_chart_of_accounts_based_on?: "" | "Standard Template" | "Existing Company";
  existing_company?: string;
  chart_of_accounts?: string;
  enable_perpetual_inventory?: number;
  enable_item_wise_inventory_account?: number;
  enable_provisional_accounting_for_non_stock_items?: number;
  default_provisional_account?: string;
  default_inventory_account?: string;
  valuation_method?: "FIFO" | "Moving Average" | "LIFO";
  accounts_frozen_till_date?: string;
  lft?: number;
  rgt?: number;
  old_parent?: string;

  // Default accounts
  default_bank_account?: string;
  default_cash_account?: string;
  default_receivable_account?: string;
  default_payable_account?: string;
  default_expense_account?: string;
  default_income_account?: string;
  stock_received_but_not_billed?: string;
  stock_adjustment_account?: string;
  write_off_account?: string;
  default_discount_account?: string;
  unrealized_profit_loss_account?: string;
  exchange_gain_loss_account?: string;
  unrealized_exchange_gain_loss_account?: string;
  round_off_account?: string;
  default_deferred_revenue_account?: string;
  default_deferred_expense_account?: string;
  default_advance_received_account?: string;
  default_advance_paid_account?: string;
  accumulated_depreciation_account?: string;
  depreciation_expense_account?: string;
  disposal_account?: string;
  capital_work_in_progress_account?: string;
  asset_received_but_not_billed?: string;
  cost_center?: string;
  round_off_cost_center?: string;
  depreciation_cost_center?: string;
  default_operating_cost_account?: string;
  default_wip_warehouse?: string;
  default_fg_warehouse?: string;
  default_scrap_warehouse?: string;
  default_warehouse_for_sales_return?: string;
  default_in_transit_warehouse?: string;

  // Monthly / annual metrics
  monthly_sales_target?: number;
  total_monthly_sales?: number;
  sales_monthly_history?: string;
  transactions_annual_history?: string;
  credit_limit?: number;

  docstatus?: number;
}

export interface AccountLookup {
  name: string;
  company: string;
  is_group: number;
  disabled: number;
  account_currency?: string;
  account_type?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface WarehouseTemplate {
  warehouse_name: string;
  is_group: number;
  warehouse_type?: string;
}

export interface DepartmentTemplate {
  department_name: string;
  is_group?: number;
  parent_department?: string;
  company?: string;
}

/* ------------------------------------------------------------------ */
/*  validateCompany                                                    */
/* ------------------------------------------------------------------ */

export function validateCompany(
  doc: CompanyDoc,
  existingDoc?: CompanyDoc,
  accounts?: Map<string, AccountLookup>,
  existingAbbrs?: string[],
  hasStockLedgerEntries?: boolean
): ValidationResult {
  const warnings: string[] = [];

  // Validate abbreviation
  const abbrErr = validateAbbr(doc, existingAbbrs);
  if (abbrErr) return { success: false, error: abbrErr };

  // Validate default accounts
  if (accounts) {
    const accountErr = validateDefaultAccounts(doc, accounts);
    if (accountErr) return { success: false, error: accountErr };
  }

  // Validate currency change
  if (existingDoc && doc.default_currency !== existingDoc.default_currency) {
    return {
      success: false,
      error: "Cannot change company's default currency, because there are existing transactions. Transactions must be cancelled to change the default currency.",
    };
  }

  // Validate COA input
  const coaErr = validateCOAInput(doc);
  if (coaErr) return { success: false, error: coaErr };

  // Validate perpetual inventory
  if (existingDoc) {
    const perpErr = validatePerpetualInventory(doc, existingDoc, hasStockLedgerEntries);
    if (perpErr) return { success: false, error: perpErr };

    const invErr = validateInventoryAccountSettings(doc, existingDoc, hasStockLedgerEntries);
    if (invErr) return { success: false, error: invErr };
  }

  // Validate provisional account for non-stock items
  const provErr = validateProvisionalAccountForNonStockItems(doc);
  if (provErr) return { success: false, error: provErr };

  // Validate parent company
  const parentErr = validateParentCompany(doc);
  if (parentErr) return { success: false, error: parentErr };

  // Set chart of accounts
  setChartOfAccounts(doc);

  // Set reporting currency
  setReportingCurrency(doc);

  // Validate valuation method change
  if (existingDoc) {
    const valErr = cantChangeValuationMethod(doc, existingDoc);
    if (valErr) return { success: false, error: valErr };
  }

  return { success: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  validateAbbr                                                       */
/* ------------------------------------------------------------------ */

export function validateAbbr(doc: CompanyDoc, existingAbbrs?: string[]): string | undefined {
  if (!doc.abbr) {
    doc.abbr = generateAbbr(doc.company_name);
  }
  doc.abbr = doc.abbr.trim();

  if (!doc.abbr) {
    return "Abbreviation is mandatory";
  }

  if (existingAbbrs && existingAbbrs.includes(doc.abbr)) {
    return "Abbreviation already used for another company";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  generateAbbr                                                       */
/* ------------------------------------------------------------------ */

export function generateAbbr(companyName: string): string {
  return companyName
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  getNameWithAbbr                                                    */
/* ------------------------------------------------------------------ */

export function getNameWithAbbr(name: string, companyAbbr: string): string {
  const parts = name.split(" - ");
  if (parts[parts.length - 1].toLowerCase() !== companyAbbr.toLowerCase()) {
    parts.push(companyAbbr);
  }
  return parts.join(" - ");
}

/* ------------------------------------------------------------------ */
/*  validateDefaultAccounts                                            */
/* ------------------------------------------------------------------ */

export function validateDefaultAccounts(
  doc: CompanyDoc,
  accounts: Map<string, AccountLookup>
): string | undefined {
  const accountFields: [string, keyof CompanyDoc][] = [
    ["Default Bank Account", "default_bank_account"],
    ["Default Cash Account", "default_cash_account"],
    ["Default Receivable Account", "default_receivable_account"],
    ["Default Payable Account", "default_payable_account"],
    ["Default Expense Account", "default_expense_account"],
    ["Default Income Account", "default_income_account"],
    ["Stock Received But Not Billed Account", "stock_received_but_not_billed"],
    ["Stock Adjustment Account", "stock_adjustment_account"],
    ["Write Off Account", "write_off_account"],
    ["Default Payment Discount Account", "default_discount_account"],
    ["Unrealized Profit / Loss Account", "unrealized_profit_loss_account"],
    ["Exchange Gain / Loss Account", "exchange_gain_loss_account"],
    ["Unrealized Exchange Gain / Loss Account", "unrealized_exchange_gain_loss_account"],
    ["Round Off Account", "round_off_account"],
    ["Default Deferred Revenue Account", "default_deferred_revenue_account"],
    ["Default Deferred Expense Account", "default_deferred_expense_account"],
    ["Accumulated Depreciation Account", "accumulated_depreciation_account"],
    ["Depreciation Expense Account", "depreciation_expense_account"],
    ["Gain/Loss Account on Asset Disposal", "disposal_account"],
  ];

  for (const [label, field] of accountFields) {
    const accountName = doc[field] as string | undefined;
    if (!accountName) continue;

    const account = accounts.get(accountName);
    if (!account) {
      return `Account ${accountName} does not exist.`;
    }
    if (account.disabled) {
      return `Account ${accountName} is disabled.`;
    }
    if (account.is_group) {
      return `${label}: ${accountName} is a group account.`;
    }
    if (account.company !== doc.company_name) {
      return `Account ${accountName} does not belong to company: ${doc.company_name}`;
    }
    if (account.account_currency && account.account_currency !== doc.default_currency) {
      return `${label} currency must be same as company's default currency. Please select another account.`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateAdvanceAccountCurrency                                     */
/* ------------------------------------------------------------------ */

export function validateAdvanceAccountCurrency(doc: CompanyDoc): string | undefined {
  // Pure logic: caller should pass account currency maps if needed.
  // We do a structural check only.
  if (doc.default_advance_received_account && doc.default_currency) {
    // placeholder: caller validates externally
  }
  if (doc.default_advance_paid_account && doc.default_currency) {
    // placeholder: caller validates externally
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateCOAInput                                                   */
/* ------------------------------------------------------------------ */

export function validateCOAInput(doc: CompanyDoc): string | undefined {
  if (doc.create_chart_of_accounts_based_on === "Existing Company") {
    doc.chart_of_accounts = undefined;
    if (!doc.existing_company) {
      return "Please select Existing Company for creating Chart of Accounts";
    }
  } else {
    doc.existing_company = undefined;
    doc.create_chart_of_accounts_based_on = "Standard Template";
    if (!doc.chart_of_accounts) {
      doc.chart_of_accounts = "Standard";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validatePerpetualInventory                                         */
/* ------------------------------------------------------------------ */

export function validatePerpetualInventory(
  doc: CompanyDoc,
  existingDoc: CompanyDoc,
  hasStockLedgerEntries?: boolean
): string | undefined {
  if (cint(doc.enable_perpetual_inventory) === 1 && !doc.default_inventory_account) {
    // Warning only in pure logic
  }

  if (
    cint(existingDoc.enable_perpetual_inventory) &&
    !cint(doc.enable_perpetual_inventory) &&
    existingDoc.enable_item_wise_inventory_account !== doc.enable_item_wise_inventory_account &&
    hasStockLedgerEntries
  ) {
    return `Cannot disable perpetual inventory, as there are existing Stock Ledger Entries for the company ${doc.company_name}. Please cancel the stock transactions first and try again.`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateInventoryAccountSettings                                   */
/* ------------------------------------------------------------------ */

export function validateInventoryAccountSettings(
  doc: CompanyDoc,
  existingDoc: CompanyDoc,
  hasStockLedgerEntries?: boolean
): string | undefined {
  if (
    existingDoc.enable_item_wise_inventory_account !== doc.enable_item_wise_inventory_account &&
    hasStockLedgerEntries &&
    cint(existingDoc.enable_perpetual_inventory)
  ) {
    return `Cannot enable Item-wise Inventory Account, as there are existing Stock Ledger Entries for the company ${doc.company_name} with Warehouse-wise Inventory Account. Please cancel the stock transactions first and try again.`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateProvisionalAccountForNonStockItems                         */
/* ------------------------------------------------------------------ */

export function validateProvisionalAccountForNonStockItems(doc: CompanyDoc): string | undefined {
  if (
    cint(doc.enable_provisional_accounting_for_non_stock_items) === 1 &&
    !doc.default_provisional_account
  ) {
    return `Set default Provisional Account account for non stock items`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateParentCompany                                              */
/* ------------------------------------------------------------------ */

export function validateParentCompany(doc: CompanyDoc): string | undefined {
  if (doc.parent_company) {
    // Pure logic: caller should verify parent is_group externally
    // We just ensure parent_company != self
    if (doc.parent_company === doc.company_name) {
      return "Parent Company cannot be the same as the company itself.";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  setChartOfAccounts                                                 */
/* ------------------------------------------------------------------ */

export function setChartOfAccounts(doc: CompanyDoc): void {
  if (doc.parent_company) {
    doc.create_chart_of_accounts_based_on = "Existing Company";
    doc.existing_company = doc.parent_company;
  }
}

/* ------------------------------------------------------------------ */
/*  setReportingCurrency                                               */
/* ------------------------------------------------------------------ */

export function setReportingCurrency(doc: CompanyDoc): void {
  if (!doc.reporting_currency) {
    doc.reporting_currency = doc.default_currency;
  }
  if (doc.parent_company) {
    // In pure logic, caller should set parent reporting currency if needed
  }
}

/* ------------------------------------------------------------------ */
/*  cantChangeValuationMethod                                          */
/* ------------------------------------------------------------------ */

export function cantChangeValuationMethod(
  doc: CompanyDoc,
  existingDoc: CompanyDoc
): string | undefined {
  const previous = existingDoc.valuation_method;
  if (previous && previous !== doc.valuation_method) {
    return "Can't change the valuation method, as there are transactions against some items which do not have its own valuation method";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  createDefaultWarehouses                                            */
/* ------------------------------------------------------------------ */

export function createDefaultWarehouses(companyName: string): WarehouseTemplate[] {
  return [
    { warehouse_name: "All Warehouses", is_group: 1 },
    { warehouse_name: "Stores", is_group: 0 },
    { warehouse_name: "Work In Progress", is_group: 0 },
    { warehouse_name: "Finished Goods", is_group: 0 },
    { warehouse_name: "Goods In Transit", is_group: 0, warehouse_type: "Transit" },
  ];
}

/* ------------------------------------------------------------------ */
/*  createDefaultDepartments                                           */
/* ------------------------------------------------------------------ */

export function createDefaultDepartments(companyName: string): DepartmentTemplate[] {
  return [
    { department_name: "All Departments", is_group: 1, parent_department: "" },
    { department_name: "Accounts", parent_department: "All Departments", company: companyName },
    { department_name: "Marketing", parent_department: "All Departments", company: companyName },
    { department_name: "Sales", parent_department: "All Departments", company: companyName },
    { department_name: "Purchase", parent_department: "All Departments", company: companyName },
    { department_name: "Operations", parent_department: "All Departments", company: companyName },
    { department_name: "Production", parent_department: "All Departments", company: companyName },
    { department_name: "Dispatch", parent_department: "All Departments", company: companyName },
    { department_name: "Customer Service", parent_department: "All Departments", company: companyName },
    { department_name: "Human Resources", parent_department: "All Departments", company: companyName },
    { department_name: "Management", parent_department: "All Departments", company: companyName },
    { department_name: "Quality Management", parent_department: "All Departments", company: companyName },
    { department_name: "Research & Development", parent_department: "All Departments", company: companyName },
    { department_name: "Legal", parent_department: "All Departments", company: companyName },
  ];
}

/* ------------------------------------------------------------------ */
/*  createDefaultCostCenters                                           */
/* ------------------------------------------------------------------ */

export interface CostCenterTemplate {
  cost_center_name: string;
  company: string;
  is_group: number;
  parent_cost_center?: string | null;
}

export function createDefaultCostCenters(companyName: string, abbr: string): CostCenterTemplate[] {
  return [
    { cost_center_name: companyName, company: companyName, is_group: 1, parent_cost_center: null },
    { cost_center_name: "Main", company: companyName, is_group: 0, parent_cost_center: `${companyName} - ${abbr}` },
  ];
}

/* ------------------------------------------------------------------ */
/*  getDefaultAccountsMap                                              */
/* ------------------------------------------------------------------ */

export function getDefaultAccountsMap(enablePerpetualInventory?: number): Record<string, string> {
  const accounts: Record<string, string> = {
    default_cash_account: "Cash",
    default_bank_account: "Bank",
    round_off_account: "Round Off",
    accumulated_depreciation_account: "Accumulated Depreciation",
    depreciation_expense_account: "Depreciation",
    capital_work_in_progress_account: "Capital Work in Progress",
    asset_received_but_not_billed: "Asset Received But Not Billed",
    default_expense_account: "Cost of Goods Sold",
  };

  if (enablePerpetualInventory) {
    accounts.stock_received_but_not_billed = "Stock Received But Not Billed";
    accounts.default_inventory_account = "Stock";
    accounts.stock_adjustment_account = "Stock Adjustment";
  }

  return accounts;
}

/* ------------------------------------------------------------------ */
/*  checkIfTransactionsExist                                           */
/* ------------------------------------------------------------------ */

export function checkIfTransactionsExist(
  companyName: string,
  submittedDocTypes: string[]
): boolean {
  return submittedDocTypes.length > 0;
}

/* ------------------------------------------------------------------ */
/*  updateCompanyCurrentMonthSales                                     */
/* ------------------------------------------------------------------ */

export function updateCompanyCurrentMonthSales(
  currentMonthlySales: number,
  newSales: number
): number {
  return flt(currentMonthlySales + newSales, 2);
}

/* ------------------------------------------------------------------ */
/*  getAllTransactionsAnnualHistory                                    */
/* ------------------------------------------------------------------ */

export interface TransactionHistoryEntry {
  transaction_date: string;
  count: number;
}

export function getAllTransactionsAnnualHistory(
  entries: TransactionHistoryEntry[]
): Record<string, number> {
  const out: Record<string, number> = {};
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  for (const entry of entries) {
    const date = new Date(entry.transaction_date);
    if (date > oneYearAgo) {
      const key = entry.transaction_date;
      out[key] = (out[key] || 0) + entry.count;
    }
  }
  return out;
}
