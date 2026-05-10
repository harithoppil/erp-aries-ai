# 4-Agent Frontend Redesign — Prompt Pack

> **Project:** ERPNext Aries (`/Users/harithoppil/Desktop/game/erp-aries/tmp/erp-aries-ai`)
> **Date:** 2026-05-10
> **Reference:** `/Users/harithoppil/Desktop/game/erp-aries/tmp/revolyzz-patterns-reference.md`

---

## Architecture: Why This Is The Right Next.js Approach

This is the standard enterprise ERP frontend pattern for Next.js 14/15:

1. **Dynamic `[doctype]` route** = one page.tsx renders ALL 537 models. No need for 537 static page files.
2. **Server Component First** = page.tsx fetches via the existing REST API (`/api/erpnext/{doctype}`), transforms to client-safe props, renders `<ClientComponent />`. Zero client-side fetching on initial load.
3. **API layer already built** = `/api/erpnext/[doctype]/route.ts` handles list/create/filter/sort/paginate. `/api/erpnext/[doctype]/[name]/route.ts` handles read/update/delete/submit/cancel. The frontend just calls it.
4. **Sidebar is the map** = one comprehensive sidebar.tsx that links every Prisma model to `/dashboard/erp/{doctype-kebab-case}`. The dynamic route handles the rest.
5. **Module dashboards** = 8 landing pages with KPIs (Prisma count/aggregate), charts (Recharts), and link grids. These are the "module home" pages.

The 4 agents work in parallel because they touch **zero overlapping files**:
- Agent 1: `app/dashboard/erp/[doctype]/` (new directory)
- Agent 2: `app/dashboard/erp/[doctype]/[name]/` (new directory)
- Agent 3: `components/desktop/sidebar.tsx` (rewrite)
- Agent 4: `app/dashboard/erp/{module}/dashboard/` (8 new directories)

---

## Codebase Facts (Verified)

| Item | Value |
|------|-------|
| Prisma models | 537 (all use `name` as `@id`) |
| API routes | `app/api/erpnext/[doctype]/route.ts` (GET list, POST create) |
| API routes | `app/api/erpnext/[doctype]/[name]/route.ts` (GET, PUT, DELETE) |
| API routes | `app/api/erpnext/[doctype]/[name]/submit/route.ts` (POST) |
| API routes | `app/api/erpnext/[doctype]/[name]/cancel/route.ts` (POST) |
| API routes | `app/api/erpnext/[doctype]/schema/route.ts` (GET) |
| API response format | `{ success: true, data: T, meta: { page, pageSize, total, hasMore } }` |
| API error format | `{ success: false, error: string, code: string }` |
| Single record GET | `{ success: true, data: { ...record, items: [...], taxes: [...] } }` — child tables MERGED into record |
| shadcn components | 56 in `components/ui/` (button, card, table, tabs, skeleton, badge, dialog, dropdown-menu, select, input, label, pagination, separator, sonner, tooltip, etc.) |
| useMediaQuery hook | `hooks/use-media-query.ts` — returns false during SSR |
| Recharts | v3.8.0 in package.json |
| Prisma client | `lib/prisma.ts` — singleton |
| Next.js params | `Promise<{ doctype: string }>` — must `await params` |
| doctype → URL | PascalCase → kebab-case: `SalesInvoice` → `sales-invoice` |
| doctype → API | same kebab-case: `GET /api/erpnext/sales-invoice` |
| doctype → Prisma accessor | PascalCase → camelCase: `SalesInvoice` → `salesInvoice` |
| Auth | JWT cookie `token` + `getSession()` from `@/lib/frappe-auth` |
| Docstatus | 0=Draft, 1=Submitted, 2=Cancelled |

---

## The 4 Revolyzz Patterns (ALL agents MUST follow)

### Pattern 1: Mobile/Desktop Split
```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
return isMobile ? <MobileView /> : <DesktopView />;
```
No `sm:/lg:` class soup. Completely separate component trees.

### Pattern 2: Skeleton Loading
Dedicated `*Skeleton.tsx` component that mirrors exact layout. Shown while loading. Zero layout shift.

### Pattern 3: Server Component First
`page.tsx` = async server component. Fetch data, auth check, transform Dates to ISO strings, render `<ClientComponent {...props} />`. No `'use client'` in page.tsx.

