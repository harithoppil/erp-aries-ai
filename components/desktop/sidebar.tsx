"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Store,
  Package,
  Factory,
  FolderKanban,
  Calculator,
  Building2,
  ShieldCheck,
  Users,
  Headphones,
  UserCog,
  Building,
  Settings,
  LogOut,
  User,
  // Selling icons
  Receipt,
  Tag,
  Gift,
  Percent,
  Layers,
  // Buying icons
  FileText,
  Truck,
  ClipboardList,
  Globe,
  // Stock icons
  Database,
  ArrowLeftRight,
  ScanBarcode,
  BarChart3,
  // Manufacturing icons
  Wrench,
  Cog,
  // Projects icons
  Flag,
  Timer,
  Calendar,
  Target,
  // Accounting icons
  CreditCard,
  Landmark,
  TrendingDown,
  TrendingUp,
  PieChart,
  BookOpen,
  // Asset icons
  Briefcase,
  Move,
  AlertTriangle,
  // Quality icons
  Search,
  CheckCircle,
  AlertOctagon,
  MessageSquare,
  // CRM icons
  Handshake,
  Mail,
  // HR icons
  GraduationCap,
  PlaneTakeoff,
  Clock,
  DollarSign,
  Wallet,
  BookOpenCheck,
  Star,
  UserPlus,
  CalendarClock,
  Car,
  // Organization icons
  Server,
  Printer,
  FileCheck,
  // Other
  Sparkles,
  Bot,
  GitBranch,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";
import { useSession } from "@/hooks/use-session";
import { signoutAction } from "@/app/auth/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  group?: string; // sub-group label for separator
  pattern?: "tabs" | "drill-down";
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Kebab Case Helper ──────────────────────────────────────────────────────────

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function erpHref(doctype: string): string {
  return `/dashboard/erp/${toKebabCase(doctype)}`;
}

