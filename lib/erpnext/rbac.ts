/**
 * Role-Based Access Control (RBAC) for ERPNext document operations.
 *
 * Provides permission checking for document actions (create, read, update, delete,
 * submit, cancel, amend, print, email) across core DocTypes based on user roles.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - Use the shared `prisma` singleton for user/session lookups.
 */

import { prisma } from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "submit"
  | "cancel"
  | "amend"
  | "print"
  | "email";

export interface PermissionRule {
  doctype: string;
  action: DocAction;
  allowedRoles: string[];
}

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  subsidiary: string | null;
  company: string | null;
}

// ── DocType Categories ────────────────────────────────────────────────────────

/** Accounts-related DocTypes */
const ACCOUNTS_DOCTYPES = [
  "Sales Invoice",
  "Purchase Invoice",
  "Journal Entry",
  "Payment Entry",
  "Account",
] as const;

/** Selling + CRM DocTypes */
const SELLING_DOCTYPES = [
  "Sales Invoice",
  "Sales Order",
  "Quotation",
  "Delivery Note",
  "Customer",
] as const;

/** Buying DocTypes */
const BUYING_DOCTYPES = [
  "Purchase Invoice",
  "Purchase Order",
  "Purchase Receipt",
  "Material Request",
  "Supplier",
] as const;

/** Stock DocTypes */
const STOCK_DOCTYPES = [
  "Stock Entry",
  "Delivery Note",
  "Purchase Receipt",
  "Item",
] as const;

/** Manufacturing DocTypes */
const MANUFACTURING_DOCTYPES = [
  "Work Order",
  "BOM",
] as const;

/** All submittable DocTypes (12 core) */
const SUBMITTABLE_DOCTYPES = [
  "Sales Invoice",
  "Purchase Invoice",
  "Sales Order",
  "Purchase Order",
  "Journal Entry",
  "Payment Entry",
  "Stock Entry",
  "Delivery Note",
  "Purchase Receipt",
  "Quotation",
  "Material Request",
  "Work Order",
] as const;

/** Common non-submittable DocTypes */
const COMMON_DOCTYPES = [
  "Customer",
  "Supplier",
  "Item",
  "Account",
  "Company",
  "BOM",
] as const;

/** All covered DocTypes */
const ALL_DOCTYPES = Array.from(
  new Set([
    ...SUBMITTABLE_DOCTYPES,
    ...COMMON_DOCTYPES,
  ]),
);

/** All DocAction values */
const ALL_ACTIONS: DocAction[] = [
  "create",
  "read",
  "update",
  "delete",
  "submit",
  "cancel",
  "amend",
  "print",
  "email",
];

/** Actions that only apply to submittable DocTypes */
const SUBMIT_ACTIONS: DocAction[] = ["submit", "cancel", "amend"];

/** Read-only actions */
const READ_ONLY_ACTIONS: DocAction[] = ["read", "print", "email"];

// ── Role definitions ──────────────────────────────────────────────────────────

const ROLE_ADMIN = "admin";
const ROLE_MANAGER = "manager";
const ROLE_ACCOUNTS_MANAGER = "accounts_manager";
const ROLE_SALES_MANAGER = "sales_manager";
const ROLE_PURCHASE_MANAGER = "purchase_manager";
const ROLE_STOCK_MANAGER = "stock_manager";
const ROLE_USER = "user";
const ROLE_VIEWER = "viewer";

const ALL_ROLES = [
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_ACCOUNTS_MANAGER,
  ROLE_SALES_MANAGER,
  ROLE_PURCHASE_MANAGER,
  ROLE_STOCK_MANAGER,
  ROLE_USER,
  ROLE_VIEWER,
] as const;

// ── Helper: DocType category membership ───────────────────────────────────────

function isAccountsDocType(doctype: string): boolean {
  return (ACCOUNTS_DOCTYPES as readonly string[]).includes(doctype);
}

function isSellingDocType(doctype: string): boolean {
  return (SELLING_DOCTYPES as readonly string[]).includes(doctype);
}

function isBuyingDocType(doctype: string): boolean {
  return (BUYING_DOCTYPES as readonly string[]).includes(doctype);
}