### Pattern 4: Tabs (Settings Style)
shadcn `Tabs` with controlled state. `TabsList` = `grid grid-cols-N bg-gray-100 rounded-xl p-1`. `TabsTrigger` = `data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg`. `TabsContent` = `className="mt-0"` wrapping a full `Card`.

---

## Agent 1: GenericListBuilder

### Target Directory
`app/dashboard/erp/[doctype]/` — CREATE this directory

### Files to Create

#### 1. `app/dashboard/erp/[doctype]/page.tsx`
Server component that:
- `const { doctype } = await params` (Next.js 15+ params is Promise)
- Calls `fetchDoctypeList(doctype)` from `./actions.ts`
- Transforms data: all Date fields → ISO strings
- Renders `<GenericListClient doctype={doctype} initialData={records} meta={meta} />`
- Handle error: if API returns error, show error UI
- Add `export const dynamic = 'force-dynamic'` at top

#### 2. `app/dashboard/erp/[doctype]/GenericListClient.tsx`
Client component (`'use client'`) that:
- Props: `doctype: string`, `initialData: Record<string, unknown>[]`, `meta: { page: number; pageSize: number; total: number; hasMore: boolean }`
- Uses `useMediaQuery('(max-width: 768px)')` from `@/hooks/use-media-query`
- **Desktop view**: Full data table using shadcn `Table` components
  - Columns: auto-detect from first row's keys (show first 6 columns + "name" always)
  - Sortable column headers (click to toggle asc/desc, calls server action to refetch)
  - Row click → navigate to `/dashboard/erp/${doctype}/${row.name}`
  - Status badge column: docstatus 0=Draft(gray), 1=Submitted(green), 2=Cancelled(red)
- **Mobile view**: Card-based list
  - Each card shows name + 2-3 key fields + status badge
  - Card click → same navigation
- Pagination: Previous/Next buttons + page number display using shadcn `Button`
- Search input: filters on `name` field (debounced, calls server action)
- "+ New" button: links to `/dashboard/erp/${doctype}/new`
- Breadcrumb at top: `ERP > {doctype label}`
- Uses `sonner` toast for notifications
- Loading state: show `<GenericListSkeleton />`

#### 3. `app/dashboard/erp/[doctype]/GenericListSkeleton.tsx`
Skeleton component:
- Mimics the table layout: header row + 5 skeleton body rows
- Uses `Skeleton` from `@/components/ui/skeleton`
- Each skeleton row has 6 columns matching typical widths
- Mobile version shows 5 skeleton cards

#### 4. `app/dashboard/erp/[doctype]/actions.ts`
Server actions (`'use server'`):
```typescript
// Fetch list from internal API
export async function fetchDoctypeList(
  doctype: string,
  params?: { page?: number; pageSize?: number; orderby?: string; order?: 'asc' | 'desc'; filters?: string; search?: string }
): Promise<{ success: true; data: Record<string, unknown>[]; meta: { page: number; pageSize: number; total: number; hasMore: boolean } } | { success: false; error: string }>

// Delete a record
export async function deleteDoctypeRecord(doctype: string, name: string): Promise<{ success: boolean; error?: string }>
```
- `fetchDoctypeList` calls `GET /api/erpnext/${doctype}?fields=name,creation,modified,modified_by,docstatus,owner&limit=${pageSize}&offset=${(page-1)*pageSize}&orderby=${orderby}&order=${order}`
- If `search` is provided, add `filters=[["name","like","%${search}%"]]`
- `deleteDoctypeRecord` calls `DELETE /api/erpnext/${doctype}/${name}`
- Use internal fetch with absolute URL: `http://localhost:3000/api/erpnext/${doctype}` or use `prisma` directly

### API Details (Verified)
- **List endpoint**: `GET /api/erpnext/{doctype}`
  - Query params: `fields` (comma-sep), `filters` (JSON), `limit` (default 20, max 200), `offset`, `orderby`, `order` (asc|desc)
  - Response: `{ success: true, data: [...], meta: { page, pageSize, total, hasMore } }`
- **Delete endpoint**: `DELETE /api/erpnext/{doctype}/{name}` (only draft, docstatus=0)
  - Response: `{ success: true, data: { message, deleted_children } }`

### doctype → URL Conversion
```typescript
function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
// "SalesInvoice" → "sales-invoice"
// "BOM" → "b-o-m" — handle this edge case
```

