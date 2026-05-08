/**
 * Ported from erpnext/accounts/doctype/bank_transaction/bank_transaction.py
 * Pure logic for Bank Transaction DocType.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BankTransactionPayment {
  name?: string;
  payment_document: string;
  payment_entry: string;
  allocated_amount: number;
}

export interface BankTransactionDoc {
  name: string;
  bank_account?: string;
  company?: string;
  currency?: string;
  date?: string;
  deposit: number;
  withdrawal: number;
  description?: string;
  excluded_fee: number;
  included_fee: number;
  allocated_amount: number;
  unallocated_amount: number;
  status: "" | "Pending" | "Settled" | "Unreconciled" | "Reconciled" | "Cancelled";
  party_type?: string;
  party?: string;
  reference_number?: string;
  transaction_id?: string;
  transaction_type?: string;
  bank_party_account_number?: string;
  bank_party_iban?: string;
  bank_party_name?: string;
  docstatus: number;
  payment_entries: BankTransactionPayment[];
}

export interface BankTransactionValidationContext {
  /** Account currency of the linked Bank Account's GL Account */
  bankAccountCurrency?: string;
  /** Previous state of the document (for updates) */
  docBeforeSave?: BankTransactionDoc;
  /** Enable party matching flag from Accounts Settings */
  enablePartyMatching?: boolean;
  /** Matched party result from auto-matching */
  autoMatchPartyResult?: { party_type: string; party: string } | null;
  /** GL bank account (Account name linked to Bank Account) */
  glBankAccount?: string;
  /** Existing allocations for payment entries from other BTs */
  peBTAllocations?: PaymentEntryBTAllocationMap;
  /** Related bank GL entries for payment entries */
  glEntries?: RelatedGLEntriesMap;
  /** For linked bank transaction: the other BT's unallocated amount */
  linkedBTUnallocatedAmount?: number;
  /** For linked bank transaction: the other BT's GL bank account */
  linkedBTGLBankAccount?: string;
  /** Whether this update is from a linked BT update */
  updatingLinkedBankTransaction?: boolean;
}

export interface PaymentEntryBTAllocation {
  total: number;
  latest_date?: string;
}

export interface PaymentEntryBTAllocationMap {
  [key: string]: {
    [glAccount: string]: PaymentEntryBTAllocation;
  };
}

