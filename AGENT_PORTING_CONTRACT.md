# Agent Porting Contract — ERPNext Python → Next.js TypeScript + Prisma

## CRITICAL: DO NOT BUILD API WRAPPERS. PORT ACTUAL BUSINESS LOGIC.

### What NOT to do
❌ `frappeInsertDoc("Sales Order", data)` — this is a shell, not logic  
❌ `frappeCallMethod("erpnext.sales_order.calculate_totals")` — this calls Python  
❌ `fetch("http://localhost:9000/api/...")` — this relies on Frappe runtime  

### What TO do
✅ Read the Python file from `/Users/harithoppil/Desktop/game/erp-aries/tmp/erpnext-reference/erpnext/`  
✅ Extract the ACTUAL algorithm (loops, conditionals, math, validations)  
✅ Rewrite it as typed TypeScript functions/classes in Next.js  
✅ Extract DocType schema → add to Prisma schema (non-public schema)  
✅ The logic runs IN Next.js — PostgreSQL is the data store via Prisma  

---

## PostgreSQL Schema Rule

**USE SCHEMA `app` — NEVER `public`.**

In `prisma/schema.prisma`, every model must have:
```prisma
@@schema("app")
```

Example:
```prisma
model SalesOrder {
  id                String   @id @default(cuid())
  name              String   @unique
  customer          String
  transaction_date  DateTime
  delivery_date     DateTime?
  currency          String   @default("AED")
  conversion_rate   Decimal  @default(1.0)
  total_qty         Decimal  @default(0)
  total             Decimal  @default(0)
  net_total         Decimal  @default(0)
  grand_total       Decimal  @default(0)
  rounded_total     Decimal  @default(0)
  discount_amount   Decimal  @default(0)
  apply_discount_on String   @default("Net Total")
  status            String   @default("Draft")
  docstatus         Int      @default(0)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  items             SalesOrderItem[]
  taxes             SalesTaxesAndCharges[]

  @@schema("app")
}
```

The datasource must specify:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["app"]
}
```

---

## Example: Python → TypeScript + Prisma

### Python source:
```python
def calculate_item_values(self):
    for item in self.doc.items:
        item.amount = flt(item.rate * item.qty, item.precision("amount"))
        item.net_amount = item.amount
        self._set_in_company_currency(item, ["rate", "amount", "net_amount"])
```

### TypeScript target:
```typescript
export interface SalesOrderItem {
  item_code: string;
  qty: number;
  rate: number;
  amount: number;
  net_amount: number;
  base_rate: number;
  base_amount: number;
  base_net_amount: number;
}

export function calculateItemValues(
  items: SalesOrderItem[],
  conversionRate: number
): SalesOrderItem[] {
  return items.map((item) => {
    const amount = round(item.rate * item.qty, 2);
    const baseAmount = round(amount * conversionRate, 2);
    return {
      ...item,
      amount,
      net_amount: amount,
      base_rate: round(item.rate * conversionRate, 2),
      base_amount: baseAmount,
      base_net_amount: baseAmount,
    };
  });
}
```

### Prisma schema addition:
```prisma
model SalesOrderItem {
  id              String   @id @default(cuid())
  sales_order_id  String
  item_code       String
  item_name       String?
  description     String?
  qty             Decimal  @default(0)
  rate            Decimal  @default(0)
  amount          Decimal  @default(0)
  net_amount      Decimal  @default(0)
  base_rate       Decimal  @default(0)
  base_amount     Decimal  @default(0)
  base_net_amount Decimal  @default(0)
  discount_amount Decimal  @default(0)
  discount_percentage Decimal @default(0)
  
  sales_order     SalesOrder @relation(fields: [sales_order_id], references: [id])
  
  @@schema("app")
}
```

---

## Architecture

```
[Client] → [Server Action] → [Typed Controller (TS)] → [Prisma] → [PostgreSQL schema: app]
                ↓
         [Validation + Business Logic]