### Key Rules
- ALL 4 Revolyzz patterns enforced
- Works for ANY of the 537 Prisma models
- Type everything with TypeScript
- Graceful error handling with try/catch
- No `@ts-nocheck`

---

## Agent 2: GenericDetailBuilder

### Target Directory
`app/dashboard/erp/[doctype]/[name]/` — CREATE this directory

### Files to Create

#### 1. `app/dashboard/erp/[doctype]/[name]/page.tsx`
Server component that:
- `const { doctype, name } = await params`
- Calls `fetchDoctypeRecord(doctype, name)` from `./actions.ts`
- If not found, show 404 UI
- Transforms data: all Date fields → ISO strings, Decimal → string
- Identifies child table arrays (arrays of objects with `parent` field)
- Renders `<GenericDetailClient doctype={doctype} record={record} childTables={childTables} />`
- Add `export const dynamic = 'force-dynamic'`

#### 2. `app/dashboard/erp/[doctype]/[name]/GenericDetailClient.tsx`
Client component (`'use client'`) that:
- Props: `doctype: string`, `record: Record<string, unknown>`, `childTables: Record<string, Record<string, unknown>[]>`
- Uses `useMediaQuery('(max-width: 768px)')`
- **Top action bar** (sticky):
  - Back button → `/dashboard/erp/${doctype}`
  - Document title: `{doctype} / {name}`
  - Status badge: Draft/Submitted/Cancelled
  - Edit button (toggles edit mode)
  - If draft: Submit button
  - If submitted: Cancel button
  - Delete button (draft only)
  - Actions dropdown: Print, Email, Duplicate
- **Fields section**:
  - Auto-render ALL scalar fields from record in a responsive grid
  - Desktop: 3-column grid of field groups
  - Mobile: 1-column stack
  - Group into Cards by field prefix or just first N fields per card
  - Read-only by default. When "Edit" clicked, fields become editable inputs
  - Auto-detect input types: string→text, number→number, Date→date picker, boolean→switch, enum→select
  - Skip system fields: `creation`, `modified`, `owner`, `modified_by`, `docstatus`, `idx`, `parent`, `parentfield`, `parenttype`
- **Child Tables section** (for each key in `childTables`):
  - Card with table name as title
  - Desktop: shadcn `Table` with columns auto-detected from first row
  - Mobile: Card list per row
  - Edit mode: "Add Row" and delete buttons per row
- **Bottom tabs** (Pattern 4: Settings-style tabs):
  - Activity Log tab (placeholder)
  - Comments tab (placeholder)
  - Attachments tab (placeholder)
- Toast notifications using `sonner` for all actions
- Loading state: show `<GenericDetailSkeleton />`

#### 3. `app/dashboard/erp/[doctype]/[name]/GenericDetailSkeleton.tsx`
Skeleton component:
- Mimics detail page: header card with title + buttons, 3-column field grid (8-10 skeleton inputs), child table skeleton
- Uses `Skeleton` from `@/components/ui/skeleton`

#### 4. `app/dashboard/erp/[doctype]/[name]/actions.ts`
Server actions (`'use server'`):
```typescript
// Fetch single record
export async function fetchDoctypeRecord(
  doctype: string, name: string
): Promise<{ success: true; data: Record<string, unknown> } | { success: false; error: string }>

// Update record
export async function updateDoctypeRecord(
  doctype: string, name: string, data: Record<string, unknown>
): Promise<{ success: true; data: Record<string, unknown> } | { success: false; error: string }>

// Delete record (draft only)
export async function deleteDoctypeRecord(
  doctype: string, name: string
): Promise<{ success: boolean; error?: string }>

// Submit document (draft → submitted)
export async function submitDoctypeRecord(
  doctype: string, name: string
): Promise<{ success: boolean; error?: string }>

// Cancel document (submitted → cancelled)
export async function cancelDoctypeRecord(
  doctype: string, name: string
): Promise<{ success: boolean; error?: string }>
```

### API Details (Verified)
- **GET single**: `GET /api/erpnext/{doctype}/{name}` → `{ success: true, data: { ...record, items: [...], taxes: [...] } }`
  - Child tables are MERGED into the record object, keyed by `parentfield`
- **PUT update**: `PUT /api/erpnext/{doctype}/{name}` with JSON body of field changes
  - Only works on draft (docstatus=0). Submitted/cancelled return 403.
  - Child table arrays in body: deletes existing rows, re-inserts
