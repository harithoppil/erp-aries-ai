import { z } from 'zod';

export const createCustomerSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_code: z.string().min(1, 'Customer code is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
  tax_id: z.string().optional(),
  credit_limit: z.number().positive('Credit limit must be positive').optional(),
});

export const createAssetSchema = z.object({
  asset_name: z.string().min(1, 'Asset name is required'),
  asset_code: z.string().min(1, 'Asset code is required'),
  asset_category: z.string().min(1, 'Category is required'),
  location: z.string().optional(),
  purchase_cost: z.number().nonnegative('Cost cannot be negative').optional(),
  calibration_date: z.date().optional(),
  next_calibration_date: z.date().optional(),
});

export const createInvoiceSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  tax_rate: z.number().min(0).max(100).default(5),
  due_date_days: z.number().int().positive().default(30),
  items: z.array(z.object({
    description: z.string().min(1, 'Item description required'),
    quantity: z.number().positive('Quantity must be > 0'),
    rate: z.number().nonnegative('Rate must be >= 0'),
    item_code: z.string().optional(),
  })).min(1, 'At least one item required'),
});

export const createQuotationSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  valid_until: z.string().min(1, 'Validity date required'),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    rate: z.number().nonnegative(),
    item_code: z.string().optional(),
  })).min(1, 'At least one item required'),
});

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),
  project_id: z.string().uuid().optional(),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    rate: z.number().nonnegative(),
    item_code: z.string().optional(),
  })).min(1, 'At least one item required'),
});

export const createProjectSchema = z.object({
  project_name: z.string().min(1, 'Project name required'),
  project_type: z.string().min(1, 'Project type required'),
  customer_name: z.string().min(1, 'Customer name required'),
  project_location: z.string().optional(),
  vessel_name: z.string().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  day_rate: z.number().nonnegative().optional(),
  expected_start: z.date().optional(),
  expected_end: z.date().optional(),
  notes: z.string().optional(),
});

export const createPersonnelSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID required'),
  name: z.string().min(1, 'Name required'),
  designation: z.string().min(1, 'Designation required'),
  department: z.string().min(1, 'Department required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  day_rate: z.number().nonnegative().optional(),
});

export const createPaymentSchema = z.object({
  party_name: z.string().min(1, 'Party name required'),
  amount: z.number().positive('Amount must be > 0'),
  payment_type: z.enum(['Received', 'Paid', 'Internal']),
  mode_of_payment: z.string().min(1, 'Payment mode required'),
  reference_no: z.string().optional(),
  reference_date: z.string().optional(),
  invoice_id: z.string().uuid().optional(),
});

export const createTimesheetSchema = z.object({
  project_id: z.string().uuid('Invalid project'),
  personnel_id: z.string().uuid('Invalid personnel'),
  date: z.string().min(1, 'Date required'),
  hours: z.number().positive('Hours must be > 0'),
  activity_type: z.string().min(1, 'Activity type required'),
  billable: z.boolean().default(true),
});

export const createJournalEntrySchema = z.object({
  entry_type: z.string().min(1, 'Entry type required'),
  posting_date: z.string().min(1, 'Posting date required'),
  lines: z.array(z.object({
    account: z.string().min(1, 'Account required'),
    debit: z.number().nonnegative(),
    credit: z.number().nonnegative(),
  })).min(2, 'At least 2 lines required'),
});
