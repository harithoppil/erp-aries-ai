/**
 * Ported from erpnext/accounts/general_ledger.py
 * Core General Ledger entry creation, processing, and validation logic.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GLEntry {
  name?: string;
  account: string;
  account_currency?: string;
  against?: string;
  against_voucher?: string;
  against_voucher_type?: string;
  company: string;
  cost_center?: string;
  credit: number;
  credit_in_account_currency?: number;
  credit_in_transaction_currency?: number;
  debit: number;
  debit_in_account_currency?: number;
  debit_in_transaction_currency?: number;
  due_date?: string;
  finance_book?: string;
  fiscal_year?: string;
  is_advance?: string;
  is_cancelled?: boolean;
  is_opening?: string;
  party?: string;
  party_type?: string;
  post_net_value?: boolean;
  posting_date: string;
  project?: string;
  remarks?: string;
  transaction_currency?: string;
  transaction_date?: string;
  voucher_detail_no?: string;
  voucher_no: string;
  voucher_subtype?: string;
  voucher_type: string;
  advance_voucher_type?: string;
  advance_voucher_no?: string;
  /** Merge key used internally by merge_similar_entries */
  merge_key?: (string | undefined)[];
  /** Flag to skip merging for this entry */
  _skip_merge?: boolean;
  /** Arbitrary accounting dimension fields */
  [dimension: string]: unknown;
}

export interface MakeGLEntriesContext {
  /** Whether this is a cancellation (triggers reverse entries) */
  cancel?: boolean;
  /** Whether this is an advance adjustment */
  advAdj?: boolean;
  /** Whether to merge similar entries (default true) */
  mergeEntries?: boolean;
  /** Update outstanding flag (default "Yes") */
  updateOutstanding?: string;
  /** Whether this call is from a repost operation */
  fromRepost?: boolean;
  /** Precision for rounding monetary values */
  precision?: number;
  /** Budget validation callback / context (omitted — pure function) */
  budgetValidation?: { valid: boolean; error?: string };
  /** List of disabled account names for validate_disabled_accounts */
  disabledAccounts?: string[];
  /** Frozen date check context for check_freezing_date */
  frozenDateContext?: FrozenDateContext;
  /** Round-off account config for make_round_off_gle */
  roundOffConfig?: RoundOffConfig;
  /** Journal Entry voucher type (for exchange gain/loss checks) */
  journalEntryVoucherType?: string;
  /** Accounting dimension field names */
  accountingDimensions?: string[];
  /** Whether immutable ledger is enabled */
  immutableLedgerEnabled?: boolean;
  /** Reverse posting date (for cancellation with immutable ledger) */
  reversePostingDate?: string;
}

export interface FrozenDateContext {
  accountsFrozenTillDate?: string;
  roleAllowedForFrozenEntries?: string;
  currentUserRoles: string[];
  currentUser: string;
}

export interface RoundOffConfig {
  roundOffAccount: string;
  roundOffCostCenter: string;
  roundOffForOpening?: string;
  companyCurrency?: string;
}

export interface SaveEntriesContext {
  advAdj: boolean;
  updateOutstanding: string;
  fromRepost?: boolean;
  disabledAccounts?: string[];
  frozenDateContext?: FrozenDateContext;
  roundOffConfig?: RoundOffConfig;
  precision?: number;
  journalEntryVoucherType?: string;
  cwipAccounts?: string[];
  voucherIsJournalEntry?: boolean;
  dimensionFilterMap?: DimensionFilterMap;
}

export interface DimensionFilterMap {
  [key: string]: {
    is_mandatory: boolean;
    allow_or_restrict: "Allow" | "Restrict";
    allowed_dimensions: string[];
  };
}

export interface ReverseGLEntriesContext {
  advAdj?: boolean;
  updateOutstanding?: string;
  partialCancel?: boolean;
  postingDate?: string;
  immutableLedgerEnabled?: boolean;
  frozenDateContext?: FrozenDateContext;
  journalEntryVoucherType?: string;
  /** Posting date to use for reverse entries when immutable ledger is enabled */
  reversePostingDate?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: unknown): number {
  return Number(value) || 0;
}

