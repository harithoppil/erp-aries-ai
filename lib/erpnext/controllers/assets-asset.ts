/**
 * ERPNext Asset DocType — Pure Business Logic (ported from asset.py)
 *
 * All functions are pure: they accept plain objects and return
 * updated objects / validation results.  No DB calls.
 */

export interface AssetFinanceBook {
  finance_book?: string | null;
  depreciation_method: string;
  total_number_of_depreciations: number;
  frequency_of_depreciation: number;
  rate_of_depreciation: number;
  expected_value_after_useful_life: number;
  value_after_depreciation: number;
  depreciation_start_date?: Date | string | null;
  daily_prorata_based?: boolean;
  shift_based?: boolean;
  salvage_value_percentage?: number;
  total_number_of_booked_depreciations?: number;
  idx?: number;
  increase_in_asset_life?: number;
}

export interface Asset {
  name: string;
  docstatus: number;
  status: string;
  asset_name: string;
  asset_category?: string | null;
  item_code: string;
  item_name?: string | null;
  company: string;
  asset_type: "" | "Existing Asset" | "Composite Asset" | "Composite Component";
  asset_owner: "" | "Company" | "Supplier" | "Customer";
  asset_owner_company?: string | null;
  asset_quantity: number;
  purchase_date: Date | string;
  purchase_amount: number;
  net_purchase_amount: number;
  additional_asset_cost: number;
  total_asset_cost: number;
  available_for_use_date?: Date | string | null;
  location: string;
  custodian?: string | null;
  department?: string | null;
  cost_center?: string | null;
  calculate_depreciation: boolean;
  default_finance_book?: string | null;
  opening_accumulated_depreciation: number;
  opening_number_of_booked_depreciations: number;
  value_after_depreciation: number;
  is_fully_depreciated: boolean;
  booked_fixed_asset: boolean;
  purchase_invoice?: string | null;
  purchase_receipt?: string | null;
  purchase_invoice_item?: string | null;
  purchase_receipt_item?: string | null;
  supplier?: string | null;
  customer?: string | null;
  disposal_date?: Date | string | null;
  journal_entry_for_scrap?: string | null;
  split_from?: string | null;
  maintenance_required: boolean;
  comprehensive_insurance?: string | null;
  insured_value?: string | null;
  insurer?: string | null;
  insurance_start_date?: Date | string | null;
  insurance_end_date?: Date | string | null;
  policy_number?: string | null;
  image?: string | null;
  depr_entry_posting_status?: string | null;
  naming_series?: string | null;
  finance_books: AssetFinanceBook[];
  // flags
  flags?: Record<string, boolean>;
}

export interface DepreciationScheduleRow {
  schedule_date: Date | string;
  depreciation_amount: number;
  accumulated_depreciation_amount: number;
  journal_entry?: string | null;
}

export interface AssetDepreciationScheduleDoc {
  name?: string;
  asset: string;
  finance_book?: string | null;
  status?: string;
  net_purchase_amount: number;
  opening_accumulated_depreciation: number;
  opening_number_of_booked_depreciations: number;
  depreciation_method: string;
  total_number_of_depreciations: number;
  frequency_of_depreciation: number;
  expected_value_after_useful_life: number;
  depreciation_schedule?: DepreciationScheduleRow[];
}

export interface AssetCategoryAccount {
  company_name: string;
  fixed_asset_account?: string | null;
  accumulated_depreciation_account?: string | null;
  depreciation_expense_account?: string | null;
  capital_work_in_progress_account?: string | null;
  idx?: number;
}

export interface AssetCategory {
  name: string;
  asset_category_name: string;
  enable_cwip_accounting: boolean;
  non_depreciable_category: boolean;
  accounts: AssetCategoryAccount[];
  finance_books: AssetCategoryFinanceBook[];
}

export interface AssetCategoryFinanceBook {
  finance_book?: string | null;
  depreciation_method: string;
  total_number_of_depreciations: number;
  frequency_of_depreciation: number;
  daily_prorata_based?: boolean;
  shift_based?: boolean;
  salvage_value_percentage?: number;
  expected_value_after_useful_life?: number;
  depreciation_start_date?: Date | string | null;
  rate_of_depreciation?: number;
  idx?: number;
}