// ── Navigation Config ─────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      // ── 1. Dashboard (singleton) ────────────────────────────────────────────
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

      // ── 2. Selling ─────────────────────────────────────────────────────────
      {
        label: "Selling",
        icon: ShoppingCart,
        children: [
          // Main Documents
          { label: "Customer", href: erpHref("Customer"), icon: Users, group: "Main Documents" },
          { label: "Customer Group", href: erpHref("CustomerGroup"), icon: Users, group: "Main Documents" },
          { label: "Quotation", href: erpHref("Quotation"), icon: Receipt, group: "Main Documents" },
          { label: "Quotation Item", href: erpHref("QuotationItem"), icon: FileText, group: "Main Documents" },
          { label: "Sales Order", href: erpHref("SalesOrder"), icon: ClipboardList, group: "Main Documents" },
          { label: "Sales Order Item", href: erpHref("SalesOrderItem"), icon: FileText, group: "Main Documents" },
          { label: "Sales Invoice", href: erpHref("SalesInvoice"), icon: Receipt, group: "Main Documents" },
          { label: "Sales Invoice Item", href: erpHref("SalesInvoiceItem"), icon: FileText, group: "Main Documents" },
          { label: "Blanket Order", href: erpHref("BlanketOrder"), icon: ClipboardList, group: "Main Documents" },
          { label: "Blanket Order Item", href: erpHref("BlanketOrderItem"), icon: FileText, group: "Main Documents" },
          // Pricing & Promotions
          { label: "Shipping Rule", href: erpHref("ShippingRule"), icon: Truck, group: "Pricing & Promotions" },
          { label: "Coupon Code", href: erpHref("CouponCode"), icon: Tag, group: "Pricing & Promotions" },
          { label: "Loyalty Program", href: erpHref("LoyaltyProgram"), icon: Gift, group: "Pricing & Promotions" },
          { label: "Campaign", href: erpHref("Campaign"), icon: Sparkles, group: "Pricing & Promotions" },
          { label: "Product Bundle", href: erpHref("ProductBundle"), icon: Layers, group: "Pricing & Promotions" },
          // POS
          { label: "POS Profile", href: erpHref("POSProfile"), icon: ShoppingCart, group: "POS" },
          { label: "POS Opening Entry", href: erpHref("POSOpeningEntry"), icon: Clock, group: "POS" },
          { label: "POS Closing Entry", href: erpHref("POSClosingEntry"), icon: CheckCircle, group: "POS" },
          { label: "POS Invoice", href: erpHref("POSInvoice"), icon: Receipt, group: "POS" },
          // Partners
          { label: "Sales Partner", href: erpHref("SalesPartner"), icon: Handshake, group: "Partners" },
          { label: "Territory", href: erpHref("Territory"), icon: Globe, group: "Partners" },
        ],
      },

      // ── 3. Buying ──────────────────────────────────────────────────────────
      {
        label: "Buying",
        icon: Store,
        children: [
          // Main Documents
          { label: "Supplier", href: erpHref("Supplier"), icon: Truck, group: "Main Documents" },
          { label: "Supplier Group", href: erpHref("SupplierGroup"), icon: Users, group: "Main Documents" },
          { label: "Request for Quotation", href: erpHref("RequestForQuotation"), icon: Receipt, group: "Main Documents" },
          { label: "Supplier Quotation", href: erpHref("SupplierQuotation"), icon: FileText, group: "Main Documents" },
          { label: "Purchase Order", href: erpHref("PurchaseOrder"), icon: ClipboardList, group: "Main Documents" },
          { label: "Purchase Order Item", href: erpHref("PurchaseOrderItem"), icon: FileText, group: "Main Documents" },
          { label: "Purchase Invoice", href: erpHref("PurchaseInvoice"), icon: Receipt, group: "Main Documents" },
          { label: "Purchase Invoice Item", href: erpHref("PurchaseInvoiceItem"), icon: FileText, group: "Main Documents" },
          { label: "Purchase Receipt", href: erpHref("PurchaseReceipt"), icon: Package, group: "Main Documents" },
          { label: "Material Request", href: erpHref("MaterialRequest"), icon: ClipboardList, group: "Main Documents" },
          { label: "Material Request Item", href: erpHref("MaterialRequestItem"), icon: FileText, group: "Main Documents" },
          // Tax
          { label: "Purchase Taxes and Charges Template", href: erpHref("PurchaseTaxesAndChargesTemplate"), icon: Percent, group: "Tax" },
          // Other
          { label: "Incoterm", href: erpHref("Incoterm"), icon: Globe, group: "Other" },
        ],
      },

      // ── 4. Stock ───────────────────────────────────────────────────────────
      {
        label: "Stock",
        icon: Package,
        children: [
          // Items
          { label: "Item", href: erpHref("Item"), icon: Package, group: "Items" },
          { label: "Item Group", href: erpHref("ItemGroup"), icon: Layers, group: "Items" },
          { label: "Item Attribute", href: erpHref("ItemAttribute"), icon: Tag, group: "Items" },
          { label: "Item Variant", href: erpHref("ItemVariant"), icon: Layers, group: "Items" },
          { label: "Item Price", href: erpHref("ItemPrice"), icon: DollarSign, group: "Items" },
          { label: "Item Barcode", href: erpHref("ItemBarcode"), icon: ScanBarcode, group: "Items" },
          { label: "Item Default", href: erpHref("ItemDefault"), icon: FileText, group: "Items" },
          { label: "Item Tax", href: erpHref("ItemTax"), icon: Percent, group: "Items" },
          { label: "Brand", href: erpHref("Brand"), icon: Tag, group: "Items" },
          { label: "UOM", href: erpHref("UOM"), icon: Database, group: "Items" },
          { label: "Uom Conversion Detail", href: erpHref("UomConversionDetail"), icon: ArrowLeftRight, group: "Items" },
          { label: "Item Manufacturer", href: erpHref("ItemManufacturer"), icon: Factory, group: "Items" },
          { label: "Item Lead Time", href: erpHref("ItemLeadTime"), icon: Clock, group: "Items" },
          // Warehousing
          { label: "Warehouse", href: erpHref("Warehouse"), icon: Building, group: "Warehousing" },
          { label: "Bin", href: erpHref("Bin"), icon: Database, group: "Warehousing" },
          // Transactions
          { label: "Stock Entry", href: erpHref("StockEntry"), icon: ArrowLeftRight, group: "Transactions" },
          { label: "Stock Entry Detail", href: erpHref("StockEntryDetail"), icon: FileText, group: "Transactions" },
          { label: "Delivery Note", href: erpHref("DeliveryNote"), icon: Truck, group: "Transactions" },
          { label: "Delivery Note Item", href: erpHref("DeliveryNoteItem"), icon: FileText, group: "Transactions" },
          { label: "Purchase Receipt Item", href: erpHref("PurchaseReceiptItem"), icon: FileText, group: "Transactions" },
          { label: "Pick List", href: erpHref("PickList"), icon: ClipboardList, group: "Transactions" },
          { label: "Pick List Item", href: erpHref("PickListItem"), icon: FileText, group: "Transactions" },
          // Serial / Batch
          { label: "Serial No", href: erpHref("SerialNo"), icon: ScanBarcode, group: "Serial / Batch" },
          { label: "Batch", href: erpHref("Batch"), icon: Package, group: "Serial / Batch" },
          { label: "Serial and Batch Bundle", href: erpHref("SerialAndBatchBundle"), icon: Layers, group: "Serial / Batch" },
          // Tools
          { label: "Stock Reconciliation", href: erpHref("StockReconciliation"), icon: CheckCircle, group: "Tools" },
          { label: "Landed Cost Voucher", href: erpHref("LandedCostVoucher"), icon: Receipt, group: "Tools" },
          { label: "Packing Slip", href: erpHref("PackingSlip"), icon: FileText, group: "Tools" },
          { label: "Delivery Trip", href: erpHref("DeliveryTrip"), icon: Truck, group: "Tools" },
          // Ledger
          { label: "Stock Ledger Entry", href: erpHref("StockLedgerEntry"), icon: BookOpen, group: "Ledger" },
        ],
      },

      // ── 5. Manufacturing ───────────────────────────────────────────────────
      {
        label: "Manufacturing",
        icon: Factory,
        children: [
          // Production
          { label: "BOM", href: erpHref("BOM"), icon: Layers, group: "Production" },
          { label: "BOM Item", href: erpHref("BOMItem"), icon: FileText, group: "Production" },
          { label: "BOM Operation", href: erpHref("BOMOperation"), icon: Cog, group: "Production" },
          { label: "Work Order", href: erpHref("WorkOrder"), icon: ClipboardList, group: "Production" },
          { label: "Work Order Item", href: erpHref("WorkOrderItem"), icon: FileText, group: "Production" },
          { label: "Work Order Operation", href: erpHref("WorkOrderOperation"), icon: Cog, group: "Production" },
          { label: "Job Card", href: erpHref("JobCard"), icon: CreditCard, group: "Production" },
          { label: "Job Card Operation", href: erpHref("JobCardOperation"), icon: Cog, group: "Production" },
          { label: "Job Card Time Log", href: erpHref("JobCardTimeLog"), icon: Clock, group: "Production" },
          { label: "Production Plan", href: erpHref("ProductionPlan"), icon: Calendar, group: "Production" },
          { label: "Production Plan Item", href: erpHref("ProductionPlanItem"), icon: FileText, group: "Production" },
          // Setup
          { label: "Workstation", href: erpHref("Workstation"), icon: Wrench, group: "Setup" },
          { label: "Workstation Type", href: erpHref("WorkstationType"), icon: Cog, group: "Setup" },
          { label: "Operation", href: erpHref("Operation"), icon: Cog, group: "Setup" },
          { label: "Routing", href: erpHref("Routing"), icon: ArrowLeftRight, group: "Setup" },
          { label: "Downtime Entry", href: erpHref("DowntimeEntry"), icon: AlertTriangle, group: "Setup" },
          { label: "Plant Floor", href: erpHref("PlantFloor"), icon: Building, group: "Setup" },
        ],
      },

      // ── 6. Projects ────────────────────────────────────────────────────────
      {
        label: "Projects",
        icon: FolderKanban,
        children: [
          { label: "Project", href: erpHref("Project"), icon: FolderKanban },
          { label: "Project Template", href: erpHref("ProjectTemplate"), icon: Layers },
          { label: "Project Template Task", href: erpHref("ProjectTemplateTask"), icon: FileText },
          { label: "Task", href: erpHref("Task"), icon: Flag },
          { label: "Dependent Task", href: erpHref("DependentTask"), icon: ArrowLeftRight },
          { label: "Timesheet", href: erpHref("Timesheet"), icon: Timer },
          { label: "Timesheet Detail", href: erpHref("TimesheetDetail"), icon: FileText },
          { label: "Activity Type", href: erpHref("ActivityType"), icon: Tag },
          { label: "Activity Cost", href: erpHref("ActivityCost"), icon: DollarSign },
          { label: "Project Type", href: erpHref("ProjectType"), icon: Tag },
          { label: "Project Update", href: erpHref("ProjectUpdate"), icon: BarChart3 },
        ],
      },

      // ── 7. Accounting ──────────────────────────────────────────────────────
      {
        label: "Accounting",
        icon: Calculator,
        children: [
          // Core
          { label: "Account", href: erpHref("Account"), icon: Landmark, group: "Core" },
          { label: "Account Category", href: erpHref("AccountCategory"), icon: Tag, group: "Core" },
          { label: "Journal Entry", href: erpHref("JournalEntry"), icon: BookOpen, group: "Core" },
          { label: "Journal Entry Account", href: erpHref("JournalEntryAccount"), icon: FileText, group: "Core" },
          { label: "Payment Entry", href: erpHref("PaymentEntry"), icon: CreditCard, group: "Core" },
          { label: "Payment Entry Reference", href: erpHref("PaymentEntryReference"), icon: FileText, group: "Core" },
          { label: "Payment Entry Deduction", href: erpHref("PaymentEntryDeduction"), icon: FileText, group: "Core" },
          { label: "Payment Order", href: erpHref("PaymentOrder"), icon: ClipboardList, group: "Core" },
          { label: "Payment Order Reference", href: erpHref("PaymentOrderReference"), icon: FileText, group: "Core" },
          // Reconciliation
          { label: "Payment Reconciliation", href: erpHref("PaymentReconciliation"), icon: ArrowLeftRight, group: "Reconciliation" },
          { label: "GL Entry", href: erpHref("GLEntry"), icon: BookOpen, group: "Reconciliation" },
          // Masters
          { label: "Company", href: erpHref("Company"), icon: Building, group: "Masters" },
          { label: "Cost Center", href: erpHref("CostCenter"), icon: Target, group: "Masters" },
          { label: "Accounting Dimension", href: erpHref("AccountingDimension"), icon: Layers, group: "Masters" },
          { label: "Finance Book", href: erpHref("FinanceBook"), icon: BookOpen, group: "Masters" },
          { label: "Fiscal Year", href: erpHref("FiscalYear"), icon: Calendar, group: "Masters" },
          { label: "Currency Exchange", href: erpHref("CurrencyExchange"), icon: ArrowLeftRight, group: "Masters" },
          // Budget
          { label: "Budget", href: erpHref("Budget"), icon: PieChart, group: "Budget" },
          { label: "Budget Account", href: erpHref("BudgetAccount"), icon: FileText, group: "Budget" },
          // Banking
          { label: "Bank", href: erpHref("Bank"), icon: Landmark, group: "Banking" },
          { label: "Bank Account", href: erpHref("BankAccount"), icon: CreditCard, group: "Banking" },
          { label: "Bank Transaction", href: erpHref("BankTransaction"), icon: ArrowLeftRight, group: "Banking" },
          // Tax
          { label: "Sales Taxes and Charges Template", href: erpHref("SalesTaxesAndChargesTemplate"), icon: Percent, group: "Tax" },
          { label: "Purchase Taxes and Charges Template", href: erpHref("PurchaseTaxesAndChargesTemplate"), icon: Percent, group: "Tax" },
          { label: "Item Tax Template", href: erpHref("ItemTaxTemplate"), icon: Percent, group: "Tax" },
          { label: "Tax Category", href: erpHref("TaxCategory"), icon: Tag, group: "Tax" },
          { label: "Tax Rule", href: erpHref("TaxRule"), icon: FileText, group: "Tax" },
          { label: "Tax Withholding Category", href: erpHref("TaxWithholdingCategory"), icon: Percent, group: "Tax" },
          // Period
          { label: "Period Closing Voucher", href: erpHref("PeriodClosingVoucher"), icon: CheckCircle, group: "Period" },
          { label: "Accounting Period", href: erpHref("AccountingPeriod"), icon: Calendar, group: "Period" },
          // Other
          { label: "Shareholder", href: erpHref("Shareholder"), icon: Users, group: "Other" },
          { label: "Share Transfer", href: erpHref("ShareTransfer"), icon: ArrowLeftRight, group: "Other" },
          { label: "Subscription", href: erpHref("Subscription"), icon: Calendar, group: "Other" },
          { label: "Subscription Plan", href: erpHref("SubscriptionPlan"), icon: FileText, group: "Other" },
        ],
      },

      // ── 8. Assets ──────────────────────────────────────────────────────────
      {
        label: "Assets",
        icon: Building2,
        children: [
          { label: "Asset", href: erpHref("Asset"), icon: Briefcase },
          { label: "Asset Category", href: erpHref("AssetCategory"), icon: Layers },
          { label: "Asset Finance Book", href: erpHref("AssetFinanceBook"), icon: BookOpen },
          { label: "Asset Depreciation Schedule", href: erpHref("AssetDepreciationSchedule"), icon: TrendingDown },
          { label: "Depreciation Schedule", href: erpHref("DepreciationSchedule"), icon: TrendingDown },
          { label: "Asset Capitalization", href: erpHref("AssetCapitalization"), icon: Landmark },
          { label: "Asset Capitalization Asset Item", href: erpHref("AssetCapitalizationAssetItem"), icon: FileText },
          { label: "Asset Capitalization Stock Item", href: erpHref("AssetCapitalizationStockItem"), icon: FileText },
          { label: "Asset Capitalization Service Item", href: erpHref("AssetCapitalizationServiceItem"), icon: FileText },
          { label: "Asset Movement", href: erpHref("AssetMovement"), icon: Move },
          { label: "Asset Movement Item", href: erpHref("AssetMovementItem"), icon: FileText },
          { label: "Asset Maintenance", href: erpHref("AssetMaintenance"), icon: Wrench },
          { label: "Asset Maintenance Log", href: erpHref("AssetMaintenanceLog"), icon: FileText },
          { label: "Asset Maintenance Task", href: erpHref("AssetMaintenanceTask"), icon: ClipboardList },
          { label: "Asset Repair", href: erpHref("AssetRepair"), icon: Wrench },
          { label: "Asset Value Adjustment", href: erpHref("AssetValueAdjustment"), icon: TrendingUp },
          { label: "Location", href: erpHref("Location"), icon: Globe },
        ],
      },

      // ── 9. Quality ─────────────────────────────────────────────────────────
      {
        label: "Quality",
        icon: ShieldCheck,
        children: [
          { label: "Quality Inspection", href: erpHref("QualityInspection"), icon: Search },
          { label: "Quality Inspection Parameter", href: erpHref("QualityInspectionParameter"), icon: Tag },
          { label: "Quality Inspection Reading", href: erpHref("QualityInspectionReading"), icon: FileText },
          { label: "Quality Inspection Template", href: erpHref("QualityInspectionTemplate"), icon: Layers },
          { label: "Quality Goal", href: erpHref("QualityGoal"), icon: Target },
          { label: "Quality Goal Objective", href: erpHref("QualityGoalObjective"), icon: Flag },
          { label: "Quality Procedure", href: erpHref("QualityProcedure"), icon: ClipboardList },
          { label: "Quality Procedure Process", href: erpHref("QualityProcedureProcess"), icon: Cog },
          { label: "Quality Review", href: erpHref("QualityReview"), icon: BarChart3 },
          { label: "Quality Review Objective", href: erpHref("QualityReviewObjective"), icon: Target },
          { label: "Quality Action", href: erpHref("QualityAction"), icon: AlertOctagon },
          { label: "Quality Action Resolution", href: erpHref("QualityActionResolution"), icon: CheckCircle },
          { label: "Non Conformance", href: erpHref("NonConformance"), icon: AlertTriangle },
          { label: "Quality Feedback", href: erpHref("QualityFeedback"), icon: MessageSquare },
          { label: "Quality Feedback Template", href: erpHref("QualityFeedbackTemplate"), icon: FileText },
          { label: "Quality Meeting", href: erpHref("QualityMeeting"), icon: Users },
          { label: "Quality Meeting Agenda", href: erpHref("QualityMeetingAgenda"), icon: ClipboardList },
          { label: "Quality Meeting Minutes", href: erpHref("QualityMeetingMinutes"), icon: FileText },
        ],
      },

      // ── 10. CRM ────────────────────────────────────────────────────────────
      {
        label: "CRM",
        icon: Users,
        children: [
          { label: "Lead", href: erpHref("Lead"), icon: UserPlus },
          { label: "Opportunity", href: erpHref("Opportunity"), icon: Target },
          { label: "Opportunity Item", href: erpHref("OpportunityItem"), icon: FileText },
          { label: "Opportunity Lost Reason", href: erpHref("OpportunityLostReason"), icon: AlertTriangle },
          { label: "Prospect", href: erpHref("Prospect"), icon: Users },
          { label: "Contract", href: erpHref("Contract"), icon: FileCheck },
          { label: "Contract Template", href: erpHref("ContractTemplate"), icon: FileText },
          { label: "Appointment", href: erpHref("Appointment"), icon: Calendar },
          { label: "Email Campaign", href: erpHref("EmailCampaign"), icon: Mail },
        ],
      },

      // ── 11. Support ────────────────────────────────────────────────────────
      {
        label: "Support",
        icon: Headphones,
        children: [
          { label: "Issue", href: erpHref("Issue"), icon: AlertOctagon },
          { label: "Issue Priority", href: erpHref("IssuePriority"), icon: Flag },
          { label: "Issue Type", href: erpHref("IssueType"), icon: Tag },
          { label: "Service Level Agreement", href: erpHref("ServiceLevelAgreement"), icon: FileCheck },
          { label: "Warranty Claim", href: erpHref("WarrantyClaim"), icon: ShieldCheck },
          { label: "Maintenance Schedule", href: erpHref("MaintenanceSchedule"), icon: Calendar },
          { label: "Maintenance Visit", href: erpHref("MaintenanceVisit"), icon: Truck },
        ],
      },

      // ── 12. HR ─────────────────────────────────────────────────────────────
      {
        label: "HR",
        icon: UserCog,
        children: [
          // Employee
          { label: "Employee", href: erpHref("Employee"), icon: Users, group: "Employee" },
          { label: "Employee Education", href: erpHref("EmployeeEducation"), icon: GraduationCap, group: "Employee" },
          { label: "Employee Group", href: erpHref("EmployeeGroup"), icon: Users, group: "Employee" },
          { label: "Designation", href: erpHref("Designation"), icon: Tag, group: "Employee" },
          // Leave
          { label: "Leave Type", href: erpHref("LeaveType"), icon: PlaneTakeoff, group: "Leave" },
          { label: "Leave Allocation", href: erpHref("LeaveAllocation"), icon: CalendarClock, group: "Leave" },
          { label: "Leave Application", href: erpHref("LeaveApplication"), icon: Calendar, group: "Leave" },
          { label: "Leave Policy", href: erpHref("LeavePolicy"), icon: FileText, group: "Leave" },
          { label: "Holiday List", href: erpHref("HolidayList"), icon: Calendar, group: "Leave" },
          // Payroll
          { label: "Salary Component", href: erpHref("SalaryComponent"), icon: DollarSign, group: "Payroll" },
          { label: "Salary Structure", href: erpHref("SalaryStructure"), icon: Wallet, group: "Payroll" },
          { label: "Salary Slip", href: erpHref("SalarySlip"), icon: Receipt, group: "Payroll" },
          { label: "Payroll Entry", href: erpHref("PayrollEntry"), icon: BookOpenCheck, group: "Payroll" },
          // Attendance
          { label: "Attendance", href: erpHref("Attendance"), icon: Clock, group: "Attendance" },
          { label: "Attendance Request", href: erpHref("AttendanceRequest"), icon: CalendarClock, group: "Attendance" },
          { label: "Shift Type", href: erpHref("ShiftType"), icon: Clock, group: "Attendance" },
          { label: "Shift Assignment", href: erpHref("ShiftAssignment"), icon: CalendarClock, group: "Attendance" },
          // Performance
          { label: "Appraisal", href: erpHref("Appraisal"), icon: Star, group: "Performance" },
          { label: "Appraisal Template", href: erpHref("AppraisalTemplate"), icon: Star, group: "Performance" },
          // Recruitment
          { label: "Job Opening", href: erpHref("JobOpening"), icon: UserPlus, group: "Recruitment" },
          // Fleet
          { label: "Vehicle", href: erpHref("Vehicle"), icon: Car, group: "Fleet" },
        ],
      },

      // ── 13. Organization ───────────────────────────────────────────────────
      {
        label: "Organization",
        icon: Building,
        children: [
          { label: "Company", href: erpHref("Company"), icon: Building },
          { label: "Department", href: erpHref("Department"), icon: Layers },
          { label: "Branch", href: erpHref("Branch"), icon: Globe },
          { label: "Terms and Conditions", href: erpHref("TermsAndConditions"), icon: FileCheck },
        ],
      },

      // ── 14. Settings ───────────────────────────────────────────────────────
      {
        label: "Settings",
        icon: Settings,
        children: [
          { label: "Accounts Settings", href: erpHref("AccountsSettings"), icon: Calculator },
          { label: "Selling Settings", href: erpHref("SellingSettings"), icon: ShoppingCart },
          { label: "Buying Settings", href: erpHref("BuyingSettings"), icon: Store },
          { label: "Stock Settings", href: erpHref("StockSettings"), icon: Package },
          { label: "Manufacturing Settings", href: erpHref("ManufacturingSettings"), icon: Factory },
          { label: "Projects Settings", href: erpHref("ProjectsSettings"), icon: FolderKanban },
          { label: "CRM Settings", href: erpHref("CRMSettings"), icon: Users },
          { label: "Support Settings", href: erpHref("SupportSettings"), icon: Headphones },
          { label: "Global Defaults", href: erpHref("GlobalDefaults"), icon: Settings },
        ],
      },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "AI Chat", href: "/dashboard/ai", icon: Bot },
      { label: "Workflows", href: "/dashboard/pipeline", icon: GitBranch },
      { label: "Channels", href: "/dashboard/channels", icon: MessageSquare },
      { label: "RAG Index", href: "/dashboard/settings/rag", icon: Database },
    ],
  },
];

