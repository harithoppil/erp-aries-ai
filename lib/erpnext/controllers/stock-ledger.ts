/**
 * Ported from erpnext/stock/stock_ledger.py
 * Pure business logic for Stock Ledger Entry creation, querying,
 * valuation-rate lookup, and negative-stock validation.
 */

/* ------------------------------------------------------------------ */
/*  Core Types                                                         */
/* ------------------------------------------------------------------ */

export interface SLEntry {
  [key: string]: unknown;
  name?: string;
  item_code: string;
  warehouse: string;
  posting_date: string;
  posting_time?: string;
  posting_datetime?: string;
  qty: number;
  actual_qty?: number;
  qty_after_transaction?: number;
  valuation_rate: number;
  stock_value?: number;
  stock_value_difference?: number;
  voucher_type: string;
  voucher_no: string;
  voucher_detail_no?: string;
  incoming_rate?: number;
  outgoing_rate?: number;
  is_cancelled?: boolean;
  serial_no?: string;
  batch_no?: string;
  serial_and_batch_bundle?: string;
  has_batch_no?: boolean;
  is_adjustment_entry?: boolean;
  recalculate_rate?: boolean;
  creation?: string;
  company?: string;
  stock_queue?: string | [number, number][];
  dependant_sle_voucher_detail_no?: string;
  previous_qty_after_transaction?: number;
  reserved_stock?: number;
  diff?: number;
  auto_created_serial_and_batch_bundle?: boolean;
}

export interface StockSettings {
  allow_negative_stock?: boolean;
}

export interface ItemSettings {
  allow_negative_stock?: boolean;
  valuation_rate?: number;
  standard_rate?: number;
}

export interface ItemPriceFallback {
  price_list_rate?: number;
}

export interface InterCompanyReference {
  incoming_rate?: number;
  landed_cost_voucher_amount?: number;
}

export interface StockLedgerQueryArgs {
  item_code: string;
  warehouse: string;
  posting_date?: string;
  posting_time?: string;
  posting_datetime?: string;
  name?: string;
  serial_no?: string;
  project?: string;
  warehouse_condition?: string;
  voucher_no?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: boolean | number | string | undefined | null): number {
  const v = typeof value === "boolean" ? (value ? 1 : 0) : typeof value === "string" ? parseInt(value, 10) : value ?? 0;
  return Number.isNaN(v) ? 0 : v;
}

function round_off_if_near_zero(value: number, precision = 6): number {
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return Math.abs(rounded) < 1 / factor ? 0 : rounded;
}

function get_combine_datetime(postingDate?: string, postingTime?: string): string {
  const date = postingDate ? new Date(postingDate) : new Date();
  const time = postingTime ?? "00:00:00";
  const [hours, minutes, seconds] = time.split(":").map((s) => parseInt(s, 10));
  date.setHours(hours ?? 0, minutes ?? 0, seconds ?? 0, 0);
  return date.toISOString();
}

/* ------------------------------------------------------------------ */
/*  FIFO / LIFO Valuation (pure)                                       */
/* ------------------------------------------------------------------ */

export interface Valuation {
  state: [number, number][];
  add_stock(qty: number, rate: number): void;
  remove_stock(qty: number, outgoingRate?: number, rateGenerator?: () => number, _isReturnPurchaseEntry?: boolean): void;
  get_total_stock_and_value(): [number, number];
}

export function createFIFOValuation(initialState?: [number, number][]): Valuation {
  const state: [number, number][] = initialState ? [...initialState] : [];

  function add_stock(qty: number, rate: number): void {
    state.push([qty, rate]);
  }

  function remove_stock(
    qty: number,
    outgoingRate?: number,
    rateGenerator?: () => number,
    _isReturnPurchaseEntry = false
  ): void {
    let remainingQty = qty;
    while (remainingQty > 0 && state.length > 0) {
      const [bucketQty, bucketRate] = state[0];
      const consume = Math.min(remainingQty, bucketQty);
      if (bucketQty <= consume) {
        state.shift();
      } else {
        state[0] = [bucketQty - consume, bucketRate];
      }
      remainingQty -= consume;
    }
    if (remainingQty > 0) {
      const fallbackRate = rateGenerator ? rateGenerator() : outgoingRate ?? 0;
      state.push([remainingQty * -1, fallbackRate]);
    }
  }

  function get_total_stock_and_value(): [number, number] {
    const totalQty = state.reduce((sum, [q]) => sum + q, 0);
    const totalValue = state.reduce((sum, [q, r]) => sum + q * r, 0);
    return [totalQty, totalValue];
  }

  return { state, add_stock, remove_stock, get_total_stock_and_value };
}