export interface CompanyAccountDefaults {
  capital_work_in_progress_account?: string | null;
  accumulated_depreciation_account?: string | null;
  depreciation_expense_account?: string | null;
  depreciation_cost_center?: string | null;
}

export interface ItemDetails {
  is_fixed_asset?: boolean;
  is_stock_item?: boolean;
  disabled?: boolean;
  asset_category?: string | null;
}

export interface ValidationResult {
  asset: Asset;
  errors: string[];
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function toDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function flt(val: number | string | null | undefined, precision?: number): number {
  const num = typeof val === "string" ? parseFloat(val) : val ?? 0;
  if (precision !== undefined) {
    return parseFloat(num.toFixed(precision));
  }
  return num;
}

function cint(val: number | string | boolean | null | undefined): number {
  if (val === true) return 1;
  if (val === false) return 0;
  const num = typeof val === "string" ? parseInt(val, 10) : val ?? 0;
  return isNaN(num) ? 0 : num;
}

function getLastDay(date: Date | string): Date {
  const d = toDate(date);
  if (!d) throw new Error("Invalid date");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/* ────────────────────────────────────────────────────────────────
   Validation
   ──────────────────────────────────────────────────────────────── */

export function validateAsset(
  asset: Asset,
  itemDetails: ItemDetails,
  assetCategory: AssetCategory,
  companyDefaults: CompanyAccountDefaults,
  purchaseDocCompany?: string | null,
  isCwipEnabled?: boolean
): ValidationResult {
  const errors: string[] = [];

  const pushError = (msg: string) => errors.push(msg);

  try {
    validateCategory(asset, assetCategory, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validatePrecision(asset);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateLinkedPurchaseDocuments(asset, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateAssetValues(asset, itemDetails, isCwipEnabled ?? false, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateAssetAndReference(asset, purchaseDocCompany, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateItem(itemDetails, asset.item_code, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateCostCenter(asset, companyDefaults, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateGrossAndPurchaseAmount(asset, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    validateFinanceBooks(asset, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  let a = setMissingValues(asset, itemDetails, assetCategory);
  a = beforeSave(a);

  return { asset: a, errors };
}

/* ────────────────────────────────────────────────────────────────
   before_save
   ──────────────────────────────────────────────────────────────── */

export function beforeSave(asset: Asset): Asset {
  const a = { ...asset };
  a.total_asset_cost = flt(a.net_purchase_amount) + flt(a.additional_asset_cost);
  a.status = getAssetStatus(a);
  return a;
}

/* ────────────────────────────────────────────────────────────────
   Status
   ──────────────────────────────────────────────────────────────── */

export function getAssetStatus(asset: Asset): string {
  if (asset.docstatus === 0) {
    if (asset.asset_type === "Composite Asset") return "Work In Progress";
    return "Draft";
  }

  if (asset.docstatus === 1) {
    let status = "Submitted";

    if (asset.journal_entry_for_scrap) {
      status = "Scrapped";
    } else {
      let expectedValueAfterUsefulLife = 0;
      let valueAfterDepreciation = asset.value_after_depreciation;

      if (asset.calculate_depreciation) {
        const idx = getDefaultFinanceBookIdx(asset);
        const fb = asset.finance_books[idx ?? 0];
        if (fb) {
          expectedValueAfterUsefulLife = flt(fb.expected_value_after_useful_life);
          valueAfterDepreciation = flt(fb.value_after_depreciation);
        }

        if (flt(valueAfterDepreciation) <= expectedValueAfterUsefulLife) {
          status = "Fully Depreciated";
        } else if (flt(valueAfterDepreciation) < flt(asset.net_purchase_amount)) {
          status = "Partially Depreciated";
        }
      } else if (asset.is_fully_depreciated) {
        status = "Fully Depreciated";
      }
    }
    return status;
  }

  if (asset.docstatus === 2) {
    return "Cancelled";
  }

  return asset.status;
}

export function getDefaultFinanceBookIdx(asset: Asset): number | null {
  if (!asset.default_finance_book) return null;
  for (let i = 0; i < asset.finance_books.length; i++) {
    if (asset.finance_books[i].finance_book === asset.default_finance_book) {
      return i;
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
   Depreciation Rate
   ──────────────────────────────────────────────────────────────── */

export function getDepreciationRate(
  args: AssetFinanceBook,
  netPurchaseAmount: number,
  openingAccumulatedDepreciation: number,
  openingNumberOfBookedDepreciations: number,
  onValidate: boolean = false,
  floatPrecision: number = 2
): number {
  if (args.depreciation_method === "Double Declining Balance") {
    return getDoubleDecliningBalanceRate(args, floatPrecision);
  }
  if (args.depreciation_method === "Written Down Value") {
    return getWrittenDownValueRate(
      args,
      netPurchaseAmount,
      openingAccumulatedDepreciation,
      openingNumberOfBookedDepreciations,
      floatPrecision,
      onValidate
    );
  }
  return args.rate_of_depreciation ?? 0;
}

export function getDoubleDecliningBalanceRate(
  args: AssetFinanceBook,
  rateFieldPrecision: number
): number {
  const rate =
    200.0 /
    ((flt(args.total_number_of_depreciations, 2) * flt(args.frequency_of_depreciation)) / 12);
  return flt(rate, rateFieldPrecision);
}

export function getWrittenDownValueRate(
  args: AssetFinanceBook,
  netPurchaseAmount: number,
  openingAccumulatedDepreciation: number,
  openingNumberOfBookedDepreciations: number,
  rateFieldPrecision: number,
  onValidate: boolean
): number {
  if (args.rate_of_depreciation && onValidate) {
    return args.rate_of_depreciation;
  }

  if (args.rate_of_depreciation && !flt(args.expected_value_after_useful_life)) {
    return args.rate_of_depreciation;
  }

  const currentAssetValue = flt(args.value_after_depreciation)
    ? flt(args.value_after_depreciation)
    : flt(netPurchaseAmount) - flt(openingAccumulatedDepreciation);

  const value = flt(args.expected_value_after_useful_life) / currentAssetValue;

  const pendingNumberOfDepreciations =
    flt(args.total_number_of_depreciations, 2) -
    flt(openingNumberOfBookedDepreciations) -
    flt(args.total_number_of_booked_depreciations ?? 0);

  const pendingYears =
    (pendingNumberOfDepreciations * flt(args.frequency_of_depreciation) +
      cint(args.increase_in_asset_life ?? 0)) /
    12;

  if (pendingYears <= 0) return 0;

  const depreciationRate = 100 * (1 - Math.pow(value, 1.0 / pendingYears));
  return flt(depreciationRate, rateFieldPrecision);
}

/* ────────────────────────────────────────────────────────────────
   Depreciation Schedule Change Detection
   ──────────────────────────────────────────────────────────────── */

export function hasAssetDetailsChanged(
  asset: Asset,
  existingDoc: AssetDepreciationScheduleDoc
): boolean {
  return (
    flt(asset.net_purchase_amount) !== flt(existingDoc.net_purchase_amount) ||
    flt(asset.opening_accumulated_depreciation) !==
      flt(existingDoc.opening_accumulated_depreciation) ||
    cint(asset.opening_number_of_booked_depreciations) !==
      cint(existingDoc.opening_number_of_booked_depreciations)
  );
}

export function hasDepreciationSettingsChanged(
  fbRow: AssetFinanceBook,
  existingDoc: AssetDepreciationScheduleDoc
): boolean {
  if (!existingDoc.depreciation_schedule || fbRow.depreciation_method !== "Manual") {
    return true;
  }

  const firstScheduleDate = existingDoc.depreciation_schedule[0]?.schedule_date;

  return (
    fbRow.depreciation_method !== existingDoc.depreciation_method ||
    fbRow.total_number_of_depreciations !== existingDoc.total_number_of_depreciations ||
    fbRow.frequency_of_depreciation !== existingDoc.frequency_of_depreciation ||
    (firstScheduleDate && toDate(fbRow.depreciation_start_date)?.getTime() !== toDate(firstScheduleDate)?.getTime()) ||
    flt(fbRow.expected_value_after_useful_life) !== flt(existingDoc.expected_value_after_useful_life)
  );
}

export function shouldRegenerateDepreciationSchedule(
  existingDoc: AssetDepreciationScheduleDoc,
  assetDetailsChanged: boolean,
  depreciationSettingsChanged: boolean
): boolean {
  if (!existingDoc.depreciation_schedule || existingDoc.depreciation_schedule.length === 0) {
    return true;
  }
  if (assetDetailsChanged || depreciationSettingsChanged) {
    return true;
  }
  return false;
}

/* ────────────────────────────────────────────────────────────────
   Value After Depreciation
   ──────────────────────────────────────────────────────────────── */

export function setDepreciationRateAndValueAfterDepreciation(asset: Asset): Asset {
  const a = { ...asset };
  if (a.split_from) return a;

  a.value_after_depreciation =
    flt(a.net_purchase_amount) -
    flt(a.opening_accumulated_depreciation) +
    flt(a.additional_asset_cost);

  if (a.calculate_depreciation) {
    a.finance_books = a.finance_books.map((fb) => ({
      ...fb,
      value_after_depreciation: a.value_after_depreciation,
    }));
  } else {
    a.finance_books = [];
  }

  return a;
}

export function getValueAfterDepreciation(
  asset: Asset,
  financeBook?: string | null
): number {
  if (!asset.calculate_depreciation) {
    return flt(asset.value_after_depreciation);
  }
  if (!financeBook) {
    return flt(asset.finance_books[0]?.value_after_depreciation);
  }
  for (const row of asset.finance_books) {
    if (row.finance_book === financeBook) {
      return flt(row.value_after_depreciation);
    }
  }
  return flt(asset.finance_books[0]?.value_after_depreciation);
}

/* ────────────────────────────────────────────────────────────────
   Finance Book Validation
   ──────────────────────────────────────────────────────────────── */

export function validateFinanceBooks(asset: Asset, onError?: (msg: string) => void): void {
  if (!asset.calculate_depreciation || asset.finance_books.length <= 1) return;

  const financeBooks = new Set<string>();
  for (const d of asset.finance_books) {
    if (financeBooks.has(d.finance_book ?? "")) {
      const msg = `Row #${d.idx ?? 0}: Please use a different Finance Book.`;
      if (onError) onError(msg);
      else throw new Error(msg);
    } else {
      financeBooks.add(d.finance_book ?? "");
    }

    if (!d.finance_book) {
      const msg = `Row #${d.idx ?? 0}: Finance Book should not be empty since you're using multiple.`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  }
}

export function validateAssetFinanceBooks(
  asset: Asset,
  row: AssetFinanceBook,
  onError?: (msg: string) => void
): void {
  const precision = 2; // net_purchase_amount precision
  row.expected_value_after_useful_life = flt(row.expected_value_after_useful_life, precision);

  if (flt(row.expected_value_after_useful_life) < 0) {
    const msg = `Row ${row.idx ?? 0}: Expected Value After Useful Life cannot be negative`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (flt(row.expected_value_after_useful_life) >= flt(asset.net_purchase_amount)) {
    const msg = `Row ${row.idx ?? 0}: Expected Value After Useful Life must be less than Net Purchase Amount`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (!row.depreciation_start_date) {
    row.depreciation_start_date = getLastDay(asset.available_for_use_date ?? new Date());
  }

  validateDepreciationStartDate(asset, row, onError);
  validateTotalNumberOfDepreciationsAndFrequency(row, onError);

  if (asset.asset_type !== "Existing Asset") {
    asset.opening_accumulated_depreciation = 0;
    asset.opening_number_of_booked_depreciations = 0;
  } else {
    validateOpeningDepreciationValues(asset, row, onError);
  }
}

export function validateOpeningDepreciationValues(
  asset: Asset,
  row: AssetFinanceBook,
  onError?: (msg: string) => void
): void {
  const precision = 2;
  row.expected_value_after_useful_life = flt(row.expected_value_after_useful_life, precision);
  const depreciableAmount = flt(
    flt(asset.net_purchase_amount) - flt(row.expected_value_after_useful_life),
    precision
  );

  if (flt(asset.opening_accumulated_depreciation) > depreciableAmount) {
    const msg = `Row #${row.idx ?? 0}: Opening Accumulated Depreciation must be less than or equal to ${depreciableAmount}`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (asset.opening_accumulated_depreciation) {
    if (!asset.opening_number_of_booked_depreciations) {
      const msg = "Please set opening number of booked depreciations";
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  } else {
    asset.opening_number_of_booked_depreciations = 0;
  }

  if (flt(row.total_number_of_depreciations) <= cint(asset.opening_number_of_booked_depreciations)) {
    const msg = `Row #${row.idx ?? 0}: Total Number of Depreciations cannot be less than or equal to Opening Number of Booked Depreciations`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateTotalNumberOfDepreciationsAndFrequency(
  row: AssetFinanceBook,
  onError?: (msg: string) => void
): void {
  if (row.total_number_of_depreciations <= 0) {
    const msg = `Row #${row.idx ?? 0}: Total Number of Depreciations must be greater than zero`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
  if (row.frequency_of_depreciation <= 0) {
    const msg = `Row #${row.idx ?? 0}: Frequency of Depreciation must be greater than zero`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateDepreciationStartDate(
  asset: Asset,
  row: AssetFinanceBook,
  onError?: (msg: string) => void
): void {
  if (!row.depreciation_start_date) {
    const msg = `Row #${row.idx ?? 0}: Depreciation Start Date is required`;
    if (onError) onError(msg);
    else throw new Error(msg);
    return;
  }

  const depStart = toDate(row.depreciation_start_date);
  const purchaseDate = toDate(asset.purchase_date);
  const availableDate = toDate(asset.available_for_use_date);

  if (depStart && purchaseDate && depStart < purchaseDate) {
    const msg = `Row #${row.idx ?? 0}: Next Depreciation Date cannot be before Purchase Date`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (depStart && availableDate && depStart < availableDate) {
    const msg = `Row #${row.idx ?? 0}: Next Depreciation Date cannot be before Available-for-use Date`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

/* ────────────────────────────────────────────────────────────────
   Expected Value Validation
   ──────────────────────────────────────────────────────────────── */

export function validateExpectedValueAfterUsefulLife(
  asset: Asset,
  depreciationSchedules: AssetDepreciationScheduleDoc[],
  onError?: (msg: string) => void
): void {
  for (const row of asset.finance_books) {
    const schedule = depreciationSchedules.find(
      (s) => s.finance_book === (row.finance_book ?? null)
    );
    if (!schedule || !schedule.depreciation_schedule) continue;

    const accumulatedDepreciationAfterFullSchedule = Math.max(
      ...schedule.depreciation_schedule.map((d) => flt(d.accumulated_depreciation_amount))
    );

    if (accumulatedDepreciationAfterFullSchedule) {
      const assetValueAfterFullSchedule = flt(
        flt(asset.net_purchase_amount) - flt(accumulatedDepreciationAfterFullSchedule),
        2
      );

      if (
        row.expected_value_after_useful_life &&
        row.expected_value_after_useful_life < assetValueAfterFullSchedule
      ) {
        const msg = `Depreciation Row ${row.idx ?? 0}: Expected value after useful life must be greater than or equal to ${assetValueAfterFullSchedule}`;
        if (onError) onError(msg);
        else throw new Error(msg);
      } else if (!row.expected_value_after_useful_life) {
        row.expected_value_after_useful_life = assetValueAfterFullSchedule;
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   Category & Item Validation
   ──────────────────────────────────────────────────────────────── */

export function validateCategory(
  asset: Asset,
  assetCategory: AssetCategory,
  onError?: (msg: string) => void
): void {
  if (asset.calculate_depreciation && assetCategory.non_depreciable_category) {
    const msg =
      "This asset category is marked as non-depreciable. Please disable depreciation calculation or choose a different category.";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validatePrecision(asset: Asset): void {
  if (asset.net_purchase_amount) {
    asset.net_purchase_amount = flt(asset.net_purchase_amount, 2);
  }
  if (asset.opening_accumulated_depreciation) {
    asset.opening_accumulated_depreciation = flt(asset.opening_accumulated_depreciation, 2);
  }
}

export function validateAssetValues(
  asset: Asset,
  itemDetails: ItemDetails,
  isCwipEnabled: boolean,
  onError?: (msg: string) => void
): void {
  if (!asset.asset_category) {
    asset.asset_category = itemDetails.asset_category ?? null;
  }

  if (!flt(asset.net_purchase_amount) && asset.asset_type !== "Composite Asset") {
    const msg = "Net Purchase Amount is mandatory";
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (isCwipEnabled) {
    if (
      asset.asset_type !== "Existing Asset" &&
      asset.asset_type !== "Composite Asset" &&
      !asset.purchase_receipt &&
      !asset.purchase_invoice
    ) {
      const msg = `Please create purchase receipt or purchase invoice for the item ${asset.item_code}`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }

    if (
      !asset.purchase_receipt &&
      asset.purchase_invoice &&
      !isCwipEnabled // simplified; caller should pass actual update_stock flag
    ) {
      const msg = `Update stock must be enabled for the purchase invoice ${asset.purchase_invoice}`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  }

  if (!asset.calculate_depreciation) return;

  if (!asset.finance_books || asset.finance_books.length === 0) {
    const msg = "Enter depreciation details";
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (asset.is_fully_depreciated) {
    const msg = "Depreciation cannot be calculated for fully depreciated assets";
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (asset.asset_type === "Existing Asset") return;

  const availableDate = toDate(asset.available_for_use_date);
  const purchaseDate = toDate(asset.purchase_date);
  if (availableDate && purchaseDate && availableDate < purchaseDate) {
    const msg = "Available-for-use Date should be after purchase date";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateLinkedPurchaseDocuments(
  asset: Asset,
  onError?: (msg: string) => void
): void {
  if (asset.flags?.is_split_asset) return;

  const docs: Array<[string, string]> = [
    ["purchase_receipt", "Purchase Receipt"],
    ["purchase_invoice", "Purchase Invoice"],
  ];

  for (const [fieldname, doctype] of docs) {
    const purchaseDoc = (asset as unknown as Record<string, string | null | undefined>)[fieldname];
    if (!purchaseDoc) continue;
    // docstatus check is done by caller (they know whether the doc is submitted)
    // Here we only validate asset qty logic if caller provides purchaseDocQty
  }
}

export function validateAssetAndReference(
  asset: Asset,
  purchaseDocCompany?: string | null,
  onError?: (msg: string) => void
): void {
  if (purchaseDocCompany && purchaseDocCompany !== asset.company) {
    const msg = `Company of asset ${asset.name} and purchase document doesn't match.`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (asset.asset_type === "Existing Asset" && asset.purchase_invoice) {
    const msg = `Purchase Invoice cannot be made against an existing asset ${asset.name}`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateItem(
  item: ItemDetails,
  itemCode: string,
  onError?: (msg: string) => void
): void {
  if (!item) {
    const msg = `Item ${itemCode} does not exist`;
    if (onError) onError(msg);
    else throw new Error(msg);
    return;
  }
  if (item.disabled) {
    const msg = `Item ${itemCode} has been disabled`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
  if (!item.is_fixed_asset) {
    const msg = `Item ${itemCode} must be a Fixed Asset Item`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
  if (item.is_stock_item) {
    const msg = `Item ${itemCode} must be a non-stock item`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateCostCenter(
  asset: Asset,
  companyDefaults: CompanyAccountDefaults,
  onError?: (msg: string) => void
): void {
  if (asset.cost_center) {
    // cost center company / is_group checks done by caller
    return;
  }

  if (!companyDefaults.depreciation_cost_center) {
    const msg = `Please set a Cost Center for the Asset or set an Asset Depreciation Cost Center for the Company ${asset.company}`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateGrossAndPurchaseAmount(
  asset: Asset,
  onError?: (msg: string) => void
): void {
  if (asset.asset_type === "Existing Asset") return;

  if (asset.net_purchase_amount && asset.net_purchase_amount !== asset.purchase_amount) {
    const msg =
      "Net Purchase Amount should be equal to purchase amount of one single Asset. Please do not book expense of multiple assets against one single Asset.";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

/* ────────────────────────────────────────────────────────────────
   Missing Values
   ──────────────────────────────────────────────────────────────── */

export function setMissingValues(
  asset: Asset,
  itemDetails: ItemDetails,
  assetCategory: AssetCategory
): Asset {
  const a = { ...asset };
  if (!a.asset_category) {
    a.asset_category = itemDetails.asset_category ?? null;
  }

  if (a.item_code && (!a.finance_books || a.finance_books.length === 0)) {
    a.finance_books = getItemDetails(a.item_code, assetCategory, a.net_purchase_amount);
  }

  if (a.asset_owner === "Company" && !a.asset_owner_company) {
    a.asset_owner_company = a.company;
  }

  return a;
}

export function getItemDetails(
  _itemCode: string,
  assetCategory: AssetCategory,
  netPurchaseAmount: number
): AssetFinanceBook[] {
  return assetCategory.finance_books.map((d) => ({
    finance_book: d.finance_book ?? null,
    depreciation_method: d.depreciation_method,
    total_number_of_depreciations: d.total_number_of_depreciations,
    frequency_of_depreciation: d.frequency_of_depreciation,
    daily_prorata_based: d.daily_prorata_based ?? false,
    shift_based: d.shift_based ?? false,
    salvage_value_percentage: d.salvage_value_percentage ?? 0,
    expected_value_after_useful_life:
      flt(netPurchaseAmount) * flt((d.salvage_value_percentage ?? 0) / 100),
    depreciation_start_date: d.depreciation_start_date ?? new Date().toISOString().split("T")[0],
    rate_of_depreciation: d.rate_of_depreciation ?? 0,
    value_after_depreciation: 0,
  }));
}

/* ────────────────────────────────────────────────────────────────
   Cancellation Validation
   ──────────────────────────────────────────────────────────────── */

export function validateCancellation(asset: Asset, onError?: (msg: string) => void): void {
  if (asset.status === "In Maintenance" || asset.status === "Out of Order") {
    const msg =
      "There are active maintenance or repairs against the asset. You must complete all of them before cancelling the asset.";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
  if (
    asset.status !== "Submitted" &&
    asset.status !== "Partially Depreciated" &&
    asset.status !== "Fully Depreciated"
  ) {
    const msg = `Asset cannot be cancelled, as it is already ${asset.status}`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

/* ────────────────────────────────────────────────────────────────
   Split Asset
   ──────────────────────────────────────────────────────────────── */

export function validateSplitQuantity(
  assetQuantity: number,
  splitQty: number,
  onError?: (msg: string) => void
): void {
  if (splitQty >= assetQuantity) {
    const msg = "Split Quantity must be less than Asset Quantity";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function splitAssetValues(
  existingAsset: Asset,
  splitQty: number
): Partial<Asset> {
  const scalingFactor = flt(splitQty) / flt(existingAsset.asset_quantity);
  return {
    net_purchase_amount: flt(existingAsset.net_purchase_amount) * scalingFactor,
    purchase_amount: flt(existingAsset.net_purchase_amount) * scalingFactor,
    additional_asset_cost: flt(existingAsset.additional_asset_cost) * scalingFactor,
    total_asset_cost:
      flt(existingAsset.net_purchase_amount) * scalingFactor +
      flt(existingAsset.additional_asset_cost) * scalingFactor,
    opening_accumulated_depreciation:
      flt(existingAsset.opening_accumulated_depreciation) * scalingFactor,
    value_after_depreciation:
      flt(existingAsset.value_after_depreciation) * scalingFactor,
    asset_quantity: splitQty,
    split_from: existingAsset.name,
    finance_books: existingAsset.finance_books.map((fb) => ({
      ...fb,
      value_after_depreciation: flt(fb.value_after_depreciation) * scalingFactor,
      expected_value_after_useful_life:
        flt(fb.expected_value_after_useful_life) * scalingFactor,
    })),
  };
}

/* ────────────────────────────────────────────────────────────────
   Asset Category Account helpers
   ──────────────────────────────────────────────────────────────── */

export function getAssetCategoryAccount(
  fieldname: string,
  assetCategoryAccounts: AssetCategoryAccount[],
  company: string
): string | null {
  const row = assetCategoryAccounts.find((a) => a.company_name === company);
  if (!row) return null;
  return (row as unknown as Record<string, string | null | undefined>)[fieldname] ?? null;
}

export function getAssetAccount(
  accountName: string,
  assetCategoryAccounts: AssetCategoryAccount[],
  company: string,
  companyDefaults: CompanyAccountDefaults
): string | null {
  let account = getAssetCategoryAccount(accountName, assetCategoryAccounts, company);
  if (!account) {
    account = (companyDefaults as unknown as Record<string, string | null | undefined>)[accountName] ?? null;
  }
  return account;
}

/* ────────────────────────────────────────────────────────────────
   Purchase doc helpers
   ──────────────────────────────────────────────────────────────── */

export function setPurchaseDocRowItem(
  asset: Asset,
  purchaseDocType?: "Purchase Receipt" | "Purchase Invoice"
): Asset {
  const a = { ...asset };
  if (a.asset_type === "Existing Asset" || a.asset_type === "Composite Asset") {
    return a;
  }

  a.purchase_amount = a.net_purchase_amount;
  if (!purchaseDocType) return a;

  // Linked item resolution is done by caller; we just ensure purchase_amount is set
  return a;
}

export function getLinkedItem(
  items: Array<{
    name: string;
    base_net_amount: number;
    base_net_rate: number;
    qty: number;
  }>,
  netPurchaseAmount: number,
  assetQuantity: number
): string | null {
  for (const item of items) {
    if (assetQuantity > 1) {
      if (item.base_net_amount === netPurchaseAmount && item.qty === assetQuantity) {
        return item.name;
      } else if (item.qty === assetQuantity) {
        return item.name;
      }
    } else {
      if (item.base_net_rate === netPurchaseAmount && item.qty === assetQuantity) {
        return item.name;
      }
    }
  }
  return null;
}

export function getValuesFromPurchaseDoc(
  purchaseDoc: {
    company: string;
    posting_date: Date | string;
    cost_center?: string | null;
    items: Array<{
      item_code: string;
      base_net_amount: number;
      qty: number;
      cost_center?: string | null;
      asset_location?: string | null;
      name: string;
    }>;
  },
  itemCode: string,
  doctype: "Purchase Receipt" | "Purchase Invoice"
): {
  company: string;
  purchase_date: Date | string;
  net_purchase_amount: number;
  asset_quantity: number;
  cost_center: string | null;
  asset_location: string | null;
  purchase_receipt_item: string | null;
  purchase_invoice_item: string | null;
} {
  const matchingItems = purchaseDoc.items.filter((i) => i.item_code === itemCode);
  if (!matchingItems.length) {
    throw new Error(`Selected ${doctype} does not contain the Item Code ${itemCode}`);
  }

  const first = matchingItems[0];
  return {
    company: purchaseDoc.company,
    purchase_date: purchaseDoc.posting_date,
    net_purchase_amount: flt(first.base_net_amount),
    asset_quantity: first.qty,
    cost_center: first.cost_center ?? purchaseDoc.cost_center ?? null,
    asset_location: first.asset_location ?? null,
    purchase_receipt_item: doctype === "Purchase Receipt" ? first.name : null,
    purchase_invoice_item: doctype === "Purchase Invoice" ? first.name : null,
  };
}
