/**
 * Ported from erpnext/manufacturing/doctype/work_order/work_order.py
 * Pure business logic for Work Order DocType.
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

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function dateDiffInDays(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WorkOrderOperation {
  idx: number;
  name?: string;
  operation: string;
  description?: string;
  workstation?: string;
  workstation_type?: string;
  bom?: string;
  bom_no?: string;
  finished_good?: string;
  is_subcontracted?: number;
  skip_material_transfer?: number;
  backflush_from_wip_warehouse?: number;
  source_warehouse?: string;
  wip_warehouse?: string;
  fg_warehouse?: string;
  hour_rate?: number;
  time_in_mins: number;
  batch_size?: number;
  sequence_id?: number;
  fixed_time?: number;
  set_cost_based_on_bom_qty?: number;
  quality_inspection_required?: number;
  planned_start_time?: string;
  planned_end_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  actual_operation_time?: number;
  planned_operating_cost?: number;
  actual_operating_cost?: number;
  completed_qty?: number;
  process_loss_qty?: number;
  status?: "Pending" | "Work in Progress" | "Completed";
  job_card_qty?: number;
  qty?: number;
  serial_no?: string;
}

export interface WorkOrderItem {
  idx?: number;
  name?: string;
  item_code: string;
  item_name?: string;
  description?: string;
  operation?: string;
  operation_row_id?: number;
  source_warehouse?: string;
  required_qty: number;
  stock_uom?: string;
  rate?: number;
  amount?: number;
  transferred_qty?: number;
  consumed_qty?: number;
  returned_qty?: number;
  available_qty_at_source_warehouse?: number;
  available_qty_at_wip_warehouse?: number;
  stock_reserved_qty?: number;
  allow_alternative_item?: number;
  include_item_in_manufacturing?: number;
  is_additional_item?: number;
  is_customer_provided_item?: number;
  voucher_detail_reference?: string;
}

export interface WorkOrderDoc {
  name?: string;
  production_item: string;
  item_name?: string;
  description?: string;
  stock_uom?: string;
  bom_no?: string;
  qty: number;
  company: string;
  sales_order?: string;
  sales_order_item?: string;
  project?: string;
  status?: string;
  docstatus?: number;
  skip_transfer?: number;
  from_wip_warehouse?: number;
  use_multi_level_bom?: number;
  track_semi_finished_goods?: number;
  transfer_material_against?: "" | "Work Order" | "Job Card";
  wip_warehouse?: string;
  fg_warehouse?: string;
  scrap_warehouse?: string;
  source_warehouse?: string;
  material_transferred_for_manufacturing?: number;
  additional_transferred_qty?: number;
  produced_qty?: number;
  process_loss_qty?: number;
  disassembled_qty?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  expected_delivery_date?: string;
  lead_time?: number;
  planned_operating_cost?: number;
  actual_operating_cost?: number;
  additional_operating_cost?: number;
  corrective_operation_cost?: number;
  total_operating_cost?: number;
  has_serial_no?: number;
  has_batch_no?: number;
  batch_size?: number;
  reserve_stock?: number;
  operations: WorkOrderOperation[];
  required_items: WorkOrderItem[];
  production_plan?: string;
  production_plan_item?: string;
  production_plan_sub_assembly_item?: string;
  material_request?: string;
  material_request_item?: string;
  subcontracting_inward_order?: string;
  subcontracting_inward_order_item?: string;
  product_bundle_item?: string;
  max_producible_qty?: number;
}

export interface BOMLookup {
  name: string;
  item: string;
  quantity: number;
  docstatus?: number;
  with_operations?: number;
  track_semi_finished_goods?: number;
  transfer_material_against?: string;
  operations?: WorkOrderOperation[];
  items?: Array<{
    item_code: string;
    item_name?: string;
    stock_uom?: string;
    description?: string;
    qty?: number;
    stock_qty?: number;
    rate?: number;
    uom?: string;
    conversion_factor?: number;
    source_warehouse?: string;
    operation?: string;
    include_item_in_manufacturing?: number;
    operation_row_id?: number;
    is_phantom_item?: number;
    bom_no?: string;
    allow_alternative_item?: number;
  }>;
}

export interface ItemMaster {
  item_code: string;
  has_variants?: number;
  end_of_life?: string;
  stock_uom?: string;
  allow_alternative_item?: number;
  include_item_in_manufacturing?: number;
  default_warehouse?: string;
  is_customer_provided_item?: number;
  must_be_whole_number?: number;
}

export interface SalesOrderItemLookup {
  item_code: string;
  stock_qty: number;
  delivered_qty?: number;
  warehouse?: string;
}

export interface ProductionPlanItemLookup {
  planned_qty: number;
  ordered_qty: number;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface JobCardData {
  work_order?: string;
  workstation_type?: string;
  operation: string;
  workstation?: string;
  operation_row_id: number;
  posting_date?: string;
  for_quantity: number;
  operation_id?: string;
  bom_no?: string;
  project?: string;
  company?: string;
  sequence_id?: number;
  hour_rate?: number;
  serial_no?: string;
  time_required: number;
  source_warehouse?: string;
  target_warehouse?: string;
  wip_warehouse?: string;
  skip_material_transfer?: number;
  backflush_from_wip_warehouse?: number;
  finished_good?: string;
  semi_fg_bom?: string;
  is_subcontracted?: number;
}

/* ------------------------------------------------------------------ */
/*  validateWorkOrder                                                  */
/* ------------------------------------------------------------------ */