function isStockDocType(doctype: string): boolean {
  return (STOCK_DOCTYPES as readonly string[]).includes(doctype);
}

function isManufacturingDocType(doctype: string): boolean {
  return (MANUFACTURING_DOCTYPES as readonly string[]).includes(doctype);
}

function isSubmittableDocType(doctype: string): boolean {
  return (SUBMITTABLE_DOCTYPES as readonly string[]).includes(doctype);
}

// ── Permission logic per role ─────────────────────────────────────────────────

/**
 * Determine if a specific role has permission for a DocType + action.
 *
 * Permission rules:
 * - **admin**: Can do everything on every DocType
 * - **manager**: Can create, read, update, submit, cancel, amend, print, email
 *   on most DocTypes; cannot delete submitted docs
 * - **accounts_manager**: Full access to Accounts DocTypes; read-only on others
 * - **sales_manager**: Full access to Selling + CRM DocTypes; read-only on others
 * - **purchase_manager**: Full access to Buying DocTypes; read-only on others
 * - **stock_manager**: Full access to Stock DocTypes; read-only on others
 * - **user**: Can create, read, update, print, email; cannot submit, cancel, or delete
 * - **viewer**: Read-only on everything (read, print, email)
 */
export function hasPermission(role: string, doctype: string, action: DocAction): boolean {
  // Admin: full access
  if (role === ROLE_ADMIN) return true;

  // Viewer: read-only
  if (role === ROLE_VIEWER) {
    return READ_ONLY_ACTIONS.includes(action);
  }

  // User: create, read, update, print, email — no submit/cancel/delete/amend
  if (role === ROLE_USER) {
    if (["delete", "submit", "cancel", "amend"].includes(action)) return false;
    return true;
  }

  // Manager: nearly full access, but cannot delete submittable docs
  if (role === ROLE_MANAGER) {
    if (action === "delete" && isSubmittableDocType(doctype)) return false;
    // For non-submittable docTypes, delete is allowed (master records)
    return true;
  }

  // Domain managers: full access in their domain, read-only elsewhere
  const domainFullAccess = (
    isDomainDocType: (dt: string) => boolean,
  ): boolean => {
    if (isDomainDocType(doctype)) {
      // Full domain access — but still no delete on submittable docs
      if (action === "delete" && isSubmittableDocType(doctype)) return false;
      return true;
    }
    // Outside domain: read-only
    return READ_ONLY_ACTIONS.includes(action);
  };

  if (role === ROLE_ACCOUNTS_MANAGER) {
    // Accounts manager has full access to accounts doctypes
    // and also manufacturing (BOM, Work Order affect cost accounting)
    if (isAccountsDocType(doctype) || isManufacturingDocType(doctype)) {
      if (action === "delete" && isSubmittableDocType(doctype)) return false;
      return true;
    }
    // Also has read/write on Company (financial setup)
    if (doctype === "Company") {
      if (action === "delete") return false;
      return true;
    }
    return READ_ONLY_ACTIONS.includes(action);
  }

  if (role === ROLE_SALES_MANAGER) {
    return domainFullAccess(isSellingDocType);
  }

  if (role === ROLE_PURCHASE_MANAGER) {
    return domainFullAccess(isBuyingDocType);
  }

  if (role === ROLE_STOCK_MANAGER) {
    return domainFullAccess(isStockDocType);
  }

  // Unknown role: read-only
  return READ_ONLY_ACTIONS.includes(action);
}

// ── Build permission table ────────────────────────────────────────────────────

/** Cached permission table built lazily */
let permissionTableCache: PermissionRule[] | null = null;

/**
 * Build the complete permission table covering all roles × DocTypes × actions.
 * Used for diagnostics, export, and permission introspection.
 */