export function createLIFOValuation(initialState?: [number, number][]): Valuation {
  const state: [number, number][] = initialState ? [...initialState] : [];

  function add_stock(qty: number, rate: number): void {
    state.push([qty, rate]);
  }

  function remove_stock(
    qty: number,
    outgoingRate?: number,
    rateGenerator?: () => number,
    _isReturnPurchaseEntry = false
  ): void {
    let remainingQty = qty;
    while (remainingQty > 0 && state.length > 0) {
      const lastIdx = state.length - 1;
      const [bucketQty, bucketRate] = state[lastIdx];
      const consume = Math.min(remainingQty, bucketQty);
      if (bucketQty <= consume) {
        state.pop();
      } else {
        state[lastIdx] = [bucketQty - consume, bucketRate];
      }
      remainingQty -= consume;
    }
    if (remainingQty > 0) {
      const fallbackRate = rateGenerator ? rateGenerator() : outgoingRate ?? 0;
      state.push([remainingQty * -1, fallbackRate]);
    }
  }

  function get_total_stock_and_value(): [number, number] {
    const totalQty = state.reduce((sum, [q]) => sum + q, 0);
    const totalValue = state.reduce((sum, [q, r]) => sum + q * r, 0);
    return [totalQty, totalValue];
  }

  return { state, add_stock, remove_stock, get_total_stock_and_value };
}

/* ------------------------------------------------------------------ */
/*  1. make_sl_entries                                                 */
/* ------------------------------------------------------------------ */

export function make_sl_entries(
  sl_entries: SLEntry[],
  allow_negative_stock = false,
  via_landed_cost_voucher = false
): SLEntry[] {
  if (!sl_entries || sl_entries.length === 0) {
    return [];
  }

  const cancelled = sl_entries[0].is_cancelled ?? false;
  const processed: SLEntry[] = [];

  for (const sle of sl_entries) {
    let entry = { ...sle };

    if (cancelled) {
      entry.actual_qty = -flt(entry.actual_qty ?? entry.qty);
      entry.qty = entry.actual_qty;

      if (entry.actual_qty < 0 && !entry.outgoing_rate) {
        // In pure mode we cannot call get_incoming_outgoing_rate_for_cancel;
        // preserve what is present or leave 0.
        entry.outgoing_rate = entry.outgoing_rate ?? 0;
        entry.incoming_rate = 0;
      }

      if (entry.actual_qty > 0 && !entry.incoming_rate) {
        entry.incoming_rate = entry.incoming_rate ?? 0;
        entry.outgoing_rate = 0;
      }
    }

    if (entry.actual_qty || entry.voucher_type === "Stock Reconciliation") {
      const sleDoc = make_entry(entry, allow_negative_stock, via_landed_cost_voucher);
      processed.push(sleDoc);
    }
  }

  return processed;
}

/* ------------------------------------------------------------------ */
/*  2. make_entry                                                      */
/* ------------------------------------------------------------------ */