export function validateWorkOrder(
  doc: WorkOrderDoc,
  itemMaster: ItemMaster,
  bomLookup?: BOMLookup,
  soItem?: SalesOrderItemLookup,
  ppItem?: ProductionPlanItemLookup,
  uomMaster?: { must_be_whole_number?: number },
  overproductionPercentage = 0,
  transferExtraPercentage = 0
): ValidationResult {
  const warnings: string[] = [];

  // Validate production item
  const prodErr = validateProductionItem(doc, itemMaster);
  if (prodErr) return { success: false, error: prodErr };

  // Validate BOM
  if (doc.bom_no && bomLookup) {
    if (bomLookup.docstatus !== 1) {
      return { success: false, error: `BOM ${doc.bom_no} must be submitted` };
    }
    if (bomLookup.item !== doc.production_item) {
      return { success: false, error: `BOM ${doc.bom_no} does not belong to Item ${doc.production_item}` };
    }
  }

  // Validate qty
  const qtyErr = validateQty(doc, ppItem, uomMaster, overproductionPercentage);
  if (qtyErr) return { success: false, error: qtyErr };

  // Validate operation time
  const opTimeErr = validateOperationTime(doc);
  if (opTimeErr) return { success: false, error: opTimeErr };

  // Validate operations sequence
  const seqErr = validateOperationsSequence(doc);
  if (seqErr) return { success: false, error: seqErr };

  // Validate transfer against
  const transferErr = validateTransferAgainst(doc);
  if (transferErr) return { success: false, error: transferErr };

  // Validate dates
  const datesErr = validateDates(doc);
  if (datesErr) return { success: false, error: datesErr };

  // Set default warehouses
  setDefaultWarehouse(doc);
  checkWIPWarehouseSkip(doc);

  // Calculate operating cost
  calculateOperatingCost(doc);

  // Set status
  doc.status = getStatus(doc);

  // Validate against sales order
  if (doc.sales_order && soItem) {
    const soErr = validateWorkOrderAgainstSO(doc, soItem, overproductionPercentage);
    if (soErr) return { success: false, error: soErr };
  }

  // Validate additional transferred qty
  if (doc.additional_transferred_qty) {
    const addErr = validateAdditionalTransferredQty(doc, transferExtraPercentage);
    if (addErr) return { success: false, error: addErr };
  }

  return { success: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  validateProductionItem                                             */
/* ------------------------------------------------------------------ */

export function validateProductionItem(
  doc: WorkOrderDoc,
  itemMaster: ItemMaster
): string | undefined {
  if (itemMaster.has_variants) {
    return "Work Order cannot be raised against a Item Template";
  }
  if (itemMaster.end_of_life) {
    const eol = getdate(itemMaster.end_of_life);
    if (eol < new Date()) {
      return `Item ${doc.production_item} has reached its end of life`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateQty                                                        */
/* ------------------------------------------------------------------ */

export function validateQty(
  doc: WorkOrderDoc,
  ppItem?: ProductionPlanItemLookup,
  uomMaster?: { must_be_whole_number?: number },
  overproductionPercentage = 0
): string | undefined {
  if (flt(doc.qty) <= 0) {
    return "Quantity to Manufacture must be greater than 0.";
  }

  if (uomMaster?.must_be_whole_number && Math.abs(cint(doc.qty) - flt(doc.qty)) > 0.0000001) {
    return `Qty To Manufacture (${flt(doc.qty)}) cannot be a fraction for the UOM ${doc.stock_uom}.`;
  }

  if (ppItem) {
    const allowanceQty = flt(overproductionPercentage) / 100 * flt(ppItem.planned_qty);
    const maxQty = flt(ppItem.planned_qty) + allowanceQty - flt(ppItem.ordered_qty);
    if (maxQty <= 0) {
      return `Cannot produce more item for ${doc.production_item}`;
    }
    if (flt(doc.qty) > maxQty) {
      return `Cannot produce more than ${maxQty} items for ${doc.production_item}`;
    }
  }

  if (doc.subcontracting_inward_order && doc.max_producible_qty && flt(doc.qty) > flt(doc.max_producible_qty)) {
    // Warning only; caller can inspect doc.qty vs max_producible_qty
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateOperationTime                                              */
/* ------------------------------------------------------------------ */

export function validateOperationTime(doc: WorkOrderDoc): string | undefined {
  for (const d of doc.operations) {
    if (flt(d.time_in_mins) <= 0) {
      return `Operation Time must be greater than 0 for Operation ${d.operation}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateOperationsSequence                                         */
/* ------------------------------------------------------------------ */

export function validateOperationsSequence(doc: WorkOrderDoc): string | undefined {
  if (!doc.operations || doc.operations.length === 0) return undefined;

  const allEmpty = doc.operations.every((op) => !op.sequence_id);
  if (allEmpty) {
    for (const op of doc.operations) {
      op.sequence_id = op.idx;
    }
    return undefined;
  }

  let sequenceId = 1;
  for (const op of doc.operations) {
    if (op.idx === 1 && op.sequence_id !== 1) {
      return `Row #1: Sequence ID must be 1 for Operation ${op.operation}.`;
    } else if (op.sequence_id !== sequenceId && op.sequence_id !== sequenceId + 1) {
      return `Row #${op.idx}: Sequence ID must be ${sequenceId} or ${sequenceId + 1} for Operation ${op.operation}.`;
    }
    sequenceId = op.sequence_id || sequenceId;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateTransferAgainst                                            */
/* ------------------------------------------------------------------ */

export function validateTransferAgainst(doc: WorkOrderDoc): string | undefined {
  if (!doc.operations || doc.operations.length === 0) {
    doc.transfer_material_against = "Work Order";
  }
  if (!doc.transfer_material_against && !doc.track_semi_finished_goods) {
    return "Setting Transfer Material Against is required";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateDates                                                      */
/* ------------------------------------------------------------------ */

export function validateDates(doc: WorkOrderDoc): string | undefined {
  if (doc.actual_start_date && doc.actual_end_date) {
    if (getdate(doc.actual_end_date) < getdate(doc.actual_start_date)) {
      return "Actual End Date cannot be before Actual Start Date";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  setDefaultWarehouse                                                */
/* ------------------------------------------------------------------ */

export function setDefaultWarehouse(doc: WorkOrderDoc): void {
  if (!doc.wip_warehouse && !doc.skip_transfer) {
    // Caller should set from company defaults
  }
  if (!doc.fg_warehouse) {
    // Caller should set from company defaults
  }
}

/* ------------------------------------------------------------------ */
/*  checkWIPWarehouseSkip                                              */
/* ------------------------------------------------------------------ */

export function checkWIPWarehouseSkip(doc: WorkOrderDoc): void {
  if (doc.skip_transfer && !doc.from_wip_warehouse) {
    doc.wip_warehouse = undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  calculateOperatingCost                                             */
/* ------------------------------------------------------------------ */

export function calculateOperatingCost(doc: WorkOrderDoc): void {
  doc.planned_operating_cost = 0;
  doc.actual_operating_cost = 0;

  for (const d of doc.operations) {
    if (!d.hour_rate && d.workstation) {
      // Caller should set hour_rate from workstation master
    }

    d.planned_operating_cost = flt(
      flt(d.hour_rate || 0) * (flt(d.time_in_mins) / 60.0),
      2
    );
    d.actual_operating_cost = flt(
      flt(d.hour_rate || 0) * (flt(d.actual_operation_time || 0) / 60.0),
      2
    );

    doc.planned_operating_cost = flt(flt(doc.planned_operating_cost) + flt(d.planned_operating_cost), 2);
    doc.actual_operating_cost = flt(flt(doc.actual_operating_cost) + flt(d.actual_operating_cost), 2);
  }

  const variableCost = doc.actual_operating_cost || doc.planned_operating_cost;
  doc.total_operating_cost = flt(
    flt(doc.additional_operating_cost || 0) + flt(variableCost || 0) + flt(doc.corrective_operation_cost || 0),
    2
  );
}

/* ------------------------------------------------------------------ */
/*  getStatus                                                          */
/* ------------------------------------------------------------------ */

export function getStatus(doc: WorkOrderDoc): string {
  let status = doc.status || "";

  if (doc.docstatus === 0) {
    status = "Draft";
  } else if (doc.docstatus === 1) {
    if (status !== "Closed" && status !== "Stopped") {
      status = "Not Started";
      if (flt(doc.material_transferred_for_manufacturing || 0) > 0) {
        status = "In Process";
      }

      const totalQty = flt(doc.produced_qty || 0) + flt(doc.process_loss_qty || 0);
      if (flt(totalQty) >= flt(doc.qty)) {
        status = "Completed";
      }
    }
  } else {
    status = "Cancelled";
  }

  if (doc.skip_transfer && doc.produced_qty && flt(doc.qty) > flt(doc.produced_qty || 0) + flt(doc.process_loss_qty || 0)) {
    status = "In Process";
  }

  if (status !== "Completed" && doc.operations && doc.operations.length > 0) {
    if (!doc.operations.every((d) => d.status === "Pending")) {
      status = "In Process";
    }
  }

  if (status === "Not Started" && doc.reserve_stock) {
    let allReserved = true;
    let someReserved = false;
    for (const row of doc.required_items) {
      if (!row.stock_reserved_qty) continue;
      if (flt(row.stock_reserved_qty) >= flt(row.required_qty)) {
        someReserved = true;
      } else {
        allReserved = false;
        someReserved = true;
        break;
      }
    }
    if (allReserved && someReserved) {
      status = "Stock Reserved";
    } else if (someReserved) {
      status = "Stock Partially Reserved";
    }
  }

  return status;
}

/* ------------------------------------------------------------------ */
/*  validateWorkOrderAgainstSO                                         */
/* ------------------------------------------------------------------ */

export function validateWorkOrderAgainstSO(
  doc: WorkOrderDoc,
  soItem: SalesOrderItemLookup,
  overproductionPercentage = 0
): string | undefined {
  const soQty = flt(soItem.stock_qty);
  const allowance = flt(overproductionPercentage) / 100 * soQty;

  // In pure logic, we assume ordered_qty_against_so is passed via context or caller handles it
  // We validate that doc.qty does not exceed SO qty + allowance
  if (flt(doc.qty) > soQty + allowance) {
    return `Cannot produce more Item ${doc.production_item} than Sales Order quantity ${soQty}`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateAdditionalTransferredQty                                   */
/* ------------------------------------------------------------------ */

export function validateAdditionalTransferredQty(
  doc: WorkOrderDoc,
  transferExtraMaterialsPercentage = 0
): string | undefined {
  const allowedQty = flt(doc.qty) + flt(flt(doc.qty) * flt(transferExtraMaterialsPercentage) / 100);
  const actualQty = flt(doc.material_transferred_for_manufacturing || 0) + flt(doc.additional_transferred_qty || 0);

  if (flt(allowedQty - actualQty) < 0) {
    return `Additional Transferred Qty ${actualQty} cannot be greater than ${allowedQty}.`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  updateOperationStatus                                              */
/* ------------------------------------------------------------------ */

export function updateOperationStatus(doc: WorkOrderDoc, overproductionPercentage = 0): void {
  const maxAllowedQty = flt(doc.qty) + (flt(overproductionPercentage) / 100 * flt(doc.qty));

  for (const d of doc.operations) {
    const qty = flt(d.completed_qty || 0) + flt(d.process_loss_qty || 0);
    if (!qty) {
      d.status = "Pending";
    } else if (qty < flt(doc.qty)) {
      d.status = "Work in Progress";
    } else if (qty === flt(doc.qty)) {
      d.status = "Completed";
    } else if (qty <= flt(maxAllowedQty)) {
      d.status = "Completed";
    }
  }
}

/* ------------------------------------------------------------------ */
/*  setActualDates                                                     */
/* ------------------------------------------------------------------ */

export function setActualDates(doc: WorkOrderDoc): void {
  if (doc.operations && doc.operations.length > 0) {
    const actualStartDates = doc.operations
      .filter((d) => d.actual_start_time)
      .map((d) => getdate(d.actual_start_time!));
    if (actualStartDates.length) {
      doc.actual_start_date = new Date(Math.min(...actualStartDates.map((d) => d.getTime()))).toISOString();
    }

    const actualEndDates = doc.operations
      .filter((d) => d.actual_end_time)
      .map((d) => getdate(d.actual_end_time!));
    if (actualEndDates.length) {
      doc.actual_end_date = new Date(Math.max(...actualEndDates.map((d) => d.getTime()))).toISOString();
    }
  }

  setLeadTime(doc);
}

/* ------------------------------------------------------------------ */
/*  setLeadTime                                                        */
/* ------------------------------------------------------------------ */

export function setLeadTime(doc: WorkOrderDoc): void {
  if (doc.actual_start_date && doc.actual_end_date) {
    const start = getdate(doc.actual_start_date);
    const end = getdate(doc.actual_end_date);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    doc.lead_time = flt(diffHours * 60, 2);
  }
}

/* ------------------------------------------------------------------ */
/*  setOperationStartEndTime                                           */
/* ------------------------------------------------------------------ */

export function setOperationStartEndTime(
  doc: WorkOrderDoc,
  row: WorkOrderOperation,
  idx: number,
  minsBetweenOperations = 0
): string | undefined {
  if (idx === 0) {
    row.planned_start_time = doc.planned_start_date;
  } else if (doc.operations[idx - 1].sequence_id) {
    const prevOp = doc.operations[idx - 1];
    if (prevOp.sequence_id === row.sequence_id) {
      row.planned_start_time = prevOp.planned_start_time;
    } else {
      const sameSequenceOps = doc.operations
        .filter((op) => op.sequence_id === prevOp.sequence_id)
        .map((op) => ({ ...op, end: getdate(op.planned_end_time!) }))
        .sort((a, b) => a.end.getTime() - b.end.getTime());
      const lastSame = sameSequenceOps[sameSequenceOps.length - 1];
      row.planned_start_time = addMinutes(getdate(lastSame.planned_end_time!), minsBetweenOperations).toISOString();
    }
  } else {
    const prevEnd = doc.operations[idx - 1].planned_end_time;
    row.planned_start_time = addMinutes(getdate(prevEnd!), minsBetweenOperations).toISOString();
  }

  row.planned_end_time = addMinutes(getdate(row.planned_start_time!), row.time_in_mins).toISOString();

  if (row.planned_start_time === row.planned_end_time) {
    return "Capacity Planning Error, planned start time can not be same as end time";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  splitQtyBasedOnBatchSize                                           */
/* ------------------------------------------------------------------ */

export function splitQtyBasedOnBatchSize(
  woDoc: WorkOrderDoc,
  row: WorkOrderOperation,
  qty: number,
  createJobCardBasedOnBatchSize = false
): number {
  if (!createJobCardBasedOnBatchSize) {
    row.batch_size = row.batch_size || woDoc.qty;
  }

  row.job_card_qty = row.batch_size || qty;
  if (row.batch_size && qty >= row.batch_size) {
    qty -= row.batch_size;
  } else if (qty > 0) {
    row.job_card_qty = qty;
    qty = 0;
  }

  return qty;
}

/* ------------------------------------------------------------------ */
/*  validateOperationData                                              */
/* ------------------------------------------------------------------ */

export function validateOperationData(row: WorkOrderOperation, pendingQty?: number): string | undefined {
  if (flt(row.qty || 0) <= 0) {
    return `Quantity to Manufacture can not be zero for the operation ${row.operation}`;
  }
  if (pendingQty !== undefined && flt(row.qty || 0) > flt(pendingQty)) {
    return `For operation ${row.operation}: Quantity (${row.qty}) can not be greater than pending quantity(${pendingQty})`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  createJobCardData                                                  */
/* ------------------------------------------------------------------ */

export function createJobCardData(
  workOrder: WorkOrderDoc,
  row: WorkOrderOperation
): JobCardData {
  const qty = row.job_card_qty || workOrder.qty;
  return {
    work_order: workOrder.name,
    workstation_type: row.workstation_type,
    operation: row.operation,
    workstation: row.workstation,
    operation_row_id: cint(row.idx),
    posting_date: new Date().toISOString().split("T")[0],
    for_quantity: qty,
    operation_id: row.name,
    bom_no: workOrder.bom_no,
    project: workOrder.project,
    company: workOrder.company,
    sequence_id: row.sequence_id,
    hour_rate: row.hour_rate,
    serial_no: row.serial_no,
    time_required: (flt(row.time_in_mins || 0) / flt(workOrder.qty || 1)) * qty,
    source_warehouse: row.source_warehouse || workOrder.source_warehouse,
    target_warehouse: row.fg_warehouse || workOrder.fg_warehouse,
    wip_warehouse:
      workOrder.wip_warehouse || row.wip_warehouse
        ? workOrder.wip_warehouse || row.wip_warehouse
        : workOrder.source_warehouse || row.source_warehouse,
    skip_material_transfer: row.skip_material_transfer,
    backflush_from_wip_warehouse: row.backflush_from_wip_warehouse,
    finished_good: row.finished_good,
    semi_fg_bom: row.bom_no,
    is_subcontracted: row.is_subcontracted,
  };
}

/* ------------------------------------------------------------------ */
/*  getDefaultWarehouse                                                */
/* ------------------------------------------------------------------ */

export function getDefaultWarehouse(
  wip?: string,
  fg?: string,
  scrap?: string
): { wip_warehouse?: string; fg_warehouse?: string; scrap_warehouse?: string } {
  return {
    wip_warehouse: wip,
    fg_warehouse: fg,
    scrap_warehouse: scrap,
  };
}

/* ------------------------------------------------------------------ */
/*  setRequiredItems                                                   */
/* ------------------------------------------------------------------ */

export function setRequiredItems(
  doc: WorkOrderDoc,
  bomLookup?: BOMLookup,
  resetOnlyQty = false
): void {
  if (!resetOnlyQty) {
    doc.required_items = [];
  }

  let operation: string | undefined;
  if (doc.operations && doc.operations.length === 1) {
    operation = doc.operations[0].operation;
  }

  if (bomLookup && doc.qty && bomLookup.items) {
    const itemDict = getBOMItemsAsDict(bomLookup, flt(doc.qty), Boolean(cint(doc.use_multi_level_bom)));

    if (resetOnlyQty && doc.required_items) {
      for (const d of doc.required_items) {
        const matched = itemDict.get(d.item_code);
        if (matched) {
          d.required_qty = matched.qty;
        }
        if (!d.operation) {
          d.operation = operation;
        }
      }
    } else {
      const sortedItems = Array.from(itemDict.values()).sort((a, b) => (a.idx || Infinity) - (b.idx || Infinity));
      for (const item of sortedItems) {
        doc.required_items.push({
          rate: item.rate,
          amount: flt(item.rate || 0) * flt(item.qty),
          operation: item.operation || operation,
          item_code: item.item_code,
          item_name: item.item_name,
          stock_uom: item.stock_uom,
          description: item.description,
          allow_alternative_item: item.allow_alternative_item,
          required_qty: item.qty,
          source_warehouse: item.source_warehouse,
          include_item_in_manufacturing: item.include_item_in_manufacturing,
          operation_row_id: item.operation_row_id,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  getBOMItemsAsDict                                                  */
/* ------------------------------------------------------------------ */

export interface BOMItemDictEntry {
  idx?: number;
  item_code: string;
  item_name?: string;
  qty: number;
  stock_uom?: string;
  description?: string;
  rate?: number;
  amount?: number;
  operation?: string;
  source_warehouse?: string;
  include_item_in_manufacturing?: number;
  operation_row_id?: number;
  allow_alternative_item?: number;
  is_phantom_item?: number;
  bom_no?: string;
}

export function getBOMItemsAsDict(
  bomLookup: BOMLookup,
  qty: number,
  useMultiLevelBOM = false
): Map<string, BOMItemDictEntry> {
  const itemDict = new Map<string, BOMItemDictEntry>();

  const items = bomLookup.items || [];
  for (const item of items) {
    const key = item.operation_row_id ? `${item.item_code}-${item.operation_row_id}` : item.item_code;
    const itemQty = flt(item.stock_qty || item.qty || 0) / flt(bomLookup.quantity || 1) * qty;

    if (useMultiLevelBOM && item.bom_no) {
      // In pure logic, we don't recurse into child BOMs; caller should flatten externally
      // or pass flattened items. We just add the item itself.
    }

    if (itemDict.has(key)) {
      const existing = itemDict.get(key)!;
      existing.qty = flt(existing.qty) + itemQty;
    } else {
      itemDict.set(key, {
        idx: itemDict.size + 1,
        item_code: item.item_code,
        item_name: item.item_name,
        qty: itemQty,
        stock_uom: item.stock_uom,
        description: item.description,
        rate: item.rate,
        operation: item.operation,
        source_warehouse: item.source_warehouse,
        include_item_in_manufacturing: item.include_item_in_manufacturing,
        operation_row_id: item.operation_row_id,
        allow_alternative_item: item.allow_alternative_item,
        is_phantom_item: item.is_phantom_item,
        bom_no: item.bom_no,
      });
    }
  }

  return itemDict;
}

/* ------------------------------------------------------------------ */
/*  setWorkOrderOperations                                             */
/* ------------------------------------------------------------------ */

export function setWorkOrderOperations(doc: WorkOrderDoc, bomLookup?: BOMLookup): void {
  doc.operations = [];
  if (!bomLookup || !bomLookup.with_operations) return;

  const operations: WorkOrderOperation[] = [];

  if (doc.use_multi_level_bom && bomLookup.operations) {
    // In pure logic, caller should provide flattened operations
    for (const op of bomLookup.operations) {
      operations.push({ ...op, status: "Pending" });
    }
  }

  if (bomLookup.operations) {
    for (const op of bomLookup.operations) {
      const newOp: WorkOrderOperation = {
        ...op,
        status: "Pending",
        time_in_mins: op.fixed_time ? op.time_in_mins : flt(op.time_in_mins) / flt(bomLookup.quantity || 1),
      };
      if (doc.track_semi_finished_goods && !newOp.sequence_id) {
        newOp.sequence_id = newOp.idx;
      }
      operations.push(newOp);
    }
  }

  // Reindex
  for (let i = 0; i < operations.length; i++) {
    operations[i].idx = i + 1;
  }

  doc.operations = operations;
  calculateTime(doc);
}

/* ------------------------------------------------------------------ */
/*  calculateTime                                                      */
/* ------------------------------------------------------------------ */

export function calculateTime(doc: WorkOrderDoc): void {
  for (const d of doc.operations) {
    if (!d.fixed_time) {
      d.time_in_mins = flt(d.time_in_mins) * flt(doc.qty);
    }
  }
  calculateOperatingCost(doc);
}

/* ------------------------------------------------------------------ */
/*  updateConsumedQty                                                  */
/* ------------------------------------------------------------------ */

export function updateConsumedQty(
  doc: WorkOrderDoc,
  consumedQtyMap: Map<string, number>
): void {
  for (const item of doc.required_items) {
    const consumed = consumedQtyMap.get(item.item_code) || 0;
    item.consumed_qty = flt(consumed) + flt(item.returned_qty || 0);
  }
}

/* ------------------------------------------------------------------ */
/*  updateTransferredQty                                               */
/* ------------------------------------------------------------------ */

export function updateTransferredQty(
  doc: WorkOrderDoc,
  transferredQtyMap: Map<string, number>
): void {
  if (doc.skip_transfer) return;
  for (const row of doc.required_items) {
    row.transferred_qty = transferredQtyMap.get(row.item_code) || 0;
  }
}

/* ------------------------------------------------------------------ */
/*  validateDisassembledQty                                            */
/* ------------------------------------------------------------------ */

export function validateDisassembledQty(doc: WorkOrderDoc, qty: number, isCancel = false): string | undefined {
  if (isCancel) {
    const newQty = Math.max(0, flt(doc.disassembled_qty || 0) - qty);
    doc.disassembled_qty = newQty;
  } else {
    if (doc.docstatus === 1) {
      doc.disassembled_qty = flt(doc.disassembled_qty || 0) + qty;
    }
    if (flt(doc.disassembled_qty) > flt(doc.produced_qty || 0)) {
      return "Cannot disassemble more than produced quantity.";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  getReservedQtyForProduction                                        */
/* ------------------------------------------------------------------ */

export function getReservedQtyForProduction(
  requiredQty: number,
  transferredQty: number,
  consumedQty: number,
  skipTransfer: boolean
): number {
  if (!skipTransfer && transferredQty > requiredQty) {
    return 0;
  }
  if (!skipTransfer) {
    return flt(requiredQty - transferredQty);
  }
  return flt(requiredQty - consumedQty);
}
