/**
 * Typed ERPNext API Helpers — built on top of lib/frappe-client.ts.
 *
 * Provides strongly-typed wrappers for the most common ERPNext DocTypes
 * and workflows so that Server Actions remain concise and type-safe.
 */

"use server";

import {
  frappeGetList,
  frappeGetDoc,
  frappeInsertDoc,
  frappeUpdateDoc,
  frappeDeleteDoc,
  frappeSetValue,
  frappeSubmitDoc,
  frappeCancelDoc,
  frappeCallMethod,
  frappeRunReport,
  FrappeError,
} from "./frappe-client";

// ── Sales Invoice ───────────────────────────────────────────────────────────

export async function getSalesInvoices(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Sales Invoice", { filters, order_by: "creation desc" });
}

export async function getSalesInvoice(name: string) {
  return frappeGetDoc<any>("Sales Invoice", name);
}

export async function createSalesInvoice(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Sales Invoice", doc);
}

export async function makeDeliveryNote(source_name: string) {
  return frappeCallMethod<any>("erpnext.selling.doctype.sales_order.sales_order.make_delivery_note", {
    source_name,
  });
}

export async function makeSalesReturn(source_name: string) {
  return frappeCallMethod<any>("erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return", {
    source_name,
  });
}

// ── Sales Order ─────────────────────────────────────────────────────────────

export async function getSalesOrders(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Sales Order", { filters, order_by: "creation desc" });
}

export async function getSalesOrder(name: string) {
  return frappeGetDoc<any>("Sales Order", name);
}

export async function createSalesOrder(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Sales Order", doc);
}

export async function makePurchaseOrderForSO(source_name: string) {
  return frappeCallMethod<any>("erpnext.selling.doctype.sales_order.sales_order.make_inter_company_purchase_order", {
    source_name,
  });
}

export async function makeWorkOrders(source_name: string) {
  return frappeCallMethod<any>("erpnext.selling.doctype.sales_order.sales_order.make_work_orders", {
    source_name,
  });
}

// ── Purchase Order ──────────────────────────────────────────────────────────

export async function getPurchaseOrders(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Purchase Order", { filters, order_by: "creation desc" });
}

export async function getPurchaseOrder(name: string) {
  return frappeGetDoc<any>("Purchase Order", name);
}

export async function createPurchaseOrder(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Purchase Order", doc);
}

export async function makePurchaseReceipt(source_name: string) {
  return frappeCallMethod<any>("erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt", {
    source_name,
  });
}

export async function makePurchaseInvoiceFromPO(source_name: string) {
  return frappeCallMethod<any>("erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice", {
    source_name,
  });
}

// ── Item / Stock ────────────────────────────────────────────────────────────

export async function getItems(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Item", { filters, order_by: "creation desc", limit_page_length: 500 });
}

export async function getItem(name: string) {
  return frappeGetDoc<any>("Item", name);
}

export async function createItem(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Item", doc);
}

export async function getWarehouses(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Warehouse", { filters, limit_page_length: 500 });
}

export async function getWarehouse(name: string) {
  return frappeGetDoc<any>("Warehouse", name);
}

export async function getStockBalance(item_code: string, warehouse: string) {
  return frappeCallMethod<any>("erpnext.stock.utils.get_stock_balance", {
    item_code,
    warehouse,
  });
}

export async function getStockValueOn(warehouse: string) {
  return frappeCallMethod<any>("erpnext.stock.utils.get_stock_value_on", {
    warehouse,
  });
}

export async function getItemDetails(args: {
  item_code: string;
  warehouse?: string;
  customer?: string;
  company?: string;
  doctype?: string;
}) {
  return frappeCallMethod<any>("erpnext.stock.get_item_details.get_item_details", {
    args: { ...args, transaction_date: new Date().toISOString().slice(0, 10) },
  });
}

export async function getStockEntries(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Stock Entry", { filters, order_by: "creation desc" });
}

export async function createStockEntry(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Stock Entry", doc);
}

export async function makeStockInEntry(source_name: string) {
  return frappeCallMethod<any>("erpnext.stock.doctype.stock_entry.stock_entry.make_stock_in_entry", {
    source_name,
  });
}

// ── Customer / Supplier ─────────────────────────────────────────────────────

export async function getCustomers(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Customer", { filters, order_by: "creation desc" });
}

export async function getCustomer(name: string) {
  return frappeGetDoc<any>("Customer", name);
}

export async function createCustomer(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Customer", doc);
}

export async function makeQuotationFromCustomer(source_name: string) {
  return frappeCallMethod<any>("erpnext.selling.doctype.customer.customer.make_quotation", {
    source_name,
  });
}

export async function makeOpportunityFromCustomer(source_name: string) {
  return frappeCallMethod<any>("erpnext.crm.doctype.lead.lead.make_opportunity", {
    source_name,
  });
}

export async function getSuppliers(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Supplier", { filters, order_by: "creation desc" });
}

export async function getSupplier(name: string) {
  return frappeGetDoc<any>("Supplier", name);
}

// ── Account / Journal Entry ─────────────────────────────────────────────────

export async function getAccounts(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Account", { filters, order_by: "lft asc", limit_page_length: 1000 });
}

export async function getAccount(name: string) {
  return frappeGetDoc<any>("Account", name);
}

export async function getJournalEntries(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Journal Entry", { filters, order_by: "creation desc" });
}