- **DELETE**: `DELETE /api/erpnext/{doctype}/{name}` — only draft (docstatus=0)
- **Submit**: `POST /api/erpnext/{doctype}/{name}/submit` → changes docstatus to 1
- **Cancel**: `POST /api/erpnext/{doctype}/{name}/cancel` → changes docstatus to 2

### Key Rules
- ALL 4 Revolyzz patterns enforced
- Works for ANY doctype with ANY fields
- Auto-detect field types and render appropriate inputs
- Child tables auto-render based on data
- Full CRUD: View, Edit, Delete, Submit, Cancel
- Proper TypeScript typing
- Graceful error handling

---

## Agent 3: SidebarBuilder

### Target File
`components/desktop/sidebar.tsx` — REWRITE the entire file

### Goal
Expand the sidebar from ~43 URLs to cover ALL 537 Prisma models organized by module. Each model gets exactly ONE sidebar entry linking to `/dashboard/erp/{kebab-case-doctype}`.

### Requirements

#### Structure
- Preserve existing visual theme: `bg-[#0f172a]` dark sidebar, Lucide icons, accordion behavior
- Preserve collapsed mode (icon-only with tooltips)
- Level 1 modules use accordion — click expands/collapses children
- Each module entry has: icon (Lucide), label, and children array
- Children have: label + href (`/dashboard/erp/{kebab-case-doctype}`)
- Only ONE module expanded at a time (accordion behavior)

#### Module Organization (14 Level 1 modules)
1. **Dashboard** — singleton link to `/dashboard`
2. **Selling** — ~38 models (Customer, Quotation, SalesOrder, SalesInvoice, etc.)
3. **Buying** — ~27 models (Supplier, PurchaseOrder, PurchaseInvoice, MaterialRequest, etc.)
4. **Stock** — ~63 models (Item, Warehouse, StockEntry, DeliveryNote, etc.)
5. **Manufacturing** — ~27 models (BOM, WorkOrder, JobCard, ProductionPlan, etc.)
6. **Projects** — ~16 models (Project, Task, Timesheet, etc.)
7. **Accounting** — ~95 models (Account, JournalEntry, PaymentEntry, etc.)
8. **Assets** — ~28 models (Asset, AssetCategory, DepreciationSchedule, etc.)
9. **Quality** — ~21 models (QualityInspection, QualityGoal, NonConformance, etc.)
10. **CRM** — ~17 models (Lead, Opportunity, Contract, etc.)
11. **Support** — ~12 models (Issue, ServiceLevelAgreement, etc.)
12. **HR** — ~52 models (Employee, LeaveApplication, SalarySlip, etc.)
13. **Organization** — ~14 models (Company, Department, Branch, etc.)
14. **Settings** — settings models (AccountsSettings, StockSettings, etc.)

#### Kebab-Case Helper
```typescript
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
```

#### Module Sub-Grouping
Within each module, group children by category using a separator or sub-header:
- Main documents first (e.g., Customer, SalesOrder)
- Child/line items grouped together (SalesOrderItem next to SalesOrder)
- Settings/Configuration last
- Use a subtle divider between groups

#### Child Table Handling
Child table models (those with parent/parentfield/parenttype) should be grouped with their parent. For example:
- `SalesOrder` + `SalesOrderItem` appear together under "Sales Order"
- The child table entry can link to a filtered view or just be for navigation

#### Deduplication Rules
- Each model appears ONCE in the sidebar
- If a model fits multiple modules (e.g., Department appears in HR and Organization), pick the most relevant one
- Shared doctypes (Item appears in Selling, Buying, Stock) → put under Stock (the master module for items)
- Settings models → all go under Settings module
- Reports are not separate models → they're views on existing data

#### Implementation Notes
- This will be a large file (~2000+ lines) — that's expected
- Use the existing `NAV_GROUPS` structure as the base pattern
- Keep all existing imports (Lucide icons, Link, etc.)
- Keep the user card footer (avatar + name + role + sign out)
- Keep the toggle button (collapse/expand)
- Keep framer-motion animations if they exist

### Full Model List by Module

