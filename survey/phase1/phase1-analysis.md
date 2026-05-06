# Phase 1 Analysis: Financial Core (CoA + GL + TB + BS + P&L)

> Based on live browser survey of ERPNext at localhost:9000
> Date: 2026-05-06

---

## 1.1 Chart of Accounts

### URL Pattern
`/desk/account` or `/app/account`

### Page Structure
**Left Sidebar:**
- Chart of Accounts (active)
- Chart of Cost Centers
- Account Category
- Accounting Dimension
- Currency
- Currency Exchange
- Finance Book
- Mode of Payment
- Payment Term
- Journal Entry Template
- Terms and Conditions
- Company
- Fiscal Year
- Sales Taxes
- Opening & Closing (COA Importer, Opening Invoice Tool, Accounting Period, FX Revaluation, Period Closing Voucher)

**Main Content — Tree View:**
- Company selector dropdown
- Expand / View / Menu / New buttons
- **Tree Structure (Aries Marine example):**
  ```
  Aries Marine (root)
  ├── Assets (د.إ 0.00 Cr)
  │   ├── Current Assets (د.إ 0.00 Cr)
  │   └── Long Term Assets (د.إ 0.00 Cr)
  ├── Closing And Temporary Accounts (د.إ 0.00 Cr)
  ├── Liabilities (د.إ 0.00 Cr)
  ├── Share Holder Equity (د.إ 0.00 Cr)
  ├── Revenue (د.إ 0.00 Cr)
  └── Expenses (د.إ 0.00 Cr)
  ```

**Per-Node Actions:**
- Edit
- Delete
- Add Child
- View Ledger

### What We Need to Build
1. **Frontend:** `/erp/chart-of-accounts` — tree view with expand/collapse
2. **Backend:** `GET /erp/accounts/tree` — hierarchical account data
3. **Features:** Company filter, Add Child, Edit, Delete, View Ledger drill-down

---

## 1.2 General Ledger

### URL Pattern
`/desk/query-report/General Ledger`

### Filter Panel
| Filter | Type | Required |
|--------|------|----------|
| company | Select | Yes |
| finance_book | Select | No |
| from_date | Date | Yes |
| to_date | Date | Yes |
| account | Account Select | No |
| voucher_no | Text | No |

### Report Columns
| Column | Description |
|--------|-------------|
| Opening | Opening balance for the period |
| Total | Total debits + credits in period |
| Closing (Opening + Total) | Closing balance |

**All values in company currency (AED)**

### What We Need to Build
1. **Frontend:** `/erp/reports/general-ledger` — filter panel + data table
2. **Backend:** `GET /erp/reports/general-ledger?company=&from_date=&to_date=&account=&voucher_no=`
3. **Data needed:** Sum of all debits/credits per account, grouped by voucher

---

## 1.3 Trial Balance

### URL Pattern
`/desk/query-report/Trial Balance`

### Filter Panel
| Filter | Type |
|--------|------|
| company | Select |
| fiscal_year | Select |
| from_date | Date |
| to_date | Date |
| cost_center | Select |
| project | Select |
| finance_book | Select |
| presentation_currency | Currency Select |
| with_period_closing_entry_for_opening | Checkbox |
| with_period_closing_entry_for_current_period | Checkbox |
| show_zero_values | Checkbox |
| show_unclosed_fy_pl_balances | Checkbox |
| include_default_book_entries | Checkbox |
| show_net_values | Checkbox |
| show_group_accounts | Checkbox |

### Report Structure
Shows every account with:
- Opening Balance (Debit / Credit)
- Period Debits
- Period Credits
- Closing Balance (Debit / Credit)

### What We Need to Build
1. **Frontend:** `/erp/reports/trial-balance`
2. **Backend:** `GET /erp/reports/trial-balance` with same filter params
3. **Data needed:** Opening + period movements + closing per account

---

## 1.4 Balance Sheet

### URL Pattern
`/desk/query-report/Balance Sheet`

### Filter Panel
| Filter | Type |
|--------|------|
| company | Select |
| finance_book | Select |
| filter_based_on | Select (Fiscal Year / Date Range) |
| period_start_date | Date |
| period_end_date | Date |
| from_fiscal_year | Select |
| to_fiscal_year | Select |
| periodicity | Select (Monthly / Quarterly / Yearly) |
| presentation_currency | Currency |
| cost_center | Select |
| project | Select |
| report_template | Select |
| show_account_details | Checkbox |
| selected_view | Select |
| accumulated_values | Checkbox |
| include_default_book_entries | Checkbox |
| show_zero_values | Checkbox |