// ── Sidebar Component ─────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mode: "desktop" | "tablet";
}

export function Sidebar({ collapsed, onToggle, mode }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user, loading: sessionLoading } = useSession();
  const isCollapsed = mode === "tablet" || collapsed;
  const showToggle = mode === "desktop";

  // Accordion state: only one L1 module expanded at a time
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  // Toggle L1 module (accordion)
  const toggleModule = useCallback(
    (label: string, hasChildren: boolean) => {
      if (!hasChildren) return;
      setExpandedModule((prev) => (prev === label ? null : label));
    },
    [],
  );

  // Check if an item or its children is active
  const isActive = useCallback(
    (item: NavItem): boolean => {
      if (item.href && pathname === item.href) return true;
      if (item.children) {
        return item.children.some(
          (child) =>
            (child.href && pathname === child.href) ||
            (child.children && child.children.some((gc) => gc.href === pathname)),
        );
      }
      return false;
    },
    [pathname],
  );

  async function handleSignout() {
    await signoutAction();
    router.push("/auth");
  }

  // ── Render Helpers ────────────────────────────────────────────────────────────

  // Render a nav item (L1 or L2)
  function renderNavItem(item: NavItem, depth: number = 0) {
    const Icon = item.icon;
    const hasChildren = (item.children?.length ?? 0) > 0;
    const active = isActive(item);
    const isExpanded = expandedModule === item.label;

    // Collapsed sidebar: icon + tooltip only
    if (isCollapsed) {
      const itemClass = `flex w-full items-center justify-center py-2.5 transition-colors relative
        ${
          active
            ? "bg-[#1e3a5f] text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`;

      return (
        <div key={item.label} className="w-full">
          <Tooltip>
            <TooltipTrigger className="w-full">
              {hasChildren ? (
                <button
                  onClick={() => toggleModule(item.label, hasChildren)}
                  className={itemClass}
                >
                  <Icon size={20} />
                </button>
              ) : (
                <Link href={item.href!} className={itemClass}>
                  <Icon size={20} />
                </Link>
              )}
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    // Expanded sidebar: full item
    return (
      <div key={item.label}>
        <div
          className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors cursor-pointer
            ${
              active
                ? "bg-[#1e3a5f] text-white border-l-4 border-[#0ea5e9]"
                : "text-slate-300 hover:bg-slate-800 hover:text-white border-l-4 border-transparent"
            }
            ${depth > 0 ? "pl-" + (12 + depth * 4) : ""}
          `}
          onClick={() => {
            if (hasChildren) {
              toggleModule(item.label, hasChildren);
            } else if (item.href) {
              router.push(item.href);
            }
          }}
        >
          <Icon size={depth === 0 ? 20 : 16} />
          <span className="flex-1 truncate">{item.label}</span>
          {hasChildren && depth === 0 && (
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>

        {/* Expanded children (accordion) */}
        <AnimatePresence initial={false}>
          {isExpanded && hasChildren && depth === 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {renderChildrenWithGroups(item.children!)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Render children with group separators
  function renderChildrenWithGroups(children: NavItem[]) {
    const elements: React.ReactNode[] = [];
    let lastGroup: string | null = null;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const currentGroup = child.group || null;

      // Insert group separator when group changes
      if (currentGroup && currentGroup !== lastGroup) {
        elements.push(
          <div
            key={`sep-${currentGroup}-${i}`}
            className="flex items-center gap-2 px-5 py-1.5 mt-1"
          >
            <div className="h-px flex-1 bg-slate-700/60" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
              {currentGroup}
            </span>
            <div className="h-px flex-1 bg-slate-700/60" />
          </div>
        );
        lastGroup = currentGroup;
      } else if (!currentGroup && lastGroup !== null) {
        // Reset when moving from grouped to ungrouped items
        lastGroup = null;
      }

      elements.push(renderNavItem(child, 1));
    }

    return elements;
  }

  // ── Main Render ───────────────────────────────────────────────────────────────

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#0f172a] text-[#cbd5e1] dark:bg-[#0f172a]"
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Logo — fixed top */}
      <div
        className={`flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-4 ${
          !isCollapsed ? "" : "justify-center"
        }`}
      >
        <img
          src="/aries-logo-transparent.png"
          alt="Aries"
          className="h-8 w-8 shrink-0"
        />
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">Aries</div>
            <div className="text-[10px] text-slate-400">Marine ERP</div>
          </div>
        )}
      </div>

      {/* Navigation — scrollable middle section */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin">
        <motion.div className="flex flex-col">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col">
              {!isCollapsed && (
                <div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => renderNavItem(item, 0))}
            </div>
          ))}
        </motion.div>
      </nav>

      {/* User Card — fixed bottom */}
      <div className="shrink-0 border-t border-slate-800 bg-[#0f172a]">
        {sessionLoading ? (
          !isCollapsed && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-slate-700" />
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-700" />
                </div>
              </div>
            </div>
          )
        ) : user ? (
          <div
            className={`px-4 py-3 ${isCollapsed ? "flex flex-col items-center" : ""}`}
          >
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-700"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white ring-2 ring-slate-700">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {user.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}{" "}
                    &middot; {user.company}
                  </div>
                </div>
                <button
                  onClick={handleSignout}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-700"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white ring-2 ring-slate-700">
                      {initials}
                    </div>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {user.name} — Sign Out
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          !isCollapsed && (
            <div className="px-4 py-3">
              <Link
                href="/auth"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
              >
                <User size={16} />
                Sign In
              </Link>
            </div>
          )
        )}

        {/* Toggle button */}
        {showToggle && (
          <div
            className={`border-t border-slate-800/50 px-4 py-2 ${
              isCollapsed ? "flex justify-center" : "flex justify-end"
            }`}
          >
            <button
              onClick={onToggle}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