**SELLING (~38 models)**:
Customer, CustomerGroup, Quotation, QuotationItem, SalesOrder, SalesOrderItem, SalesInvoice, SalesInvoiceItem, SalesInvoiceAdvance, SalesInvoicePayment, SalesInvoiceReference, SalesInvoiceTimesheet, BlanketOrder, BlanketOrderItem, ShippingRule, ShippingRuleCondition, ShippingRuleCountry, CouponCode, LoyaltyProgram, LoyaltyProgramCollection, LoyaltyPointEntry, LoyaltyPointEntryRedemption, Campaign, CampaignItem, CampaignEmailSchedule, POSProfile, PosProfileUser, PosSettings, PosOpeningEntry, PosOpeningEntryDetail, PosClosingEntry, PosClosingEntryDetail, PosClosingEntryTaxes, PosInvoice, PosInvoiceItem, PosInvoiceReference, PosInvoiceMergeLog, ProductBundle, ProductBundleItem, SalesPartner, SalesTeam, Territory

**BUYING (~27 models)**:
Supplier, SupplierQuotation, SupplierQuotationItem, PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoiceAdvance, PurchaseReceipt, PurchaseReceiptItem, MaterialRequest, MaterialRequestItem, RequestForQuotation, RequestForQuotationItem, RequestForQuotationSupplier, PurchaseTaxesAndChargesTemplate, PurchaseTaxesAndCharges, SupplierGroup, Incoterm

**STOCK (~63 models)**:
Item, ItemAttribute, ItemAttributeValue, ItemBarcode, ItemDefault, ItemGroup, ItemLeadTime, ItemManufacturer, ItemPrice, ItemReorder, ItemSupplier, ItemTax, ItemVariant, ItemVariantAttribute, StockEntry, StockEntryDetail, DeliveryNote, DeliveryNoteItem, PickList, PickListItem, Bin, SerialNo, Batch, SerialAndBatchBundle, StockLedgerEntry, StockReconciliation, StockReconciliationItem, Warehouse, LandedCostVoucher, LandedCostItem, PackingSlip, PackingSlipItem, DeliveryTrip, DeliveryStop, Brand, Uom, UomConversionDetail

**MANUFACTURING (~27 models)**:
BOM, BOMItem, BOMOperation, BOMExplosionItem, WorkOrder, WorkOrderItem, WorkOrderOperation, JobCard, JobCardItem, JobCardOperation, JobCardTimeLog, ProductionPlan, ProductionPlanItem, Workstation, WorkstationType, Operation, Routing, DowntimeEntry, PlantFloor

**ACCOUNTING (~95 models)**:
Account, JournalEntry, JournalEntryAccount, PaymentEntry, PaymentEntryDeduction, PaymentEntryReference, PaymentOrder, PaymentOrderReference, PaymentReconciliation, GlEntry, FiscalYear, Company, CostCenter, CostCenterAllocation, AccountingDimension, AccountingPeriod, FinanceBook, Currency, CurrencyExchange, Budget, BudgetAccount, SalesTaxesAndChargesTemplate, SalesTaxesAndCharges, PurchaseTaxesAndChargesTemplate, PurchaseTaxesAndCharges, ItemTaxTemplate, TaxCategory, TaxRule, TaxWithholdingCategory, AccountCategory, PeriodClosingVoucher, Bank, BankAccount, BankTransaction, Shareholder, ShareTransfer, Subscription, SubscriptionPlan

**PROJECTS (~16 models)**:
Project, ProjectTemplate, ProjectTemplateTask, ProjectType, ProjectUpdate, Task, DependentTask, Timesheet, TimesheetDetail, ActivityType, ActivityCost

**ASSETS (~28 models)**:
Asset, AssetCategory, AssetCategoryAccount, AssetDepreciationSchedule, DepreciationSchedule, AssetFinanceBook, AssetCapitalization, AssetCapitalizationAssetItem, AssetCapitalizationServiceItem, AssetCapitalizationStockItem, AssetMaintenance, AssetMaintenanceLog, AssetMaintenanceTask, AssetMaintenanceTeam, AssetMovement, AssetMovementItem, AssetRepair, AssetValueAdjustment, Location

**QUALITY (~21 models)**:
QualityInspection, QualityInspectionParameter, QualityInspectionReading, QualityInspectionTemplate, QualityGoal, QualityGoalObjective, QualityProcedure, QualityProcedureProcess, QualityReview, QualityReviewObjective, QualityAction, QualityActionResolution, NonConformance, QualityFeedback, QualityFeedbackParameter, QualityFeedbackTemplate, QualityMeeting, QualityMeetingAgenda, QualityMeetingMinutes