function buildPermissionTable(): PermissionRule[] {
  if (permissionTableCache) return permissionTableCache;

  const rules: PermissionRule[] = [];

  for (const doctype of ALL_DOCTYPES) {
    for (const action of ALL_ACTIONS) {
      // Skip submit/cancel/amend for non-submittable DocTypes
      if (!isSubmittableDocType(doctype) && SUBMIT_ACTIONS.includes(action)) {
        continue;
      }

      const allowedRoles = ALL_ROLES.filter((role) =>
        hasPermission(role, doctype, action),
      );

      if (allowedRoles.length > 0) {
        rules.push({ doctype, action, allowedRoles: [...allowedRoles] });
      }
    }
  }

  permissionTableCache = rules;
  return rules;
}

// ── Permission checks ────────────────────────────────────────────────────────

/**
 * Check if the current user has permission for a document action.
 * Loads the user session from the database and checks against the permission table.
 *
 * @param doctype - The DocType being accessed
 * @param action  - The action being performed
 * @returns Object with `allowed` flag and optional `reason` when denied
 */
export async function checkPermission(
  doctype: string,
  action: DocAction,
): Promise<{ allowed: boolean; reason?: string }> {
  const session = await getCurrentSession();

  if (!session) {
    return { allowed: false, reason: "No active session — please log in" };
  }

  if (hasPermission(session.role, doctype, action)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Role '${session.role}' does not have '${action}' permission on '${doctype}'`,
  };
}

// ── Current user session ──────────────────────────────────────────────────────

/**
 * Get the current user session from the database.
 * Looks up the most recent active session and resolves the user's role.
 *
 * In a production setup, this would be called with request context (cookies/headers).
 * For now, it accepts the session token from the caller or returns null.
 *
 * @returns User session or null if no active session
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  try {
    // Find the most recent active session
    const activeSession = await prisma.sessions.findFirst({
      where: {
        is_active: true,
        expires: { gte: new Date() },
      },
      orderBy: { created_at: "desc" },
      include: {
        users: true,
      },
    });

    if (!activeSession || !activeSession.users) return null;

    const user = activeSession.users;

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      subsidiary: user.subsidiary,
      company: user.company,
    };
  } catch (_e: unknown) {
    return null;
  }
}

/**
 * Get a user session by session token.
 * Useful when the session token is available from request cookies.
 *
 * @param token - The session token string
 * @returns User session or null if token is invalid/expired
 */
export async function getSessionByToken(token: string): Promise<UserSession | null> {
  try {
    const session = await prisma.sessions.findUnique({
      where: { session_token: token },
      include: {
        users: true,
      },
    });

    if (!session || !session.users || !session.is_active) return null;
    if (session.expires < new Date()) return null;

    const user = session.users;

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      subsidiary: user.subsidiary,
      company: user.company,
    };
  } catch (_e: unknown) {
    return null;
  }
}

// ── Permission introspection ──────────────────────────────────────────────────

/**
 * Get all permissions for a specific role.
 * Returns all permission rules where the given role is in the allowed list.
 *
 * @param role - The role name
 * @returns Array of permission rules for the role
 */
export function getPermissionsForRole(role: string): PermissionRule[] {
  const table = buildPermissionTable();
  return table.filter((rule) => rule.allowedRoles.includes(role));
}

/**
 * Get all actions allowed for a role on a specific DocType.
 *
 * @param role    - The role name
 * @param doctype - The DocType name
 * @returns Array of allowed actions
 */
export function getAllowedActions(role: string, doctype: string): DocAction[] {
  return ALL_ACTIONS.filter((action) => {
    // Skip submit/cancel/amend for non-submittable DocTypes
    if (!isSubmittableDocType(doctype) && SUBMIT_ACTIONS.includes(action)) {
      return false;
    }
    return hasPermission(role, doctype, action);
  });
}

// ── Utility: Validate user role ───────────────────────────────────────────────

/**
 * Check if a role string is a recognized system role.
 *
 * @param role - The role string to validate
 * @returns True if the role is recognized
 */
export function isValidRole(role: string): boolean {
  return (ALL_ROLES as readonly string[]).includes(role);
}

/**
 * Get all recognized role names.
 * Useful for role selection UI and validation.
 */
export function getAllRoles(): string[] {
  return [...ALL_ROLES];
}

/**
 * Get all covered DocType names.
 * Useful for permission management UI.
 */
export function getAllDocTypes(): string[] {
  return [...ALL_DOCTYPES];
}
