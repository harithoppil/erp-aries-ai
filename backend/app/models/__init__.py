from backend.app.models.enquiry import AuditLog, Document, Enquiry, EnquiryStatus
from backend.app.models.ai import (
    AIConversation,
    AIMessage,
    ChannelConnector,
    Persona,
    PersonaCategory,
    UIDashboard,
)
from backend.app.models.workflow import (
    ExecutionStatus,
    NodeExecution,
    NodeType,
    Workflow,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowNode,
    WorkflowStatus,
)
from backend.app.models.accounting import (
    Account,
    FiscalYear,
    GeneralLedgerEntry,
    JournalEntry,
    JournalEntryLine,
)
from backend.app.models.sales import (
    Customer,
    DeliveryNote,
    DeliveryNoteItem,
    Payment,
    Quotation,
    QuotationItem,
    SalesInvoice,
    SalesInvoiceItem,
    SalesOrder,
    SalesOrderItem,
)
from backend.app.models.purchasing import (
    PurchaseInvoice,
    PurchaseInvoiceItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    Supplier,
)
from backend.app.models.inventory import (
    Item,
    ItemGroup,
    StockLedgerEntry,
    StockReconciliation,
    StockTransfer,
)
from backend.app.models.crm import Communication, Lead, Opportunity
from backend.app.models.projects import Project, ProjectTask, Timesheet
from backend.app.models.hr import (
    Attendance,
    Department,
    Designation,
    Employee,
    ExpenseClaim,
    LeaveApplication,
    LeaveType,
    SalarySlip,
)
from backend.app.models.marine import (
    CharterContract,
    CrewAssignment,
    DiveOperation,
    FuelLog,
    MaintenanceSchedule,
    SafetyEquipment,
    Vessel,
    VesselCertification,
)
from backend.app.models.assets import (
    AssetCategory,
    AssetDepreciationSchedule,
    AssetMaintenanceLog,
    FixedAsset,
)
from backend.app.models.settings import (
    ActivityLog,
    Currency,
    ExchangeRate,
    TaxTemplate,
    WorkflowRule,
)
from backend.app.models.auth import Company, Role, User, UserRole, Warehouse

__all__ = [
    # enquiry
    "AuditLog",
    "Document",
    "Enquiry",
    "EnquiryStatus",
    # ai
    "AIConversation",
    "AIMessage",
    "ChannelConnector",
    "Persona",
    "PersonaCategory",
    "UIDashboard",
    # workflow
    "ExecutionStatus",
    "NodeExecution",
    "NodeType",
    "Workflow",
    "WorkflowEdge",
    "WorkflowExecution",
    "WorkflowNode",
    "WorkflowStatus",
    # accounting
    "Account",
    "FiscalYear",
    "GeneralLedgerEntry",
    "JournalEntry",
    "JournalEntryLine",
    # sales
    "Customer",
    "DeliveryNote",
    "DeliveryNoteItem",
    "Payment",
    "Quotation",
    "QuotationItem",
    "SalesInvoice",
    "SalesInvoiceItem",
    "SalesOrder",
    "SalesOrderItem",
    # purchasing
    "PurchaseInvoice",
    "PurchaseInvoiceItem",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "PurchaseReceipt",
    "PurchaseReceiptItem",
    "Supplier",
    # inventory
    "Item",
    "ItemGroup",
    "StockLedgerEntry",
    "StockReconciliation",
    "StockTransfer",
    # crm
    "Communication",
    "Lead",
    "Opportunity",
    # projects
    "Project",
    "ProjectTask",
    "Timesheet",
    # hr
    "Attendance",
    "Department",
    "Designation",
    "Employee",
    "ExpenseClaim",
    "LeaveApplication",
    "LeaveType",
    "SalarySlip",
    # marine
    "CharterContract",
    "CrewAssignment",
    "DiveOperation",
    "FuelLog",
    "MaintenanceSchedule",
    "SafetyEquipment",
    "Vessel",
    "VesselCertification",
    # assets
    "AssetCategory",
    "AssetDepreciationSchedule",
    "AssetMaintenanceLog",
    "FixedAsset",
    # settings
    "ActivityLog",
    "Currency",
    "ExchangeRate",
    "TaxTemplate",
    "WorkflowRule",
    # auth
    "Company",
    "Role",
    "User",
    "UserRole",
    "Warehouse",
]