export async function getJournalEntry(name: string) {
  return frappeGetDoc<any>("Journal Entry", name);
}

export async function createJournalEntry(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Journal Entry", doc);
}

export async function getBalanceOn(account: string, date?: string) {
  return frappeCallMethod<number>("erpnext.accounts.utils.get_balance_on", {
    account,
    date: date || new Date().toISOString().slice(0, 10),
  });
}

export async function getFiscalYear(date?: string) {
  return frappeCallMethod<any>("erpnext.accounts.utils.get_fiscal_year", {
    date: date || new Date().toISOString().slice(0, 10),
  });
}

// ── Payment Entry ───────────────────────────────────────────────────────────

export async function getPaymentEntries(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Payment Entry", { filters, order_by: "creation desc" });
}

export async function createPaymentEntry(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Payment Entry", doc);
}

export async function getOutstandingReferences(args: {
  account?: string;
  party_type?: string;
  party?: string;
  company?: string;
}) {
  return frappeCallMethod<any>("erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents", {
    ...args,
  });
}

// ── Project ─────────────────────────────────────────────────────────────────

export async function getProjects(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Project", { filters, order_by: "creation desc" });
}

export async function getProject(name: string) {
  return frappeGetDoc<any>("Project", name);
}

export async function createProject(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Project", doc);
}

export async function getTasks(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Task", { filters, order_by: "creation desc" });
}

export async function getTimesheets(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Timesheet", { filters, order_by: "creation desc" });
}

// ── Employee / HR ───────────────────────────────────────────────────────────

export async function getEmployees(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Employee", { filters, order_by: "creation desc" });
}

export async function getEmployee(name: string) {
  return frappeGetDoc<any>("Employee", name);
}

export async function createEmployee(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Employee", doc);
}

export async function getDepartments(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Department", { filters });
}

// ── Asset ───────────────────────────────────────────────────────────────────

export async function getAssets(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Asset", { filters, order_by: "creation desc" });
}

export async function getAsset(name: string) {
  return frappeGetDoc<any>("Asset", name);
}

export async function createAsset(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Asset", doc);
}

// ── Quotation ───────────────────────────────────────────────────────────────

export async function getQuotations(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Quotation", { filters, order_by: "creation desc" });
}

export async function getQuotation(name: string) {
  return frappeGetDoc<any>("Quotation", name);
}

export async function createQuotation(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Quotation", doc);
}

export async function makeSalesOrderFromQuotation(source_name: string) {
  return frappeCallMethod<any>("erpnext.selling.doctype.quotation.quotation.make_sales_order", {
    source_name,
  });
}

// ── Lead / Opportunity (CRM) ────────────────────────────────────────────────

export async function getLeads(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Lead", { filters, order_by: "creation desc" });
}

export async function getOpportunities(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Opportunity", { filters, order_by: "creation desc" });
}

export async function createOpportunity(doc: Record<string, unknown>) {
  return frappeInsertDoc<any>("Opportunity", doc);
}

export async function makeCustomerFromLead(source_name: string) {
  return frappeCallMethod<any>("erpnext.crm.doctype.lead.lead.make_customer", {
    source_name,
  });
}

export async function makeQuotationFromOpportunity(source_name: string) {
  return frappeCallMethod<any>("erpnext.crm.doctype.opportunity.opportunity.make_quotation", {
    source_name,
  });
}

// ── BOM / Manufacturing ─────────────────────────────────────────────────────

export async function getBOMs(filters?: Record<string, unknown>) {
  return frappeGetList<any>("BOM", { filters, order_by: "creation desc" });
}

export async function getWorkOrders(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Work Order", { filters, order_by: "creation desc" });
}

export async function getJobCards(filters?: Record<string, unknown>) {
  return frappeGetList<any>("Job Card", { filters, order_by: "creation desc" });
}

// ── Company / Settings ──────────────────────────────────────────────────────

export async function getCompany(name?: string) {
  return frappeGetDoc<any>("Company", name || "Aries Marine");
}

export async function getSystemSettings() {
  return frappeGetDoc<any>("System Settings", "System Settings");
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function runGeneralLedger(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("General Ledger", filters);
}

export async function runTrialBalance(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Trial Balance", filters);
}

export async function runBalanceSheet(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Balance Sheet", filters);
}

export async function runProfitAndLoss(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Profit and Loss Statement", filters);
}

export async function runStockBalanceReport(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Stock Balance", filters);
}

export async function runStockLedger(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Stock Ledger", filters);
}

export async function runSalesAnalytics(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Sales Analytics", filters);
}

export async function runPurchaseAnalytics(filters?: Record<string, unknown>) {
  return frappeRunReport<any>("Purchase Analytics", filters);
}

// ── Search / Utilities ──────────────────────────────────────────────────────

export async function searchLink(doctype: string, txt: string, filters?: Record<string, unknown>) {
  return frappeCallMethod<any>("frappe.desk.search.search_link", {
    doctype,
    txt,
    filters: filters ? JSON.stringify(filters) : undefined,
  });
}

export async function getDoctypeSchema(doctype: string) {
  return frappeCallMethod<any>("frappe.desk.form.load.getdoctype", {
    doctype,
    with_parent: 1,
  });
}

export async function getDocTypeMeta(doctype: string) {
  return frappeCallMethod<any>("frappe.client.get", {
    doctype: "DocType",
    name: doctype,
  });
}