export function make_entry(
  args: Partial<SLEntry>,
  allow_negative_stock = false,
  via_landed_cost_voucher = false
): SLEntry {
  const sle: SLEntry = {
    name: args.name ?? crypto.randomUUID?.() ?? `SLE-${Date.now()}`,
    item_code: args.item_code ?? "",
    warehouse: args.warehouse ?? "",
    posting_date: args.posting_date ?? new Date().toISOString().split("T")[0],
    posting_time: args.posting_time ?? "00:00:00",
    qty: flt(args.qty ?? args.actual_qty ?? 0),
    actual_qty: flt(args.actual_qty ?? args.qty ?? 0),
    valuation_rate: flt(args.valuation_rate ?? 0),
    stock_value: flt(args.stock_value ?? 0),
    voucher_type: args.voucher_type ?? "Stock Entry",
    voucher_no: args.voucher_no ?? "",
    voucher_detail_no: args.voucher_detail_no,
    incoming_rate: flt(args.incoming_rate ?? 0),
    outgoing_rate: flt(args.outgoing_rate ?? 0),
    is_cancelled: args.is_cancelled ?? false,
    serial_no: args.serial_no,
    batch_no: args.batch_no,
    serial_and_batch_bundle: args.serial_and_batch_bundle,
    has_batch_no: args.has_batch_no,
    is_adjustment_entry: args.is_adjustment_entry,
    recalculate_rate: args.recalculate_rate,
    creation: args.creation,
    company: args.company,
    stock_queue: args.stock_queue,
    dependant_sle_voucher_detail_no: args.dependant_sle_voucher_detail_no,
    previous_qty_after_transaction: args.previous_qty_after_transaction,
    reserved_stock: args.reserved_stock,
    qty_after_transaction: args.qty_after_transaction,
    stock_value_difference: args.stock_value_difference,
    diff: args.diff,
    auto_created_serial_and_batch_bundle: args.auto_created_serial_and_batch_bundle,
  };

  // metadata flags
  (sle as Record<string, unknown>).allow_negative_stock = allow_negative_stock;
  (sle as Record<string, unknown>).via_landed_cost_voucher = via_landed_cost_voucher;

  if (args.is_cancelled) {
    (sle as Record<string, unknown>).ignore_links = true;
  }

  return sle;
}

/* ------------------------------------------------------------------ */
/*  3. get_stock_ledger_entries                                        */
/* ------------------------------------------------------------------ */