/* ------------------------------------------------------------------ */
/*  1. make_gl_entries                                                 */
/* ------------------------------------------------------------------ */

export function makeGlEntries(
  glMap: GLEntry[],
  context: MakeGLEntriesContext = {}
): GLEntry[] {
  if (!glMap || glMap.length === 0) {
    return [];
  }

  const {
    cancel = false,
    advAdj = false,
    mergeEntries = true,
    fromRepost = false,
    disabledAccounts = [],
    frozenDateContext,
    roundOffConfig,
    precision,
    journalEntryVoucherType,
  } = context;

  if (!cancel) {
    validateDisabledAccounts(glMap, disabledAccounts);

    let processed = processGlMap(glMap, mergeEntries, precision, fromRepost);

    if (processed && processed.length > 1) {
      // save_entries equivalent — returns validated / round-off adjusted entries
      processed = saveEntries(processed, {
        advAdj,
        updateOutstanding: context.updateOutstanding ?? "Yes",
        fromRepost,
        disabledAccounts,
        frozenDateContext,
        roundOffConfig,
        precision,
        journalEntryVoucherType,
      });
      return processed;
    } else if (processed && processed.length === 1) {
      throw new Error(
        "Incorrect number of General Ledger Entries found. You might have selected a wrong Account in the transaction."
      );
    }
    return processed ?? [];
  } else {
    return makeReverseGlEntries(glMap, {
      advAdj,
      updateOutstanding: context.updateOutstanding ?? "Yes",
      immutableLedgerEnabled: context.immutableLedgerEnabled,
      reversePostingDate: context.reversePostingDate,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  2. process_gl_map                                                  */
/* ------------------------------------------------------------------ */

export function processGlMap(
  glMap: GLEntry[],
  mergeEntries = true,
  precision?: number,
  fromRepost = false
): GLEntry[] {
  if (!glMap || glMap.length === 0) {
    return [];
  }

  let result: GLEntry[] = [...glMap];

  // distribute_gl_based_on_cost_center_allocation is omitted in pure-port
  // because it requires DB lookups.  Caller should pre-distribute if needed.

  if (mergeEntries) {
    result = mergeSimilarEntries(result, precision);
  }

  result = toggleDebitCreditIfNegative(result);

  return result;
}

/* ------------------------------------------------------------------ */
/*  3. merge_similar_entries                                           */
/* ------------------------------------------------------------------ */

export function mergeSimilarEntries(
  glMap: GLEntry[],
  precision?: number,
  accountingDimensions: string[] = []
): GLEntry[] {
  if (!glMap || glMap.length === 0) {
    return [];
  }

  const mergedGlMap: GLEntry[] = [];
  const mergeProperties = getMergeProperties(accountingDimensions);

  for (const entry of glMap) {
    if (entry._skip_merge) {
      mergedGlMap.push({ ...entry });
      continue;
    }

    const enriched: GLEntry = { ...entry, merge_key: getMergeKey(entry, mergeProperties) };

    const sameHead = checkIfInList(enriched, mergedGlMap);
    if (sameHead) {
      sameHead.debit = flt(sameHead.debit) + flt(enriched.debit);
      sameHead.debit_in_account_currency =
        flt(sameHead.debit_in_account_currency) + flt(enriched.debit_in_account_currency);
      sameHead.debit_in_transaction_currency =
        flt(sameHead.debit_in_transaction_currency) + flt(enriched.debit_in_transaction_currency);
      sameHead.credit = flt(sameHead.credit) + flt(enriched.credit);
      sameHead.credit_in_account_currency =
        flt(sameHead.credit_in_account_currency) + flt(enriched.credit_in_account_currency);
      sameHead.credit_in_transaction_currency =
        flt(sameHead.credit_in_transaction_currency) + flt(enriched.credit_in_transaction_currency);
    } else {
      mergedGlMap.push(enriched);
    }
  }

  const p = precision ?? 2;

  // Filter zero debit / credit entries
  return mergedGlMap.filter((x) => {
    const hasDebit = flt(x.debit, p) !== 0;
    const hasCredit = flt(x.credit, p) !== 0;
    const isExchangeGainLoss =
      x.voucher_type === "Journal Entry" && x.voucher_subtype === "Exchange Gain Or Loss";
    return hasDebit || hasCredit || isExchangeGainLoss;
  });
}

function getMergeProperties(dimensions: string[]): string[] {
  const base = [
    "account",
    "cost_center",
    "party",
    "party_type",
    "voucher_detail_no",
    "against_voucher",
    "against_voucher_type",
    "project",
    "finance_book",
    "voucher_no",
    "advance_voucher_type",
    "advance_voucher_no",
  ];
  return [...base, ...dimensions];
}

function getMergeKey(entry: GLEntry, mergeProperties: string[]): (string | undefined)[] {
  return mergeProperties.map((fieldname) => {
    const val = entry[fieldname];
    return typeof val === "string" || typeof val === "number" || typeof val === "boolean"
      ? String(val)
      : undefined;
  });
}

function checkIfInList(gle: GLEntry, glMap: GLEntry[]): GLEntry | undefined {
  for (const e of glMap) {
    if (arraysEqual(e.merge_key, gle.merge_key)) {
      return e;
    }
  }
  return undefined;
}

function arraysEqual(a: (string | undefined)[] | undefined, b: (string | undefined)[] | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  4. save_entries                                                    */
/* ------------------------------------------------------------------ */

export function saveEntries(
  glMap: GLEntry[],
  context: SaveEntriesContext
): GLEntry[] {
  if (!glMap || glMap.length === 0) {
    return [];
  }

  const {
    fromRepost = false,
    advAdj,
    frozenDateContext,
    roundOffConfig,
    precision,
    journalEntryVoucherType,
  } = context;

  // validate_cwip_accounts equivalent — caller should pass cwipAccounts if needed
  // We keep the entry validation lightweight here.

  const processed = processDebitCreditDifference(glMap, {
    precision,
    journalEntryVoucherType,
    roundOffConfig,
  });

  if (processed.length > 0 && frozenDateContext) {
    checkFreezingDate(processed[0].posting_date, processed[0].company, advAdj, frozenDateContext);
  }

  for (const entry of processed) {
    makeEntry(entry);
  }

  return processed;
}

/* ------------------------------------------------------------------ */
/*  5. make_entry                                                      */
/* ------------------------------------------------------------------ */

export function makeEntry(args: GLEntry): GLEntry {
  // In the pure-function port this builds and returns the entry object
  // rather than persisting it via frappe.new_doc + submit.
  const entry: GLEntry = {
    ...args,
    is_cancelled: args.is_cancelled ?? false,
    debit: flt(args.debit),
    credit: flt(args.credit),
    debit_in_account_currency: flt(args.debit_in_account_currency),
    credit_in_account_currency: flt(args.credit_in_account_currency),
    debit_in_transaction_currency: flt(args.debit_in_transaction_currency),
    credit_in_transaction_currency: flt(args.credit_in_transaction_currency),
  };

  // Return the normalized entry so callers can persist it themselves.
  return entry;
}

/* ------------------------------------------------------------------ */
/*  6. toggle_debit_credit_if_negative                                 */
/* ------------------------------------------------------------------ */

export function toggleDebitCreditIfNegative(glMap: GLEntry[]): GLEntry[] {
  const debitCreditFieldMap: Record<string, string> = {
    debit: "credit",
    debit_in_account_currency: "credit_in_account_currency",
    debit_in_transaction_currency: "credit_in_transaction_currency",
  };

  const result: GLEntry[] = glMap.map((entry) => {
    const updated: GLEntry = { ...entry };

    for (const [debitField, creditField] of Object.entries(debitCreditFieldMap)) {
      let debit = flt(updated[debitField as keyof GLEntry] as number | undefined);
      let credit = flt(updated[creditField as keyof GLEntry] as number | undefined);

      if (debit < 0 && credit < 0 && debit === credit) {
        debit *= -1;
        credit *= -1;
      }

      if (debit < 0) {
        credit = credit - debit;
        debit = 0.0;
      }

      if (credit < 0) {
        debit = debit - credit;
        credit = 0.0;
      }

      // Update net values
      if (updated.post_net_value && debit && credit) {
        if (debit > credit) {
          debit = debit - credit;
          credit = 0.0;
        } else {
          credit = credit - debit;
          debit = 0.0;
        }
      }

      (updated[debitField as keyof GLEntry] as number | undefined) = debit;
      (updated[creditField as keyof GLEntry] as number | undefined) = credit;
    }

    return updated;
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  7. make_round_off_gle                                              */
/* ------------------------------------------------------------------ */

export interface MakeRoundOffGLEContext {
  precision?: number;
  roundOffConfig: RoundOffConfig;
  hasOpeningEntries?: boolean;
  journalEntryVoucherType?: string;
  accountingDimensions?: string[];
  voucherDimensionValues?: Record<string, string | undefined>;
}

export function makeRoundOffGle(
  glMap: GLEntry[],
  debitCreditDiff: number,
  trxCurDebitCreditDiff = 0,
  context: MakeRoundOffGLEContext
): GLEntry[] {
  if (!glMap || glMap.length === 0) {
    return [];
  }

  const { precision = 2, roundOffConfig, hasOpeningEntries = false, accountingDimensions = [] } = context;

  const { roundOffAccount, roundOffCostCenter, roundOffForOpening } = roundOffConfig;

  let account: string;
  if (hasOpeningEntries) {
    if (!roundOffForOpening) {
      throw new Error(
        `Please set 'Round Off for Opening' in Company: ${glMap[0].company}`
      );
    }
    account = roundOffForOpening;
  } else {
    account = roundOffAccount;
  }

  let roundOffGle: GLEntry | undefined;
  let roundOffAccountExists = false;

  if (glMap[0].voucher_type !== "Period Closing Voucher") {
    for (const d of glMap) {
      if (d.account === account) {
        roundOffGle = { ...d };
        if (d.debit) {
          debitCreditDiff -= flt(d.debit) - flt(d.credit);
        } else {
          debitCreditDiff += flt(d.credit);
        }
        roundOffAccountExists = true;
      }
    }

    if (roundOffAccountExists && Math.abs(debitCreditDiff) < 1.0 / 10 ** precision) {
      // Remove existing round-off entry from the returned copy
      return glMap.filter((d) => d.account !== account);
    }
  }

  if (!roundOffGle) {
    roundOffGle = {
      voucher_type: glMap[0].voucher_type,
      voucher_no: glMap[0].voucher_no,
      company: glMap[0].company,
      posting_date: glMap[0].posting_date,
      remarks: glMap[0].remarks ?? "",
      account: "",
      debit: 0,
      credit: 0,
    };
  }

  const updatedRoundOff: GLEntry = {
    ...roundOffGle,
    account,
    debit_in_account_currency: debitCreditDiff < 0 ? Math.abs(debitCreditDiff) : 0,
    credit_in_account_currency: debitCreditDiff > 0 ? debitCreditDiff : 0,
    debit: debitCreditDiff < 0 ? Math.abs(debitCreditDiff) : 0,
    credit: debitCreditDiff > 0 ? debitCreditDiff : 0,
    debit_in_transaction_currency: trxCurDebitCreditDiff < 0 ? Math.abs(trxCurDebitCreditDiff) : 0,
    credit_in_transaction_currency: trxCurDebitCreditDiff > 0 ? trxCurDebitCreditDiff : 0,
    cost_center: roundOffCostCenter,
    party_type: undefined,
    party: undefined,
    is_opening: hasOpeningEntries ? "Yes" : "No",
    against_voucher_type: undefined,
    against_voucher: undefined,
  };

  // Apply accounting dimensions if available
  if (context.voucherDimensionValues) {
    for (const dim of accountingDimensions) {
      if (context.voucherDimensionValues[dim] !== undefined) {
        updatedRoundOff[dim] = context.voucherDimensionValues[dim];
      }
    }
  }

  if (roundOffAccountExists && glMap[0].voucher_type !== "Period Closing Voucher") {
    // Replace existing round-off entry
    return glMap.map((d) => (d.account === account ? updatedRoundOff : d));
  }

  return [...glMap, updatedRoundOff];
}

/* ------------------------------------------------------------------ */
/*  8. make_reverse_gl_entries                                         */
/* ------------------------------------------------------------------ */

export function makeReverseGlEntries(
  glEntries: GLEntry[],
  context: ReverseGLEntriesContext = {}
): GLEntry[] {
  if (!glEntries || glEntries.length === 0) {
    return [];
  }

  const {
    advAdj = false,
    updateOutstanding = "Yes",
    partialCancel = false,
    postingDate,
    immutableLedgerEnabled = false,
    reversePostingDate,
  } = context;

  const reversed: GLEntry[] = [];

  for (const entry of glEntries) {
    const newGle: GLEntry = { ...entry };
    delete newGle.name;

    const debit = flt(newGle.debit);
    const credit = flt(newGle.credit);
    const debitInAccountCurrency = flt(newGle.debit_in_account_currency);
    const creditInAccountCurrency = flt(newGle.credit_in_account_currency);
    const debitInTransactionCurrency = flt(newGle.debit_in_transaction_currency);
    const creditInTransactionCurrency = flt(newGle.credit_in_transaction_currency);

    newGle.debit = credit;
    newGle.credit = debit;
    newGle.debit_in_account_currency = creditInAccountCurrency;
    newGle.credit_in_account_currency = debitInAccountCurrency;
    newGle.debit_in_transaction_currency = creditInTransactionCurrency;
    newGle.credit_in_transaction_currency = debitInTransactionCurrency;

    newGle.remarks = "On cancellation of " + newGle.voucher_no;
    newGle.is_cancelled = true;

    if (immutableLedgerEnabled) {
      newGle.is_cancelled = false;
      newGle.posting_date = reversePostingDate ?? newGle.posting_date;
    } else if (postingDate) {
      newGle.posting_date = postingDate;
    }

    if (newGle.debit || newGle.credit) {
      reversed.push(makeEntry(newGle));
    }
  }

  return reversed;
}

/* ------------------------------------------------------------------ */
/*  9. validate_disabled_accounts                                      */
/* ------------------------------------------------------------------ */

export function validateDisabledAccounts(
  glMap: GLEntry[],
  disabledAccounts: string[]
): void {
  if (!glMap || glMap.length === 0) {
    return;
  }

  const accounts = glMap.map((d) => d.account).filter((a): a is string => Boolean(a));
  const usedDisabledAccounts = accounts.filter((a) => disabledAccounts.includes(a));

  if (usedDisabledAccounts.length > 0) {
    throw new Error(
      `Cannot create accounting entries against disabled accounts: ${usedDisabledAccounts.join(", ")}`
    );
  }
}

/* ------------------------------------------------------------------ */
/* 10. check_freezing_date                                             */
/* ------------------------------------------------------------------ */

export function checkFreezingDate(
  postingDate: string,
  company: string,
  advAdj = false,
  context: FrozenDateContext
): void {
  if (advAdj) {
    return;
  }

  const { accountsFrozenTillDate, roleAllowedForFrozenEntries, currentUserRoles, currentUser } = context;

  if (!accountsFrozenTillDate) {
    return;
  }

  const frozenDate = new Date(accountsFrozenTillDate);
  const postDate = new Date(postingDate);

  if (postDate <= frozenDate) {
    const hasRole = roleAllowedForFrozenEntries
      ? currentUserRoles.includes(roleAllowedForFrozenEntries)
      : false;

    if (!hasRole || currentUser === "Administrator") {
      throw new Error(
        `You are not authorized to add or update entries before ${accountsFrozenTillDate}`
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers (process_debit_credit_difference)               */
/* ------------------------------------------------------------------ */

export interface ProcessDebitCreditContext {
  precision?: number;
  journalEntryVoucherType?: string;
  roundOffConfig?: RoundOffConfig;
}

export function processDebitCreditDifference(
  glMap: GLEntry[],
  context: ProcessDebitCreditContext
): GLEntry[] {
  if (!glMap || glMap.length === 0) {
    return [];
  }

  const { precision = 2, journalEntryVoucherType, roundOffConfig } = context;
  const voucherType = glMap[0].voucher_type;
  const voucherNo = glMap[0].voucher_no;

  const allowance = getDebitCreditAllowance(voucherType, precision);

  let { debitCreditDiff, trxCurDebitCreditDiff } = getDebitCreditDifference(glMap, precision);

  const isExchangeGainLoss =
    voucherType === "Journal Entry" && journalEntryVoucherType === "Exchange Gain Or Loss";

  if (Math.abs(debitCreditDiff) > allowance) {
    if (!isExchangeGainLoss) {
      raiseDebitCreditNotEqualError(debitCreditDiff, voucherType, voucherNo);
    }
  } else if (Math.abs(debitCreditDiff) >= 1.0 / 10 ** precision) {
    if (roundOffConfig) {
      glMap = makeRoundOffGle(glMap, debitCreditDiff, trxCurDebitCreditDiff, {
        precision,
        roundOffConfig,
        hasOpeningEntries: hasOpeningEntries(glMap),
      });
    }
  }

  // Re-check after round-off
  ({ debitCreditDiff } = getDebitCreditDifference(glMap, precision));
  if (Math.abs(debitCreditDiff) > allowance) {
    if (!isExchangeGainLoss) {
      raiseDebitCreditNotEqualError(debitCreditDiff, voucherType, voucherNo);
    }
  }

  return glMap;
}

export function getDebitCreditDifference(
  glMap: GLEntry[],
  precision: number
): { debitCreditDiff: number; trxCurDebitCreditDiff: number } {
  let debitCreditDiff = 0.0;
  let trxCurDebitCreditDiff = 0.0;

  for (const entry of glMap) {
    entry.debit = flt(entry.debit, precision);
    entry.credit = flt(entry.credit, precision);
    debitCreditDiff += entry.debit - entry.credit;

    entry.debit_in_transaction_currency = flt(entry.debit_in_transaction_currency, precision);
    entry.credit_in_transaction_currency = flt(entry.credit_in_transaction_currency, precision);
    trxCurDebitCreditDiff +=
      (entry.debit_in_transaction_currency ?? 0) - (entry.credit_in_transaction_currency ?? 0);
  }

  debitCreditDiff = flt(debitCreditDiff, precision);
  trxCurDebitCreditDiff = flt(trxCurDebitCreditDiff, precision);

  return { debitCreditDiff, trxCurDebitCreditDiff };
}

export function getDebitCreditAllowance(voucherType: string, precision: number): number {
  if (voucherType === "Journal Entry" || voucherType === "Payment Entry") {
    return 5.0 / 10 ** precision;
  }
  return 0.5;
}

export function raiseDebitCreditNotEqualError(
  debitCreditDiff: number,
  voucherType: string,
  voucherNo: string
): never {
  throw new Error(
    `Debit and Credit not equal for ${voucherType} #${voucherNo}. Difference is ${debitCreditDiff}.`
  );
}

export function hasOpeningEntries(glMap: GLEntry[]): boolean {
  for (const x of glMap) {
    if (x.is_opening === "Yes") {
      return true;
    }
  }
  return false;
}