**CRM (~17 models)**:
Lead, LeadSource, Opportunity, OpportunityItem, OpportunityLostReason, OpportunityType, Prospect, ProspectLead, MarketSegment, IndustryType, Contract, ContractFulfilmentChecklist, ContractTemplate, Appointment, AppointmentBookingSettings, EmailCampaign

**SUPPORT (~12 models)**:
Issue, IssuePriority, IssueType, ServiceLevelAgreement, ServiceLevelPriority, WarrantyClaim, MaintenanceSchedule, MaintenanceScheduleDetail, MaintenanceVisit, MaintenanceVisitPurpose

**HR (~52 models)**:
Employee, EmployeeEducation, EmployeeExternalWorkHistory, EmployeeInternalWorkHistory, EmployeeGroup, Designation, Holiday, HolidayList, LeaveType, LeaveAllocation, LeaveApplication, LeaveLedgerEntry, LeavePeriod, LeavePolicy, LeavePolicyAssignment, Attendance, AttendanceRequest, SalaryStructure, SalaryStructureAssignment, SalarySlip, SalaryComponent, PayrollEntry, PayrollPeriod, ExpenseClaim, ExpenseClaimDetail, TrainingProgram, TrainingEvent, TrainingResult, TrainingFeedback, Appraisal, AppraisalTemplate, AppraisalGoal, JobOpening, JobApplicant, JobOffer, ShiftType, ShiftAssignment, ShiftRequest, Vehicle, VehicleLog

**ORGANIZATION (~14 models)**:
Company, Department, Branch, EmailAccount, EmailDomain, EmailTemplate, LetterHead, TermsAndConditions, PrintFormat, PrintStyle

**SETTINGS (~12 models)**:
AccountsSettings, SellingSettings, BuyingSettings, StockSettings, ManufacturingSettings, ProjectsSettings, CrmSettings, SupportSettings, GlobalDefaults, SystemSettings, Currency, FiscalYear

### Key Rules
- Preserve existing visual theme and animations
- Each model → exactly one entry → one URL
- Use `toKebabCase()` for URL generation
- Parent-child models grouped together
- Settings last in every module
- Lucide icons for each module header
- Keep collapsed mode working
- Keep user card footer

---

## Agent 4: ModuleDashboardBuilder

### Target Directories
Create 8 module dashboard directories, each with 2 files (16 files total).

### Files to Create

For each of the 8 modules, create:
- `app/dashboard/erp/{module}/dashboard/page.tsx` (server component)
- `app/dashboard/erp/{module}/dashboard/DashboardClient.tsx` (client component)

### Modules

1. **Selling**: `/dashboard/erp/selling/dashboard/`
2. **Buying**: `/dashboard/erp/buying/dashboard/`
3. **Stock**: `/dashboard/erp/stock/dashboard/`
4. **Manufacturing**: `/dashboard/erp/manufacturing/dashboard/`
5. **Accounting**: `/dashboard/erp/accounting/dashboard/`
6. **Projects**: `/dashboard/erp/projects/dashboard/`
7. **Assets**: `/dashboard/erp/assets/dashboard/`
8. **Quality**: `/dashboard/erp/quality/dashboard/`

### Pattern for Each Dashboard

#### Server Component (`page.tsx`)
```typescript
// Example: Selling Dashboard
import { prisma } from '@/lib/prisma';
import SellingDashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function SellingDashboardPage() {
  const [totalCustomers, totalQuotations, totalSalesOrders, totalInvoices] = await Promise.all([
    prisma.customer.count(),
    prisma.quotation.count(),
    prisma.salesOrder.count(),
    prisma.salesInvoice.count(),
  ]);

  // Monthly data for charts (last 12 months)
  const monthlyData = await getMonthlyCounts('quotation'); // helper

  const kpis = {
    customers: totalCustomers,
    quotations: totalQuotations,
    salesOrders: totalSalesOrders,
    invoices: totalInvoices,
  };

  // Transform dates to ISO strings for client safety
  const chartData = monthlyData.map(d => ({
    ...d,
    month: d.month, // already a string
  }));

  return <SellingDashboardClient kpis={kpis} chartData={chartData} />;
}
```

- Use `prisma` directly from `@/lib/prisma` (server component, no API needed)
- Fetch 3-4 KPI counts using `prisma.{model}.count()`
- Fetch monthly chart data using `prisma.{model}.groupBy()` with date filters
- Transform ALL values to plain objects (no Date, no Decimal)
- Graceful error handling with try/catch, return empty data on error

