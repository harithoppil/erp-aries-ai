"use server";

/**
 * Next.js Server Actions wrapping the WebAuthn functions from lib/erpnext/webauthn.ts.
 *
 * Each action calls the corresponding function from the WebAuthn library.
 * Follows the Revolyzz pattern for server actions.
 */

import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthOptions,
  verifyPasskeyAuthentication,
  getUserPasskeys,
  removePasskey,
  type RegistrationOptionsResult,
  type RegistrationVerifyResult,
  type AuthOptionsResult,
  type AuthVerifyResult,
  type PasskeyInfo,
} from "@/lib/erpnext/webauthn";

import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";

import { revalidatePath } from "next/cache";

// ── Generate Passkey Registration Options ───────────────────────────────────

export async function generatePasskeyRegistrationOptionsAction(
  userId: string,
  deviceName: string
): Promise<RegistrationOptionsResult> {
  const result = await generatePasskeyRegistrationOptions(userId, deviceName);
  return result;
}

// ── Verify Passkey Registration ─────────────────────────────────────────────

export async function verifyPasskeyRegistrationAction(
  response: RegistrationResponseJSON,
  challenge: string,
  userId: string,
  deviceName: string
): Promise<RegistrationVerifyResult> {
  const result = await verifyPasskeyRegistration(response, challenge, userId, deviceName);
  revalidatePath("/dashboard/settings/security");
  return result;
}

// ── Generate Passkey Auth Options ───────────────────────────────────────────

export async function generatePasskeyAuthOptionsAction(): Promise<AuthOptionsResult> {
  const result = await generatePasskeyAuthOptions();
  return result;
}

// ── Verify Passkey Authentication ───────────────────────────────────────────

export async function verifyPasskeyAuthenticationAction(
  response: AuthenticationResponseJSON,
  challenge: string
): Promise<AuthVerifyResult> {
  const result = await verifyPasskeyAuthentication(response, challenge);
  revalidatePath("/dashboard");
  return result;
}

// ── Get User Passkeys ───────────────────────────────────────────────────────

export async function getUserPasskeysAction(userId: string): Promise<PasskeyInfo[]> {
  const result = await getUserPasskeys(userId);
  return result;
}

// ── Remove Passkey ──────────────────────────────────────────────────────────

export async function removePasskeyAction(
  userId: string,
  credentialId: string
): Promise<PasskeyInfo[]> {
  const result = await removePasskey(userId, credentialId);
  revalidatePath("/dashboard/settings/security");
  return result;
}