### Report Structure
```
Assets
├── Current Assets
│   ├── Bank Accounts
│   ├── Cash
│   ├── Accounts Receivable
│   └── Stock Assets
├── Fixed Assets
└── Total Assets

Liabilities
├── Current Liabilities
│   ├── Accounts Payable
│   └── Credit Card Accounts
└── Total Liabilities

Equity
├── Stockholders Equity
│   ├── Capital Stock
│   └── Retained Earnings
└── Total Equity

TOTAL LIABILITIES + EQUITY (= Total Assets)
```

### What We Need to Build
1. **Frontend:** `/erp/reports/balance-sheet`
2. **Backend:** `GET /erp/reports/balance-sheet` with filter params
3. **Data needed:** Account balances grouped by Assets / Liabilities / Equity as of a date

---

## 1.5 Profit and Loss (Income Statement)

### URL Pattern
`/desk/query-report/Profit and Loss`

### Filter Panel
Same filter structure as Balance Sheet:
- company, finance_book, filter_based_on, date range / fiscal year, periodicity
- presentation_currency, cost_center, project
- accumulated_values, include_default_book_entries, show_zero_values

### Report Structure
```
Income
├── Revenue
│   ├── Sales Revenue
│   └── Service Revenue
├── Other Income
└── Total Income

Expenses
├── Cost of Goods Sold
├── Operating Expenses
│   ├── Salaries
│   ├── Rent
│   └── Utilities
├── Depreciation
└── Total Expenses

NET PROFIT / LOSS (= Total Income - Total Expenses)
```

### What We Need to Build
1. **Frontend:** `/erp/reports/profit-and-loss`
2. **Backend:** `GET /erp/reports/profit-and-loss`
3. **Data needed:** Income accounts - Expense accounts over a period

---

## Sidebar Integration Plan

### Current Sidebar
```
...
Accounts
...
Reports
...
```

### Proposed Sidebar for Phase 1
```
...
Accounts
  ├── Chart of Accounts      ← NEW
  ├── Journal Entries        ← EXISTING
  ├── Payment Entry          ← EXISTING (moved under Accounts)
  └── Invoices               ← EXISTING

Reports                        ← EXPANDED
  ├── General Ledger         ← NEW
  ├── Trial Balance          ← NEW
  ├── Balance Sheet          ← NEW
  ├── Profit & Loss          ← NEW
  └── Cross-Module Summary   ← EXISTING
```

### Alternative: Flattened Sidebar
```
...
Accounts
  ├── Chart of Accounts
  ├── Journal Entries
  ├── Payment Entry
  └── Invoices

General Ledger
Trial Balance
Balance Sheet
Profit & Loss

Reports
  └── (other cross-module reports)
```

**Recommendation:** Use the flattened approach. Financial reports are so important they deserve top-level sidebar items, not buried under a "Reports" dropdown. This mirrors how ERPNext puts "Balance Sheet" directly in the Financial Reports section.

---

## Database Schema Needed

### Chart of Accounts Table
```sql
accounts (
  id UUID PK,
  account_name VARCHAR(255),
  account_number VARCHAR(50),
  parent_account_id UUID FK -> accounts,
  account_type VARCHAR(50),  -- Asset, Liability, Equity, Income, Expense
  root_type VARCHAR(50),     -- Asset, Liability, Equity, Income, Expense
  is_group BOOLEAN DEFAULT false,
  company_id UUID,
  currency VARCHAR(3) DEFAULT 'AED',
  balance DECIMAL(15,2) DEFAULT 0,
  lft INT, rgt INT,          -- for nested set tree model
  created_at TIMESTAMP
)
```

### General Ledger View
The GL is essentially a query over:
- `journal_entries` (debit/credit entries)
- `sales_invoices` (revenue postings)
- `purchase_invoices` (expense postings)
- `payment_entries` (bank/cash movements)

All posting to accounts.

---

## Build Priority within Phase 1

| Order | Feature | Effort | Impact |
|-------|---------|--------|--------|
| 1 | Chart of Accounts tree view | Medium | Critical — everything else depends on it |
| 2 | General Ledger report | Low | High — just query existing transaction tables |
| 3 | Trial Balance | Low | High — aggregation of GL |
| 4 | Balance Sheet | Medium | Critical — P&L depends on CoA grouping |
| 5 | Profit & Loss | Medium | Critical — mirrors Balance Sheet structure |

**Key insight:** CoA is the foundation. All reports (GL, TB, BS, P&L) are just different views/aggregations of the same underlying transaction data posted to accounts. If we build the CoA model first, the reports follow relatively easily.