```

Frappe/ERPNext is the REFERENCE ONLY. No runtime dependency.

---

## Type Rules (STRICT)

1. **NO `any`** — except `catch (error: any)`
2. **Every function has explicit return type**
3. **Every parameter has explicit type**
4. **All objects use interfaces**, not inline types
5. **Number precision**: `round(value: number, precision: number): number`
6. **Currency fields**: `Decimal` in Prisma, `number` in TS
7. **Dates**: `DateTime` in Prisma, `Date` in TS

## Prisma Schema Rules

1. **All models have `@@schema("app")`**
2. **Primary key**: `id String @id @default(cuid())` (not auto-increment)
3. **Frappe `name` field**: add `name String @unique` (Frappe's natural key)
4. **DocStatus**: `docstatus Int @default(0)` (0=Draft, 1=Submitted, 2=Cancelled)
5. **Child tables**: separate model with `parent_id` foreign key
6. **Currency amounts**: use `Decimal` not `Float`
7. **Timestamps**: `created_at DateTime @default(now())`, `updated_at DateTime @updatedAt`

## Files to Create/Modify

### Logic Files
| Python Source | TypeScript Target |
|--------------|-------------------|
| `controllers/taxes_and_totals.py` | `lib/erpnext/controllers/taxes-and-totals.ts` |
| `controllers/accounts_controller.py` | `lib/erpnext/controllers/accounts-controller.ts` |
| `controllers/stock_controller.py` | `lib/erpnext/controllers/stock-controller.ts` |
| `controllers/selling_controller.py` | `lib/erpnext/controllers/selling-controller.ts` |
| `controllers/buying_controller.py` | `lib/erpnext/controllers/buying-controller.ts` |
| `stock/doctype/*/ *.py` | `lib/erpnext/controllers/stock-*.ts` |
| `accounts/doctype/*/ *.py` | `lib/erpnext/controllers/accounts-*.ts` |
| `selling/doctype/*/ *.py` | `lib/erpnext/controllers/selling-*.ts` |
| `buying/doctype/*/ *.py` | `lib/erpnext/controllers/buying-*.ts` |
| `projects/doctype/*/ *.py` | `lib/erpnext/controllers/projects-*.ts` |
| `assets/doctype/*/ *.py` | `lib/erpnext/controllers/assets-*.ts` |
| `crm/doctype/*/ *.py` | `lib/erpnext/controllers/crm-*.ts` |
| `manufacturing/doctype/*/ *.py` | `lib/erpnext/controllers/manufacturing-*.ts` |

### Schema File
| Target | Path |
|--------|------|
| Prisma schema | `prisma/schema.prisma` |

---

## Steps for Each Agent

1. **READ** assigned Python file(s) from erpnext-reference
2. **IDENTIFY** core algorithm (ignore Frappe boilerplate: `frappe.get_doc`, `frappe.db.sql`, `frappe.msgprint`, `frappe.get_single_value`)
3. **EXTRACT** pure business logic (math, validation rules, conditional logic)
4. **WRITE** typed TypeScript in target file
5. **EXTRACT** DocType fields and write Prisma model additions
6. **APPEND** Prisma models to `prisma/schema.prisma` with `@@schema("app")`
7. **EXPORT** all public functions, interfaces, and types
8. **SANITY CHECK**: verify `round(100 * 0.05, 2) === 5`

## Agent Assignments

### Agent 1: Core Controllers
- `controllers/taxes_and_totals.py` → `lib/erpnext/controllers/taxes-and-totals.ts`
- `controllers/accounts_controller.py` → `lib/erpnext/controllers/accounts-controller.ts`
- Prisma: SalesOrder, SalesInvoice, PurchaseOrder, PurchaseInvoice, JournalEntry, PaymentEntry

### Agent 2: Stock + Inventory
- `stock/doctype/item/item.py` → `lib/erpnext/controllers/stock-item.ts`
- `stock/doctype/stock_entry/stock_entry.py` → `lib/erpnext/controllers/stock-entry.ts`
- `stock/doctype/bin/bin.py` → `lib/erpnext/controllers/stock-bin.ts`
- `controllers/stock_controller.py` → `lib/erpnext/controllers/stock-controller.ts`
- Prisma: Item, StockEntry, Warehouse, Bin, ItemPrice

### Agent 3: Selling + CRM
- `selling/doctype/sales_order/sales_order.py` → `lib/erpnext/controllers/selling-sales-order.ts`
- `selling/doctype/customer/customer.py` → `lib/erpnext/controllers/selling-customer.ts`
- `selling/doctype/quotation/quotation.py` → `lib/erpnext/controllers/selling-quotation.ts`
- `crm/doctype/lead/lead.py` → `lib/erpnext/controllers/crm-lead.ts`
- `crm/doctype/opportunity/opportunity.py` → `lib/erpnext/controllers/crm-opportunity.ts`
- Prisma: Customer, Lead, Opportunity, Quotation, SalesOrder, Address, Contact

### Agent 4: Buying + Projects + Assets
- `buying/doctype/purchase_order/purchase_order.py` → `lib/erpnext/controllers/buying-purchase-order.ts`
- `buying/doctype/supplier/supplier.py` → `lib/erpnext/controllers/buying-supplier.ts`
- `projects/doctype/project/project.py` → `lib/erpnext/controllers/projects-project.ts`
- `projects/doctype/task/task.py` → `lib/erpnext/controllers/projects-task.ts`
- `assets/doctype/asset/asset.py` → `lib/erpnext/controllers/assets-asset.ts`
- Prisma: Supplier, PurchaseOrder, Project, Task, Timesheet, Asset

### Agent 5: Manufacturing + Setup
- `manufacturing/doctype/bom/bom.py` → `lib/erpnext/controllers/manufacturing-bom.ts`
- `manufacturing/doctype/work_order/work_order.py` → `lib/erpnext/controllers/manufacturing-work-order.ts`
- `setup/doctype/company/company.py` → `lib/erpnext/controllers/setup-company.ts`
- Prisma: BOM, WorkOrder, Company, FiscalYear, CostCenter, Account
