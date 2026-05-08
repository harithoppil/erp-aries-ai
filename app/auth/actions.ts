"use server";

/**
 * Auth Actions — Frappe / ERPNext Session-based.
 *
 * Re-exported from lib/frappe-auth.ts so the rest of the app
 * continues to import from "@/app/auth/actions" without change.
 */

export {
  loginAction,
  signupAction,
  signoutAction,
  getSession,
  getCurrentUser,
  seedAdminUser,
} from "@/lib/frappe-auth";

export type {
  SessionPayload,
  ActionResult,
} from "@/lib/frappe-auth";
