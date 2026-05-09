/**
 * Auth Actions — Re-exported from lib/frappe-auth.ts.
 *
 * NOTE: Do NOT add "use server" here. The source file (lib/frappe-auth.ts)
 * already has "use server". Re-exporting with "use server" breaks Turbopack
 * because only async function declarations are allowed in "use server" files.
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