#### Monthly Data Helper Pattern
```typescript
async function getMonthlyCounts(modelAccessor: string): Promise<{ month: string; count: number }[]> {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const count = await (prisma as any)[modelAccessor].count({
      where: { creation: { gte: start, lte: end } }
    });
    months.push({
      month: start.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      count
    });
  }
  return months;
}
```

#### Client Component (`DashboardClient.tsx`)
- Uses `useMediaQuery('(max-width: 768px)')` from `@/hooks/use-media-query`
- **Layout**:
  1. Breadcrumb: `ERP > {Module Name}`
  2. KPI Cards Row (3-4 cards):
     - Each: title, count, small trend icon, click → navigates to list page
     - Desktop: horizontal row of cards
     - Mobile: vertical stack
  3. Chart Card:
     - Desktop: LineChart or BarChart (Recharts)
     - Mobile: simplified chart or just the KPI cards
     - Empty state if no data
  4. Reports & Masters Grid:
     - 3 columns desktop, 1 column mobile
     - Category cards with links to `/dashboard/erp/{doctype-kebab-case}`
     - Each link: icon + label

### Module-Specific KPIs

**Selling**: customers, quotations, salesOrders, salesInvoices
**Buying**: suppliers, purchaseOrders, purchaseInvoices, materialRequests
**Stock**: items, warehouses, stockEntries, deliveryNotes
**Manufacturing**: workOrders, bOM, jobCards, productionPlans
**Accounting**: accounts, journalEntries, paymentEntries, fiscalYears
**Projects**: projects, tasks, timesheets, activityTypes
**Assets**: assets, assetCategories, assetDepreciationSchedules, assetMaintenances
**Quality**: qualityInspections, qualityGoals, qualityReviews, nonConformances

### Module Link Grids

Each dashboard shows link cards organized by category:

**Selling**: Customer, Customer Group, Quotation, Sales Order, Sales Invoice, Blanket Order, Shipping Rule, Coupon Code, Loyalty Program, POS Profile, Product Bundle, Sales Partner, Territory, Campaign

**Buying**: Supplier, Supplier Group, Request for Quotation, Supplier Quotation, Purchase Order, Purchase Invoice, Material Request, Purchase Receipt, Incoterm

**Stock**: Item, Item Group, Item Attribute, Brand, UOM, Warehouse, Stock Entry, Delivery Note, Purchase Receipt, Pick List, Stock Reconciliation, Landed Cost Voucher, Serial No, Batch, Packing Slip

**Manufacturing**: BOM, Work Order, Production Plan, Job Card, Workstation, Operation, Routing, Downtime Entry, Plant Floor

**Accounting**: Account, Journal Entry, Payment Entry, Payment Order, Fiscal Year, Company, Cost Center, Budget, Bank, Bank Account, Sales Tax Template, Purchase Tax Template, Currency, Period Closing Voucher, Subscription

**Projects**: Project, Project Template, Task, Timesheet, Activity Type, Activity Cost

**Assets**: Asset, Asset Category, Asset Depreciation Schedule, Asset Capitalization, Asset Movement, Asset Maintenance, Asset Repair, Location

**Quality**: Quality Inspection, Quality Goal, Quality Procedure, Quality Review, Quality Action, Non Conformance, Quality Feedback, Quality Meeting

### Charts
Use Recharts (v3.8.0, already in project):
```typescript
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
```

### Key Rules
- ALL 4 Revolyzz patterns enforced
- Server component fetches via Prisma, passes plain data to client
- Dates → ISO strings, Decimals → numbers/strings before passing to client
- Chart shows empty state if no data
- KPI cards link to their list pages
- Mobile/desktop completely different component trees
- Graceful error handling

---

## File Ownership (Zero Overlap)

| Agent | Creates/Modifies | Approximate Files |
|-------|-----------------|-------------------|
| 1. GenericListBuilder | `app/dashboard/erp/[doctype]/` | 4 new files |
| 2. GenericDetailBuilder | `app/dashboard/erp/[doctype]/[name]/` | 4 new files |
| 3. SidebarBuilder | `components/desktop/sidebar.tsx` | 1 rewrite |
| 4. ModuleDashboardBuilder | `app/dashboard/erp/{8 modules}/dashboard/` | 16 new files |

**Total: 25 files, zero conflicts, all parallelizable.**