export function get_stock_ledger_entries(
  item_code: string,
  warehouse: string,
  entries: SLEntry[],
  options?: {
    operator?: "<" | ">" | "<=" | ">=";
    order?: "asc" | "desc";
    limit?: number;
    posting_datetime?: string;
    posting_date?: string;
    posting_time?: string;
    name?: string;
    check_serial_no?: boolean;
    serial_no?: string;
    extra_cond?: string;
    for_report?: boolean;
    project?: string;
    warehouse_condition?: string;
  }
): SLEntry[] {
  const opts = options ?? {};
  const operator = opts.operator;
  const order = opts.order ?? "desc";
  const limit = opts.limit;
  const checkSerialNo = opts.check_serial_no ?? true;

  let postingDatetime = opts.posting_datetime;
  if (!postingDatetime) {
    const postingTime = opts.posting_time ?? "00:00:00";
    postingDatetime = get_combine_datetime(
      opts.posting_date ?? "1900-01-01",
      postingTime
    );
  }

  let filtered = entries.filter((sle) => {
    if (sle.item_code !== item_code) return false;
    if (sle.warehouse !== warehouse) return false;
    if (sle.is_cancelled) return false;

    if (operator && postingDatetime) {
      const sleDt = sle.posting_datetime ?? get_combine_datetime(sle.posting_date, sle.posting_time);
      const cmp = new Date(sleDt).getTime() - new Date(postingDatetime).getTime();
      switch (operator) {
        case "<":
          if (cmp >= 0) return false;
          break;
        case "<=":
          if (cmp > 0) return false;
          break;
        case ">":
          if (cmp <= 0) return false;
          break;
        case ">=":
          if (cmp < 0) return false;
          break;
      }
    }

    if (operator && opts.name && sle.name === opts.name) {
      // exclude self when operator is > or <=
      if (operator === ">" || operator === "<=") return false;
    }

    if (checkSerialNo && opts.serial_no && sle.serial_no) {
      const sn = opts.serial_no;
      if (
        sle.serial_no !== sn &&
        !sle.serial_no.startsWith(`${sn}\n`) &&
        !sle.serial_no.endsWith(`\n${sn}`) &&
        !sle.serial_no.includes(`\n${sn}\n`)
      ) {
        return false;
      }
    }

    if (opts.for_report && opts.project && sle.company !== opts.project) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const aDt = a.posting_datetime ?? get_combine_datetime(a.posting_date, a.posting_time);
    const bDt = b.posting_datetime ?? get_combine_datetime(b.posting_date, b.posting_time);
    const cmp = new Date(aDt).getTime() - new Date(bDt).getTime();
    if (cmp !== 0) return order === "asc" ? cmp : -cmp;
    // secondary sort by creation
    const aCreation = a.creation ?? "";
    const bCreation = b.creation ?? "";
    return order === "asc" ? aCreation.localeCompare(bCreation) : bCreation.localeCompare(aCreation);
  });

  if (limit !== undefined && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

/* ------------------------------------------------------------------ */
/*  4. get_previous_sle                                                */
/* ------------------------------------------------------------------ */

export function get_previous_sle(
  args: StockLedgerQueryArgs,
  entries: SLEntry[],
  _forUpdate = false,
  extraCond?: string,
  forReport = false
): SLEntry | null {
  const sleList = get_stock_ledger_entries(args.item_code, args.warehouse, entries, {
    operator: "<=",
    order: "desc",
    limit: 1,
    posting_datetime: args.posting_datetime,
    posting_date: args.posting_date,
    posting_time: args.posting_time,
    name: args.name,
    extra_cond: extraCond,
    for_report: forReport,
    project: args.project,
    warehouse_condition: args.warehouse_condition,
  });

  return sleList.length > 0 ? sleList[0] : null;
}

/* ------------------------------------------------------------------ */
/*  5. get_valuation_rate                                            */
/* ------------------------------------------------------------------ */

export function get_valuation_rate(
  item_code: string,
  warehouse: string,
  voucher_type: string,
  voucher_no: string,
  options?: {
    allow_zero_rate?: boolean;
    currency?: string;
    company?: string;
    fallbacks?: boolean;
    raise_error_if_no_rate?: boolean;
    batch_no?: string;
    serial_and_batch_bundle?: string;
    entries?: SLEntry[];
    item_settings?: ItemSettings;
    item_price?: ItemPriceFallback;
    stock_settings?: StockSettings;
    is_perpetual_inventory_enabled?: boolean;
  }
): number {
  const opts = options ?? {};
  const entries = opts.entries ?? [];
  const fallbacks = opts.fallbacks ?? true;
  const raiseError = opts.raise_error_if_no_rate ?? true;

  // 1. Batch-wise valuation
  if (opts.batch_no) {
    const batchEntries = entries.filter(
      (sle) =>
        sle.item_code === item_code &&
        sle.warehouse === warehouse &&
        sle.batch_no === opts.batch_no &&
        sle.is_cancelled !== true &&
        !(sle.voucher_no === voucher_no && sle.voucher_type === voucher_type)
    );
    const totalValue = batchEntries.reduce((s, e) => s + flt(e.stock_value_difference ?? 0), 0);
    const totalQty = batchEntries.reduce((s, e) => s + flt(e.actual_qty ?? e.qty ?? 0), 0);
    if (totalQty !== 0) {
      return flt(totalValue / totalQty);
    }
  }

  // 2. Serial-and-batch-bundle lookup (not batchwise) — pure fallback
  if (opts.serial_and_batch_bundle) {
    // In a pure port we rely on caller to supply bundle valuation externally;
    // if entries contain a matching SLE we use that rate.
    const bundleEntry = entries.find(
      (sle) =>
        sle.serial_and_batch_bundle === opts.serial_and_batch_bundle &&
        sle.is_cancelled !== true
    );
    if (bundleEntry && bundleEntry.valuation_rate > 0) {
      return flt(bundleEntry.valuation_rate);
    }
  }

  // 3. Last SLE valuation rate
  const lastSle = get_previous_sle(
    {
      item_code,
      warehouse,
      posting_date: new Date().toISOString().split("T")[0],
      posting_time: "23:59:59",
    },
    entries.filter(
      (sle) =>
        sle.item_code === item_code &&
        sle.warehouse === warehouse &&
        sle.valuation_rate >= 0 &&
        sle.is_cancelled !== true &&
        !(sle.voucher_no === voucher_no && sle.voucher_type === voucher_type)
    )
  );
  if (lastSle && lastSle.valuation_rate >= 0) {
    return flt(lastSle.valuation_rate);
  }

  // 4. Fallbacks: Item master
  if (fallbacks) {
    if (opts.item_settings?.valuation_rate) {
      return flt(opts.item_settings.valuation_rate);
    }
    if (opts.item_settings?.standard_rate) {
      return flt(opts.item_settings.standard_rate);
    }
    if (opts.item_price?.price_list_rate) {
      return flt(opts.item_price.price_list_rate);
    }
  }

  // 5. Error
  if (!opts.allow_zero_rate && raiseError && opts.is_perpetual_inventory_enabled) {
    throw new Error(
      `Valuation Rate for the Item ${item_code} is required to do accounting entries for ${voucher_type} ${voucher_no}.`
    );
  }

  return 0;
}

/* ------------------------------------------------------------------ */
/*  6. validate_negative_qty_in_future_sle                            */
/* ------------------------------------------------------------------ */

export interface NegativeStockValidationArgs {
  item_code: string;
  warehouse: string;
  posting_date: string;
  posting_time?: string;
  posting_datetime?: string;
  actual_qty?: number;
  qty?: number;
  qty_after_transaction?: number;
  voucher_type: string;
  voucher_no: string;
  voucher_detail_no?: string;
  batch_no?: string;
  serial_and_batch_bundle?: string;
  reserved_stock?: number;
  is_cancelled?: boolean;
  previous_qty_after_transaction?: number;
}

export function validate_negative_qty_in_future_sle(
  args: NegativeStockValidationArgs,
  allow_negative_stock = false,
  options?: {
    stock_settings?: StockSettings;
    item_settings?: ItemSettings;
    future_entries?: SLEntry[];
    stock_reco_item_qty?: number;
  }
): void {
  if (allow_negative_stock || is_negative_stock_allowed(args.item_code, options?.stock_settings, options?.item_settings)) {
    return;
  }

  // Stock Reconciliation special case
  if (
    args.voucher_type === "Stock Reconciliation" &&
    (args.actual_qty ?? args.qty ?? 0) < 0 &&
    args.serial_and_batch_bundle &&
    (options?.stock_reco_item_qty ?? 0) > 0
  ) {
    return;
  }

  if ((args.actual_qty ?? args.qty ?? 0) >= 0 && args.voucher_type !== "Stock Reconciliation") {
    return;
  }

  const future = options?.future_entries ?? [];

  const negSle = get_future_sle_with_negative_qty(args, future);
  if (is_negative_with_precision(negSle)) {
    const first = negSle[0];
    throw new Error(
      `${Math.abs(first.qty_after_transaction ?? 0)} units of ${args.item_code} needed in ${args.warehouse} on ${first.posting_date} ${first.posting_time} for ${first.voucher_type} ${first.voucher_no} to complete this transaction.`
    );
  }

  if (args.batch_no) {
    const negBatch = get_future_sle_with_negative_batch_qty(args, future);
    if (is_negative_with_precision(negBatch, true)) {
      const first = negBatch[0];
      throw new Error(
        `${Math.abs(first.cumulative_total ?? 0)} units of ${args.batch_no} needed in ${args.warehouse} on ${first.posting_date} ${first.posting_time} for ${first.voucher_type} ${first.voucher_no} to complete this transaction.`
      );
    }
  }

  if (args.reserved_stock) {
    // pure validation placeholder: caller should pass balance
    const balance = future.reduce((sum, e) => sum + flt(e.actual_qty ?? e.qty ?? 0), 0);
    const diff = flt(balance - args.reserved_stock);
    if (diff < 0 && Math.abs(diff) > 0.0001) {
      throw new Error(
        `${Math.abs(diff)} units of ${args.item_code} needed in ${args.warehouse} to complete this transaction.`
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  7. update_qty_in_future_sle                                       */
/* ------------------------------------------------------------------ */

export function update_qty_in_future_sle(
  args: NegativeStockValidationArgs,
  futureEntries: SLEntry[],
  allow_negative_stock = false,
  options?: {
    stock_settings?: StockSettings;
    item_settings?: ItemSettings;
    stock_reco_item_qty?: number;
  }
): SLEntry[] {
  const postingDatetime =
    args.posting_datetime ?? get_combine_datetime(args.posting_date, args.posting_time);

  let qtyShift = args.actual_qty ?? args.qty ?? 0;

  if (args.voucher_type === "Stock Reconciliation") {
    qtyShift = get_stock_reco_qty_shift(args);
  }

  // find next stock reco to limit update range
  const nextStockReco = get_next_stock_reco(args, futureEntries);
  const limitDatetime = nextStockReco
    ? nextStockReco.posting_datetime ?? get_combine_datetime(nextStockReco.posting_date, nextStockReco.posting_time)
    : null;
  const limitCreation = nextStockReco?.creation;

  const updated = futureEntries.map((sle) => {
    const sleDt = sle.posting_datetime ?? get_combine_datetime(sle.posting_date, sle.posting_time);
    if (new Date(sleDt).getTime() <= new Date(postingDatetime).getTime()) {
      return sle;
    }
    if (limitDatetime) {
      const cmp = new Date(sleDt).getTime() - new Date(limitDatetime).getTime();
      if (cmp > 0) return sle;
      if (cmp === 0 && limitCreation && (sle.creation ?? "") >= limitCreation) {
        return sle;
      }
    }

    const newQtyAfter = flt((sle.qty_after_transaction ?? 0) + qtyShift);
    const newStockValue = flt(newQtyAfter * (sle.valuation_rate ?? 0));
    return {
      ...sle,
      qty_after_transaction: newQtyAfter,
      stock_value: newStockValue,
    };
  });

  validate_negative_qty_in_future_sle(args, allow_negative_stock, {
    ...options,
    future_entries: updated,
  });

  return updated;
}

/* ------------------------------------------------------------------ */
/*  8. is_negative_stock_allowed                                       */
/* ------------------------------------------------------------------ */

export function is_negative_stock_allowed(
  item_code?: string,
  stock_settings?: StockSettings,
  item_settings?: ItemSettings
): boolean {
  if (stock_settings?.allow_negative_stock) {
    return true;
  }
  if (item_code && item_settings?.allow_negative_stock) {
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  9. get_incoming_rate_for_inter_company_transfer                   */
/* ------------------------------------------------------------------ */

export function get_incoming_rate_for_inter_company_transfer(
  sle: SLEntry,
  referenceData: InterCompanyReference
): number {
  let rate = 0.0;
  let lcvRate = 0.0;

  if (referenceData.incoming_rate !== undefined && referenceData.incoming_rate !== null) {
    rate = flt(referenceData.incoming_rate);
  }

  if (referenceData.landed_cost_voucher_amount) {
    const qty = Math.abs(flt(sle.actual_qty ?? sle.qty ?? 0));
    if (qty > 0) {
      lcvRate = flt(referenceData.landed_cost_voucher_amount / qty);
    }
  }

  return rate + lcvRate;
}

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                   */
/* ------------------------------------------------------------------ */

function get_stock_reco_qty_shift(args: NegativeStockValidationArgs): number {
  let shift = 0;
  const actualQty = flt(args.actual_qty ?? args.qty ?? 0);

  if (args.voucher_detail_no && args.is_cancelled) {
    if (args.previous_qty_after_transaction !== undefined) {
      if (args.serial_and_batch_bundle) {
        return flt(args.previous_qty_after_transaction);
      }
      shift = flt(args.qty_after_transaction ?? 0) - flt(args.previous_qty_after_transaction);
    } else {
      shift = actualQty;
    }
  } else if (args.serial_and_batch_bundle) {
    shift = actualQty;
  } else {
    // reco being submitted: shift = new qty - last balance
    // In pure mode we assume caller provides previous_qty_after_transaction
    const lastBalance = args.previous_qty_after_transaction ?? 0;
    shift = flt(args.qty_after_transaction ?? 0) - flt(lastBalance);
  }

  return shift;
}

function get_next_stock_reco(args: NegativeStockValidationArgs, futureEntries: SLEntry[]): SLEntry | null {
  const postingDatetime =
    args.posting_datetime ?? get_combine_datetime(args.posting_date, args.posting_time);

  const candidates = futureEntries
    .filter(
      (sle) =>
        sle.item_code === args.item_code &&
        sle.warehouse === args.warehouse &&
        sle.voucher_type === "Stock Reconciliation" &&
        sle.voucher_no !== args.voucher_no &&
        sle.is_cancelled !== true
    )
    .filter((sle) => {
      const sleDt = sle.posting_datetime ?? get_combine_datetime(sle.posting_date, sle.posting_time);
      return new Date(sleDt).getTime() >= new Date(postingDatetime).getTime();
    });

  if (args.batch_no) {
    const batchCandidates = candidates.filter((sle) => sle.batch_no === args.batch_no);
    if (batchCandidates.length > 0) return batchCandidates[0];
  }

  return candidates.length > 0 ? candidates[0] : null;
}

function is_negative_with_precision(neg_sle: SLEntry[] | { cumulative_total?: number }[], isBatch = false): boolean {
  if (!neg_sle || neg_sle.length === 0) return false;

  const field = isBatch ? "cumulative_total" : "qty_after_transaction";
  const first = neg_sle[0] as Record<string, unknown>;
  const qtyDeficit = flt(first[field] as number | string | undefined, 2);

  return qtyDeficit < 0 && Math.abs(qtyDeficit) > 0.0001;
}

function get_future_sle_with_negative_qty(
  args: NegativeStockValidationArgs,
  futureEntries: SLEntry[]
): SLEntry[] {
  const postingDatetime =
    args.posting_datetime ?? get_combine_datetime(args.posting_date, args.posting_time);

  return futureEntries
    .filter(
      (sle) =>
        sle.item_code === args.item_code &&
        sle.warehouse === args.warehouse &&
        sle.voucher_no !== args.voucher_no &&
        sle.is_cancelled !== true
    )
    .filter((sle) => {
      const sleDt = sle.posting_datetime ?? get_combine_datetime(sle.posting_date, sle.posting_time);
      return new Date(sleDt).getTime() >= new Date(postingDatetime).getTime();
    })
    .filter((sle) => (sle.qty_after_transaction ?? 0) < 0)
    .slice(0, 1);
}

function get_future_sle_with_negative_batch_qty(
  args: NegativeStockValidationArgs,
  futureEntries: SLEntry[]
): { cumulative_total?: number; posting_date?: string; posting_time?: string; voucher_type?: string; voucher_no?: string }[] {
  const postingDatetime =
    args.posting_datetime ?? get_combine_datetime(args.posting_date, args.posting_time);

  const batchEntries = futureEntries
    .filter(
      (sle) =>
        sle.item_code === args.item_code &&
        sle.warehouse === args.warehouse &&
        sle.batch_no === args.batch_no &&
        sle.is_cancelled !== true
    )
    .sort((a, b) => {
      const aDt = a.posting_datetime ?? get_combine_datetime(a.posting_date, a.posting_time);
      const bDt = b.posting_datetime ?? get_combine_datetime(b.posting_date, b.posting_time);
      return new Date(aDt).getTime() - new Date(bDt).getTime();
    });

  let cumulative = 0;
  for (const sle of batchEntries) {
    cumulative += flt(sle.actual_qty ?? sle.qty ?? 0);
    const sleDt = sle.posting_datetime ?? get_combine_datetime(sle.posting_date, sle.posting_time);
    if (cumulative < 0 && new Date(sleDt).getTime() >= new Date(postingDatetime).getTime()) {
      return [
        {
          cumulative_total: cumulative,
          posting_date: sle.posting_date,
          posting_time: sle.posting_time,
          voucher_type: sle.voucher_type,
          voucher_no: sle.voucher_no,
        },
      ];
    }
  }

  return [];
}