export interface RelatedGLEntriesMap {
  [key: string]: {
    [glAccount: string]: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/*  Fee handling                                                       */
/* ------------------------------------------------------------------ */

export interface HandleExcludedFeeResult {
  error?: string;
  updates?: {
    deposit: number;
    withdrawal: number;
    included_fee: number;
    excluded_fee: number;
  };
}

export function handleExcludedFee(doc: BankTransactionDoc): HandleExcludedFeeResult {
  const excludedFee = flt(doc.excluded_fee);
  if (excludedFee <= 0) {
    return {};
  }

  const deposit = flt(doc.deposit);
  const withdrawal = flt(doc.withdrawal);

  if (deposit > 0 && deposit - excludedFee < 0) {
    return {
      error: "The Excluded Fee is bigger than the Deposit it is deducted from.",
    };
  }

  if (deposit > 0 && withdrawal > 0) {
    return {
      error: "Only one of Deposit or Withdrawal should be non-zero when applying an Excluded Fee.",
    };
  }

  let newDeposit = deposit;
  let newWithdrawal = withdrawal;
  let newIncludedFee = flt(doc.included_fee);

  if (deposit > 0) {
    newDeposit = flt(deposit - excludedFee);
  } else if (withdrawal >= 0) {
    newWithdrawal = flt(withdrawal + excludedFee);
  }

  newIncludedFee = flt(newIncludedFee + excludedFee);

  return {
    updates: {
      deposit: newDeposit,
      withdrawal: newWithdrawal,
      included_fee: newIncludedFee,
      excluded_fee: 0,
    },
  };
}

export function validateIncludedFee(doc: BankTransactionDoc): string | null {
  if (!doc.included_fee || !doc.withdrawal) {
    return null;
  }

  if (flt(doc.included_fee) > flt(doc.withdrawal)) {
    return "Included fee is bigger than the withdrawal itself.";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Allocated amount                                                   */
/* ------------------------------------------------------------------ */

export interface UpdateAllocatedAmountResult {
  allocated_amount: number;
  unallocated_amount: number;
}

export function updateAllocatedAmount(
  doc: BankTransactionDoc
): UpdateAllocatedAmountResult {
  const allocatedAmount =
    doc.payment_entries?.reduce((sum, p) => sum + flt(p.allocated_amount), 0) ?? 0;

  const unallocatedAmount =
    Math.abs(flt(doc.withdrawal) - flt(doc.deposit)) - allocatedAmount;

  return {
    allocated_amount: flt(allocatedAmount, 2),
    unallocated_amount: flt(unallocatedAmount, 2),
  };
}

/* ------------------------------------------------------------------ */
/*  Duplicate references                                               */
/* ------------------------------------------------------------------ */

export function validateDuplicateReferences(
  paymentEntries: BankTransactionPayment[]
): string | null {
  if (!paymentEntries || paymentEntries.length === 0) {
    return null;
  }

  const references = new Set<string>();
  for (const row of paymentEntries) {
    const reference = `${row.payment_document}:${row.payment_entry}`;
    if (references.has(reference)) {
      return `${row.payment_document} ${row.payment_entry} is allocated twice in this Bank Transaction`;
    }
    references.add(reference);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Currency validation                                                */
/* ------------------------------------------------------------------ */

export function validateBankTransactionCurrency(
  doc: BankTransactionDoc,
  bankAccountCurrency: string | undefined
): string | null {
  if (!doc.currency || !doc.bank_account || !bankAccountCurrency) {
    return null;
  }

  if (doc.currency !== bankAccountCurrency) {
    return `Transaction currency: ${doc.currency} cannot be different from Bank Account(${doc.bank_account}) currency: ${bankAccountCurrency}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Status                                                             */
/* ------------------------------------------------------------------ */

export function getBankTransactionStatus(
  docstatus: number,
  unallocatedAmount: number,
  currentStatus?: string
): string {
  if (docstatus === 2) {
    return "Cancelled";
  }
  if (docstatus === 1) {
    if (unallocatedAmount > 0) {
      return "Unreconciled";
    }
    return "Reconciled";
  }
  return currentStatus || "";
}

/* ------------------------------------------------------------------ */
/*  Payment entry allocation                                           */
/* ------------------------------------------------------------------ */

export interface ClearanceDetailsResult {
  allocableAmount: number;
  shouldClear: boolean;
  clearanceDate: string;
  error?: string;
}

export function getClearanceDetails(
  transaction: BankTransactionDoc,
  paymentEntry: BankTransactionPayment,
  btAllocations: { [glAccount: string]: PaymentEntryBTAllocation },
  glEntries: { [glAccount: string]: number },
  glBankAccount: string | undefined
): ClearanceDetailsResult {
  const transactionDate = fmtDate(getdate(transaction.date));

  if (paymentEntry.payment_document === "Bank Transaction") {
    if (!glBankAccount) {
      return {
        allocableAmount: 0,
        shouldClear: false,
        clearanceDate: transactionDate,
        error: "GL Bank Account is required for Bank Transaction allocation",
      };
    }

    const btAllocation = btAllocations[glBankAccount];
    const btUnallocated = btAllocation?.total ?? 0;

    return {
      allocableAmount: Math.abs(btUnallocated),
      shouldClear: true,
      clearanceDate: transactionDate,
    };
  }

  if (!glBankAccount || !(glBankAccount in glEntries)) {
    return {
      allocableAmount: 0,
      shouldClear: false,
      clearanceDate: transactionDate,
      error: `${paymentEntry.payment_document} ${paymentEntry.payment_entry} is not affecting bank account ${glBankAccount}`,
    };
  }

  let allocableAmount = glEntries[glBankAccount] ?? 0;
  if (allocableAmount <= 0) {
    return {
      allocableAmount: 0,
      shouldClear: false,
      clearanceDate: transactionDate,
      error: `Invalid amount in accounting entries of ${paymentEntry.payment_document} ${paymentEntry.payment_entry} for Account ${glBankAccount}: ${allocableAmount}`,
    };
  }

  const matchingBTAllocation = btAllocations[glBankAccount] ?? {};
  allocableAmount = flt(allocableAmount - matchingBTAllocation.total, 2);

  // Check if all GL entries are fully allocated
  const allGLEntries = { ...glEntries };
  delete allGLEntries[glBankAccount];

  const shouldClear =
    Object.keys(allGLEntries).length === 0 ||
    Object.entries(allGLEntries).every(([acc, amt]) => {
      const allocated = btAllocations[acc]?.total ?? 0;
      return flt(amt, 2) === flt(allocated, 2);
    });

  const btAllocationDate = matchingBTAllocation.latest_date;
  const clearanceDate = btAllocationDate
    ? fmtDate(
        getdate(transactionDate) > getdate(btAllocationDate)
          ? getdate(transactionDate)
          : getdate(btAllocationDate)
      )
    : transactionDate;

  return {
    allocableAmount,
    shouldClear,
    clearanceDate,
  };
}

export interface AllocatePaymentEntriesResult {
  success: boolean;
  error?: string;
  updatedPaymentEntries: BankTransactionPayment[];
  updatedUnallocatedAmount: number;
  updatedAllocatedAmount: number;
  clearanceUpdates: ClearanceUpdate[];
  linkedBTUpdates: LinkedBTUpdate[];
}

export interface ClearanceUpdate {
  doctype: string;
  docname: string;
  clearance_date: string | null;
}

export interface LinkedBTUpdate {
  bankTransactionName: string;
  allocatedAmount: number | null;
  add: boolean;
}

export function allocatePaymentEntries(
  doc: BankTransactionDoc,
  ctx: BankTransactionValidationContext
): AllocatePaymentEntriesResult {
  if (ctx.updatingLinkedBankTransaction || !doc.payment_entries || doc.payment_entries.length === 0) {
    const amounts = updateAllocatedAmount(doc);
    return {
      success: true,
      updatedPaymentEntries: doc.payment_entries ?? [],
      updatedUnallocatedAmount: amounts.unallocated_amount,
      updatedAllocatedAmount: amounts.allocated_amount,
      clearanceUpdates: [],
      linkedBTUpdates: [],
    };
  }

  let remainingAmount = flt(doc.unallocated_amount);
  const updatedPaymentEntries: BankTransactionPayment[] = [];
  const clearanceUpdates: ClearanceUpdate[] = [];
  const linkedBTUpdates: LinkedBTUpdate[] = [];

  for (const paymentEntry of doc.payment_entries) {
    if (paymentEntry.allocated_amount !== 0) {
      updatedPaymentEntries.push({ ...paymentEntry });
      continue;
    }

    const peKey = `${paymentEntry.payment_document}:${paymentEntry.payment_entry}`;
    const peBTAllocs = ctx.peBTAllocations?.[peKey] ?? {};
    const peGLEntries = ctx.glEntries?.[peKey] ?? {};

    const clearanceResult = getClearanceDetails(
      doc,
      paymentEntry,
      peBTAllocs,
      peGLEntries,
      ctx.glBankAccount
    );

    if (clearanceResult.error) {
      return {
        success: false,
        error: clearanceResult.error,
        updatedPaymentEntries: [],
        updatedUnallocatedAmount: 0,
        updatedAllocatedAmount: 0,
        clearanceUpdates: [],
        linkedBTUpdates: [],
      };
    }

    let { allocableAmount, shouldClear, clearanceDate } = clearanceResult;

    if (allocableAmount < 0) {
      return {
        success: false,
        error: `Voucher ${paymentEntry.payment_entry} is over-allocated by ${allocableAmount}`,
        updatedPaymentEntries: [],
        updatedUnallocatedAmount: 0,
        updatedAllocatedAmount: 0,
        clearanceUpdates: [],
        linkedBTUpdates: [],
      };
    }

    if (remainingAmount <= 0) {
      // Remove this payment entry
      continue;
    }

    if (allocableAmount === 0) {
      if (shouldClear) {
        clearanceUpdates.push({
          doctype: paymentEntry.payment_document,
          docname: paymentEntry.payment_entry,
          clearance_date: clearanceDate,
        });
      }
      continue;
    }

    shouldClear = shouldClear && allocableAmount <= remainingAmount;
    const allocated = Math.min(allocableAmount, remainingAmount);
    remainingAmount = flt(remainingAmount - allocated, 2);

    const updatedPE: BankTransactionPayment = {
      ...paymentEntry,
      allocated_amount: allocated,
    };
    updatedPaymentEntries.push(updatedPE);

    if (paymentEntry.payment_document === "Bank Transaction") {
      linkedBTUpdates.push({
        bankTransactionName: paymentEntry.payment_entry,
        allocatedAmount: allocated,
        add: true,
      });
    } else if (shouldClear) {
      clearanceUpdates.push({
        doctype: paymentEntry.payment_document,
        docname: paymentEntry.payment_entry,
        clearance_date: clearanceDate,
      });
    }
  }

  const totalAllocated = updatedPaymentEntries.reduce(
    (sum, p) => sum + flt(p.allocated_amount),
    0
  );
  const totalUnallocated =
    Math.abs(flt(doc.withdrawal) - flt(doc.deposit)) - totalAllocated;

  return {
    success: true,
    updatedPaymentEntries,
    updatedUnallocatedAmount: flt(totalUnallocated, 2),
    updatedAllocatedAmount: flt(totalAllocated, 2),
    clearanceUpdates,
    linkedBTUpdates,
  };
}

/* ------------------------------------------------------------------ */
/*  Delink / clear helpers                                             */
/* ------------------------------------------------------------------ */

export interface DelinkPaymentEntryResult {
  clearanceUpdates: ClearanceUpdate[];
  linkedBTUpdates: LinkedBTUpdate[];
}

export function delinkPaymentEntry(
  paymentEntry: BankTransactionPayment
): DelinkPaymentEntryResult {
  if (paymentEntry.payment_document === "Bank Transaction") {
    return {
      clearanceUpdates: [],
      linkedBTUpdates: [
        {
          bankTransactionName: paymentEntry.payment_entry,
          allocatedAmount: null,
          add: false,
        },
      ],
    };
  }

  return {
    clearanceUpdates: [
      {
        doctype: paymentEntry.payment_document,
        docname: paymentEntry.payment_entry,
        clearance_date: null,
      },
    ],
    linkedBTUpdates: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Auto set party                                                     */
/* ------------------------------------------------------------------ */

export function autoSetParty(
  doc: BankTransactionDoc,
  autoMatchResult?: { party_type: string; party: string } | null
): { party_type?: string; party?: string } | null {
  if (doc.party_type && doc.party) {
    return null;
  }

  if (!autoMatchResult) {
    return null;
  }

  return {
    party_type: autoMatchResult.party_type,
    party: autoMatchResult.party,
  };
}

/* ------------------------------------------------------------------ */
/*  Add payment entries                                                */
/* ------------------------------------------------------------------ */

export interface AddPaymentEntriesResult {
  success: boolean;
  error?: string;
  newPaymentEntries: BankTransactionPayment[];
}

export function addPaymentEntries(
  doc: BankTransactionDoc,
  vouchers: { payment_doctype: string; payment_name: string }[]
): AddPaymentEntriesResult {
  if (flt(doc.unallocated_amount) <= 0) {
    return {
      success: false,
      error: `Bank Transaction ${doc.name} is already fully reconciled`,
      newPaymentEntries: [],
    };
  }

  const newPaymentEntries: BankTransactionPayment[] = [];
  for (const voucher of vouchers) {
    newPaymentEntries.push({
      payment_document: voucher.payment_doctype,
      payment_entry: voucher.payment_name,
      allocated_amount: 0,
    });
  }

  return {
    success: true,
    newPaymentEntries,
  };
}

/* ------------------------------------------------------------------ */
/*  Determine which old payment entries to delink                      */
/* ------------------------------------------------------------------ */

export function getPaymentEntriesToDelink(
  currentEntries: BankTransactionPayment[],
  oldEntries: BankTransactionPayment[]
): BankTransactionPayment[] {
  const currentNames = new Set(
    currentEntries.map((pe) => `${pe.payment_document}:${pe.payment_entry}`)
  );

  const toDelink: BankTransactionPayment[] = [];
  for (const oldPe of oldEntries) {
    const key = `${oldPe.payment_document}:${oldPe.payment_entry}`;
    if (!currentNames.has(key)) {
      toDelink.push(oldPe);
    }
  }

  return toDelink;
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

export interface ValidateBankTransactionOptions {
  beforeSubmit?: boolean;
  beforeUpdateAfterSubmit?: boolean;
}

export interface ValidateBankTransactionResult {
  success: boolean;
  error?: string;
  updates?: Partial<BankTransactionDoc>;
  delinkOldPEs?: BankTransactionPayment[];
  allocationResult?: AllocatePaymentEntriesResult;
  clearanceUpdates?: ClearanceUpdate[];
  linkedBTUpdates?: LinkedBTUpdate[];
  partyUpdate?: { party_type?: string; party?: string };
}

export function validateBankTransaction(
  doc: BankTransactionDoc,
  ctx: BankTransactionValidationContext,
  opts: ValidateBankTransactionOptions = {}
): ValidateBankTransactionResult {
  try {
    // 1. Handle excluded fee
    const feeResult = handleExcludedFee(doc);
    if (feeResult.error) {
      return { success: false, error: feeResult.error };
    }
    const updates: Partial<BankTransactionDoc> = feeResult.updates
      ? { ...feeResult.updates }
      : {};

    // 2. Update allocated amounts
    const amounts = updateAllocatedAmount({ ...doc, ...updates });
    updates.allocated_amount = amounts.allocated_amount;
    updates.unallocated_amount = amounts.unallocated_amount;

    // 3. Validate included fee
    const includedFeeErr = validateIncludedFee({ ...doc, ...updates });
    if (includedFeeErr) {
      return { success: false, error: includedFeeErr };
    }

    // 4. Validate duplicate references
    const dupErr = validateDuplicateReferences(
      doc.payment_entries ?? []
    );
    if (dupErr) {
      return { success: false, error: dupErr };
    }

    // 5. Validate currency
    const currencyErr = validateBankTransactionCurrency(
      { ...doc, ...updates },
      ctx.bankAccountCurrency
    );
    if (currencyErr) {
      return { success: false, error: currencyErr };
    }

    // 6. Determine delinked old payment entries
    let delinkOldPEs: BankTransactionPayment[] | undefined;
    if (ctx.docBeforeSave && !ctx.updatingLinkedBankTransaction) {
      delinkOldPEs = getPaymentEntriesToDelink(
        doc.payment_entries ?? [],
        ctx.docBeforeSave.payment_entries ?? []
      );
    }

    // 7. Allocate payment entries (on submit or after submit update)
    let allocationResult: AllocatePaymentEntriesResult | undefined;
    if (opts.beforeSubmit || opts.beforeUpdateAfterSubmit) {
      allocationResult = allocatePaymentEntries(
        { ...doc, ...updates },
        ctx
      );
      if (!allocationResult.success) {
        return {
          success: false,
          error: allocationResult.error,
        };
      }
      updates.payment_entries = allocationResult.updatedPaymentEntries;
      updates.allocated_amount = allocationResult.updatedAllocatedAmount;
      updates.unallocated_amount = allocationResult.updatedUnallocatedAmount;
    }

    // 8. Set status
    updates.status = getBankTransactionStatus(
      doc.docstatus,
      updates.unallocated_amount ?? doc.unallocated_amount
    ) as BankTransactionDoc["status"];

    // 9. Auto set party
    if (opts.beforeSubmit && ctx.enablePartyMatching) {
      const partyUpdate = autoSetParty(doc, ctx.autoMatchPartyResult);
      if (partyUpdate) {
        updates.party_type = partyUpdate.party_type;
        updates.party = partyUpdate.party;
      }
    }

    return {
      success: true,
      updates,
      delinkOldPEs,
      allocationResult,
      clearanceUpdates: allocationResult?.clearanceUpdates,
      linkedBTUpdates: allocationResult?.linkedBTUpdates,
      partyUpdate:
        opts.beforeSubmit && ctx.enablePartyMatching
          ? { party_type: updates.party_type, party: updates.party }
          : undefined,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Reconciliation doctypes helper                                     */
/* ------------------------------------------------------------------ */

export function getDoctypesForBankReconciliation(): string[] {
  return [
    "Payment Entry",
    "Journal Entry",
    "Sales Invoice",
    "Purchase Invoice",
    "Bank Transaction",
  ];
}

/* ------------------------------------------------------------------ */
/*  Related GL entries (pure — caller builds from query result)        */
/* ------------------------------------------------------------------ */

export interface GLQueryRow {
  doctype: string;
  docname: string;
  gl_account: string;
  amount: number;
}

export function buildRelatedBankGLEntries(rows: GLQueryRow[]): RelatedGLEntriesMap {
  const entries: RelatedGLEntriesMap = {};
  for (const row of rows) {
    const key = `${row.doctype}:${row.docname}`;
    if (!entries[key]) {
      entries[key] = {};
    }
    entries[key][row.gl_account] = row.amount;
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/*  Total allocated amount (pure — caller builds from query result)    */
/* ------------------------------------------------------------------ */

export interface BTAllocationQueryRow {
  total: number;
  latest_date?: string;
  gl_account: string;
  payment_document: string;
  payment_entry: string;
}

export function buildTotalAllocatedAmount(
  rows: BTAllocationQueryRow[]
): PaymentEntryBTAllocationMap {
  const details: PaymentEntryBTAllocationMap = {};
  for (const row of rows) {
    const key = `${row.payment_document}:${row.payment_entry}`;
    if (!details[key]) {
      details[key] = {};
    }
    details[key][row.gl_account] = {
      total: row.total,
      latest_date: row.latest_date,
    };
  }
  return details;
}

/* ------------------------------------------------------------------ */
/*  Get reconciled bank transactions (pure filter)                     */
/* ------------------------------------------------------------------ */

export function getReconciledBankTransactions(
  doctype: string,
  docname: string,
  allBTPaymentRows: { payment_document: string; payment_entry: string; parent: string }[]
): string[] {
  const parents = new Set<string>();
  for (const row of allBTPaymentRows) {
    if (row.payment_document === doctype && row.payment_entry === docname) {
      parents.add(row.parent);
    }
  }
  return Array.from(parents);
}

/* ------------------------------------------------------------------ */
/*  Remove from bank transaction (pure — returns which BTs to modify)  */
/* ------------------------------------------------------------------ */

export interface RemoveFromBankTransactionResult {
  bankTransactionNames: string[];
  modifications: {
    btName: string;
    paymentEntriesToRemove: { payment_document: string; payment_entry: string }[];
  }[];
}

export function removeFromBankTransaction(
  doctype: string,
  docname: string,
  allBTPaymentRows: { payment_document: string; payment_entry: string; parent: string }[],
  cancelledBTNames: Set<string>
): RemoveFromBankTransactionResult {
  const btNames = getReconciledBankTransactions(doctype, docname, allBTPaymentRows);

  const modifications: RemoveFromBankTransactionResult["modifications"] = [];

  for (const btName of btNames) {
    if (cancelledBTNames.has(btName)) {
      continue;
    }

    const pesToRemove = allBTPaymentRows.filter(
      (r) =>
        r.parent === btName &&
        r.payment_document === doctype &&
        r.payment_entry === docname
    );

    if (pesToRemove.length > 0) {
      modifications.push({
        btName,
        paymentEntriesToRemove: pesToRemove.map((r) => ({
          payment_document: r.payment_document,
          payment_entry: r.payment_entry,
        })),
      });
    }
  }

  return {
    bankTransactionNames: btNames,
    modifications,
  };
}
