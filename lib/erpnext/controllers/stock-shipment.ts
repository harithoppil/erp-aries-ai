// =============================================================================
// stock-shipment.ts
// Ported from ERPNext: stock/doctype/shipment/shipment.py
// Pure business logic — NO database / Prisma / Frappe calls.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShipmentStatus = "Draft" | "Submitted" | "Booked" | "Cancelled" | "Completed";
export type ShipmentType = "Goods" | "Documents";
export type PickupType = "Pickup" | "Self delivery";
export type PickupFromType = "Company" | "Customer" | "Supplier";
export type DeliveryToType = "Company" | "Customer" | "Supplier";
export type Pallets = "No" | "Yes";
export type TrackingStatus = "" | "In Progress" | "Delivered" | "Returned" | "Lost";

export interface ShipmentParcel {
  id?: string;
  idx: number;
  parcel_template?: string;
  length?: number;
  width?: number;
  height?: number;
  weight: number;
  count: number;
  description?: string;
}

export interface ShipmentDeliveryNote {
  id?: string;
  idx: number;
  prevdoc_docname: string;
  prevdoc_doctype: string;
  prevdoc_detail_docname: string;
  grand_total: number;
}

export interface Shipment {
  id?: string;
  name: string;
  docstatus: number;
  status: ShipmentStatus;
  shipment_type: ShipmentType;
  pickup_type: PickupType;
  pickup_from_type: PickupFromType;
  pickup_company?: string;
  pickup_customer?: string;
  pickup_supplier?: string;
  pickup_address_name: string;
  pickup_address?: string;
  pickup_contact_name?: string;
  pickup_contact?: string;
  pickup_contact_email?: string;
  pickup_contact_person?: string;
  pickup_date: string; // ISO date
  pickup_from?: string; // HH:MM:SS
  pickup_to?: string; // HH:MM:SS
  pickup?: string;
  delivery_to_type: DeliveryToType;
  delivery_company?: string;
  delivery_customer?: string;
  delivery_supplier?: string;
  delivery_address_name: string;
  delivery_address?: string;
  delivery_contact_name?: string;
  delivery_contact?: string;
  delivery_contact_email?: string;
  delivery_to?: string;
  description_of_content: string;
  value_of_goods: number;
  shipment_amount: number;
  total_weight: number;
  pallets: Pallets;
  carrier?: string;
  carrier_service?: string;
  service_provider?: string;
  awb_number?: string;
  shipment_id?: string;
  incoterm?: string;
  tracking_status: TrackingStatus;
  tracking_status_info?: string;
  tracking_url?: string;
  parcel_template?: string;
  // child tables
  shipment_parcel: ShipmentParcel[];
  shipment_delivery_note: ShipmentDeliveryNote[];
}

export interface ValidationError {
  field?: string;
  message: string;
  title?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ShipmentContactInfo {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile_no?: string;
  gender?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flt(value: unknown): number {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function parseTime(timeStr: string): Date {
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  const date = new Date(0);
  date.setHours(hours || 0, minutes || 0, seconds || 0, 0);
  return date;
}

// ---------------------------------------------------------------------------
// Validations
// ---------------------------------------------------------------------------

export function validateWeight(shipment: Shipment): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const parcel of shipment.shipment_parcel) {
    if (flt(parcel.weight) <= 0) {
      errors.push({
        field: "weight",
        message: `Parcel weight cannot be 0 (row ${parcel.idx})`,
      });
    }
  }
  return errors;
}

export function validatePickupTime(shipment: Shipment): ValidationError[] {
  const errors: ValidationError[] = [];
  if (shipment.pickup_from && shipment.pickup_to) {
    const fromTime = parseTime(shipment.pickup_from);
    const toTime = parseTime(shipment.pickup_to);
    if (toTime < fromTime) {
      errors.push({
        field: "pickup_to",
        message: "Pickup To time should be greater than Pickup From time",
      });
    }
  }
  return errors;
}

export function setValueOfGoods(shipment: Shipment): number {
  let valueOfGoods = 0;
  for (const entry of shipment.shipment_delivery_note) {
    valueOfGoods += flt(entry.grand_total);
  }
  return valueOfGoods || shipment.value_of_goods || 0;
}

export function getTotalWeight(shipment: Shipment): number {
  return shipment.shipment_parcel.reduce((sum, parcel) => {
    if (parcel.count > 0) {
      return sum + flt(parcel.weight) * parcel.count;
    }
    return sum;
  }, 0);
}

export function setTotalWeight(shipment: Shipment): number {
  return getTotalWeight(shipment);
}

export function validateShipmentOnSubmit(shipment: Shipment): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!shipment.shipment_parcel || shipment.shipment_parcel.length === 0) {
    errors.push({
      field: "shipment_parcel",
      message: "Please enter Shipment Parcel information",
    });
  }
  if (flt(shipment.value_of_goods) === 0) {
    errors.push({
      field: "value_of_goods",
      message: "Value of goods cannot be 0",
    });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Contact / Address helpers
// ---------------------------------------------------------------------------

export function buildCompanyContactDisplay(contact: ShipmentContactInfo): string {
  let display = contact.first_name || "";
  if (contact.last_name) {
    display += ` ${contact.last_name}`;
  }
  if (contact.email) {
    display += (display ? "<br>" : "") + contact.email;
  }
  if (contact.phone) {
    display += (display ? "<br>" : "") + contact.phone;
  }
  return display;
}

export function normalizeCompanyContact(contact: ShipmentContactInfo): ShipmentContactInfo {
  return {
    ...contact,
    phone: contact.phone || contact.mobile_no,
  };
}

export function getContactNameForParty(
  refDoctype: string,
  docname: string,
  defaultContactFetcher: (doctype: string, name: string) => string | undefined
): string | undefined {
  return defaultContactFetcher(refDoctype, docname);
}

export function getAddressNameForParty(
  refDoctype: string,
  docname: string,
  shippingAddressFetcher: (doctype: string, name: string) => string | undefined
): string | undefined {
  return shippingAddressFetcher(refDoctype, docname);
}

// ---------------------------------------------------------------------------
// Orchestration: run all validations
// ---------------------------------------------------------------------------

export interface ShipmentValidationInput {
  shipment: Shipment;
}

export function validateShipment(input: ShipmentValidationInput): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const { shipment } = input;

  result.errors.push(...validateWeight(shipment));
  result.errors.push(...validatePickupTime(shipment));

  // Auto-set computed fields (caller should apply these)
  const computedValueOfGoods = setValueOfGoods(shipment);
  const computedTotalWeight = setTotalWeight(shipment);

  if (shipment.docstatus === 0) {
    result.warnings.push({
      field: "status",
      message: `Status defaulted to Draft (computed value_of_goods=${computedValueOfGoods}, total_weight=${computedTotalWeight})`,
    });
  }

  if (shipment.docstatus === 1) {
    result.errors.push(...validateShipmentOnSubmit(shipment));
  }

  result.valid = result.errors.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export function determineShipmentStatus(shipment: Shipment): ShipmentStatus {
  if (shipment.docstatus === 0) return "Draft";
  if (shipment.docstatus === 2) return "Cancelled";
  if (shipment.docstatus === 1) return "Submitted";
  return shipment.status;
}

export function updateShipmentStatus(
  shipment: Shipment,
  newStatus: ShipmentStatus
): ShipmentStatus {
  if (newStatus === "Cancelled" && shipment.docstatus !== 2) {
    // Cannot cancel without docstatus 2 in pure logic
    return shipment.status;
  }
  return newStatus;
}
