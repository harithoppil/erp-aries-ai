/**
 * Ported from erpnext/stock/doctype/warehouse/warehouse.py
 * Pure business logic for Warehouse validations, naming, and tree structure.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WarehouseDoc {
  name?: string;
  warehouse_name: string;
  company?: string;
  company_abbr?: string;
  account?: string;
  is_group?: boolean;
  disabled?: boolean;
  parent_warehouse?: string;
  old_parent?: string;
  lft?: number;
  rgt?: number;
  warehouse_type?: string;
  default_in_transit_warehouse?: string;
  is_rejected_warehouse?: boolean;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pin?: string;
  email_id?: string;
  phone_no?: string;
  mobile_no?: string;
  customer?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface WarehouseChildCheck {
  hasSle: boolean;
  hasChildWarehouses: boolean;
  bins: Array<{
    actual_qty: number;
    reserved_qty: number;
    ordered_qty: number;
    indented_qty: number;
    projected_qty: number;
    planned_qty: number;
    item_code?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

/* ------------------------------------------------------------------ */
/*  Naming                                                             */
/* ------------------------------------------------------------------ */

export function generateWarehouseName(
  warehouseName: string,
  companyAbbr?: string
): string {
  if (companyAbbr) {
    const suffix = ` - ${companyAbbr}`;
    if (!warehouseName.endsWith(suffix)) {
      return warehouseName + suffix;
    }
  }
  return warehouseName;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export function canDeleteWarehouse(
  warehouse: WarehouseDoc,
  checks: WarehouseChildCheck
): ValidationResult {
  for (const bin of checks.bins) {
    if (
      flt(bin.actual_qty) !== 0 ||
      flt(bin.reserved_qty) !== 0 ||
      flt(bin.ordered_qty) !== 0 ||
      flt(bin.indented_qty) !== 0 ||
      flt(bin.projected_qty) !== 0 ||
      flt(bin.planned_qty) !== 0
    ) {
      return {
        success: false,
        error: `Warehouse ${warehouse.name} can not be deleted as quantity exists for Item ${bin.item_code}`,
      };
    }
  }

  if (checks.hasSle) {
    return {
      success: false,
      error: "Warehouse can not be deleted as stock ledger entry exists for this warehouse.",
    };
  }

  if (checks.hasChildWarehouses) {
    return {
      success: false,
      error: "Child warehouse exists for this warehouse. You can not delete this warehouse.",
    };
  }

  return { success: true };
}

export function validateWarehouseAccountChange(
  oldAccount: string | undefined,
  newAccount: string | undefined,
  hasSle: boolean
): ValidationResult {
  if (!hasSle) {
    return { success: true };
  }

  if (!oldAccount && !newAccount) {
    return { success: true };
  }

  if (oldAccount === newAccount) {
    return { success: true };
  }

  return {
    success: true,
    warnings: [
      "Stock entries exist with the old account. Changing the account may lead to a mismatch between the warehouse closing balance and the account closing balance. The overall closing balance will still match, but not for the specific account.",
    ],
  };
}

export function canConvertToLedger(
  hasChildWarehouses: boolean,
  hasSle: boolean
): ValidationResult {
  if (hasChildWarehouses) {
    return {
      success: false,
      error: "Warehouses with child nodes cannot be converted to ledger",
    };
  }
  if (hasSle) {
    return {
      success: false,
      error: "Warehouses with existing transaction can not be converted to ledger.",
    };
  }
  return { success: true };
}

export function canConvertToGroup(hasSle: boolean): ValidationResult {
  if (hasSle) {
    return {
      success: false,
      error: "Warehouses with existing transaction can not be converted to group.",
    };
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Tree Helpers                                                       */
/* ------------------------------------------------------------------ */

export function getChildWarehouses(
  warehouseName: string,
  allWarehouses: Array<{ name: string; parent_warehouse?: string }>
): string[] {
  const children: string[] = [];
  const queue = [warehouseName];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const wh of allWarehouses) {
      if (wh.parent_warehouse === current && !children.includes(wh.name)) {
        children.push(wh.name);
        queue.push(wh.name);
      }
    }
  }

  return [...children, warehouseName];
}

export function getDescendants(
  warehouseName: string,
  allWarehouses: Array<{ name: string; parent_warehouse?: string }>
): string[] {
  const children: string[] = [];
  const queue = [warehouseName];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const wh of allWarehouses) {
      if (wh.parent_warehouse === current && !children.includes(wh.name)) {
        children.push(wh.name);
        queue.push(wh.name);
      }
    }
  }

  return children;
}

export function isDescendant(
  child: string,
  parent: string,
  allWarehouses: Array<{ name: string; parent_warehouse?: string }>
): boolean {
  const descendants = getDescendants(parent, allWarehouses);
  return descendants.includes(child);
}

export function getWarehousesBasedOnAccount(
  account: string,
  allWarehouses: Array<{ name: string; account?: string; is_group?: boolean }>,
  defaultInventoryAccount?: string
): string[] {
  const warehouses: string[] = [];

  for (const d of allWarehouses) {
    if (d.account === account) {
      if (d.is_group) {
        const descendants = getDescendants(d.name, allWarehouses);
        warehouses.push(...descendants);
      } else {
        warehouses.push(d.name);
      }
    }
  }

  if (warehouses.length === 0 && defaultInventoryAccount === account) {
    const leafWarehouses = allWarehouses
      .filter((w) => !w.is_group)
      .map((w) => w.name);
    warehouses.push(...leafWarehouses);
  }

  return warehouses;
}

/* ------------------------------------------------------------------ */
/*  Filter / Query Helpers                                             */
/* ------------------------------------------------------------------ */

export function filterWarehousesByCompany(
  warehouses: WarehouseDoc[],
  company?: string
): WarehouseDoc[] {
  if (!company) return warehouses;
  return warehouses.filter(
    (w) => w.company === company || !w.company
  );
}

export function filterActiveWarehouses(
  warehouses: WarehouseDoc[]
): WarehouseDoc[] {
  return warehouses.filter((w) => !w.disabled);
}

export function getRootWarehouses(
  warehouses: Array<{ name: string; parent_warehouse?: string }>
): string[] {
  return warehouses
    .filter((w) => !w.parent_warehouse)
    .map((w) => w.name);
}

/* ------------------------------------------------------------------ */
/*  Reorder Warehouse Validation                                       */
/* ------------------------------------------------------------------ */

export function validateReorderWarehouse(
  warehouse: string,
  warehouseGroup: string,
  allWarehouses: Array<{ name: string; parent_warehouse?: string }>
): ValidationResult {
  const childWarehouses = getChildWarehouses(warehouseGroup, allWarehouses);
  if (!childWarehouses.includes(warehouse)) {
    return {
      success: false,
      error: `The warehouse ${warehouse} is not a child warehouse of a group warehouse ${warehouseGroup}`,
    };
  }
  return { success: true };
}
