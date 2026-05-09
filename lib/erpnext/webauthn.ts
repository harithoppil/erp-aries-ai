/**
 * WebAuthn/Passkey support for ERPNext Aries.
 *
 * Adapted from Revolyzz pattern but using our `prisma` client,
 * our `users` table, and our `webauthn_credentials` table.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - Multi-step DB operations use prisma.$transaction().
 * - Uses @simplewebauthn/server for WebAuthn protocol handling.
 */

import { SignJWT } from "jose";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/frappe-auth";

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import type {
  AuthenticatorTransportFuture,
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorDevice,
} from "@simplewebauthn/types";

// ── Config ──────────────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === "production";

const rpName = process.env.WEBAUTHN_RP_NAME || "Aries ERP";
const rpID = isProduction
  ? process.env.WEBAUTHN_RP_ID || "ariesmarine.com"
  : process.env.WEBAUTHN_RP_LOCAL_ID || "localhost";
const origin = isProduction
  ? process.env.WEBAUTHN_ORIGIN || "https://ariesmarine.com"
  : process.env.WEBAUTHN_LOCAL_ORIGIN || "http://localhost:3000";

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) throw new Error("JWT_SECRET environment variable is required");
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_PASSKEYS_PER_USER = 5;

// ── Types ────────────────────────────────────────────────────────────────────

export interface PasskeyInfo {
  id: string;
  credentialId: string;
  deviceName: string | null;
  lastUsed: Date | null;
  createdAt: Date;
}

export interface RegistrationOptionsResult {
  options: PublicKeyCredentialCreationOptionsJSON;
  deviceName: string;
}

export interface AuthOptionsResult {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface RegistrationVerifyResult {
  success: boolean;
  credentials: PasskeyInfo[];
}

export interface AuthVerifyResult {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// ── Helper: Get authenticated user ──────────────────────────────────────────

async function getAuthenticatedUser(): Promise<{ id: string; email: string; name: string; role: string } | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
  };
}

// ── Helper: Create refresh token ────────────────────────────────────────────

async function createRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ userId, sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

// ── Generate Passkey Registration Options ───────────────────────────────────

/**
 * Generates registration challenge for a new passkey.
 * Follows the Revolyzz pattern: checks auth, limits passkeys, excludes existing.
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  deviceName: string
): Promise<RegistrationOptionsResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("You must be logged in to register a passkey");
  }

  if (user.id !== userId) {
    throw new Error("User ID mismatch");
  }

  // Check max passkey limit
  const existingCredentials = await prisma.webauthn_credentials.findMany({
    where: { user_id: userId },
  });

  if (existingCredentials.length >= MAX_PASSKEYS_PER_USER) {
    throw new Error(`Maximum number of passkeys (${MAX_PASSKEYS_PER_USER}) reached`);
  }

  // Determine device name
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const deviceToUse = deviceName || userAgent;

  // Check if this device already has a passkey
  const existingDeviceCredential = existingCredentials.find(
    (cred) => cred.device_name === deviceToUse
  );
  if (existingDeviceCredential) {
    throw new Error("This device already has a registered passkey. Please remove it first.");
  }

  // Build excluded credentials list
  const excludedCredentials = existingCredentials.map((cred) => ({
    id: cred.credential_id,
    type: "public-key" as const,
    transports: cred.transports
      ? (cred.transports.split(",") as AuthenticatorTransportFuture[])
      : undefined,
  }));

  // Generate registration options (same as Revolyzz pattern)
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    excludeCredentials: excludedCredentials,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  return {
    options,
    deviceName: deviceToUse,
  };
}

// ── Verify Passkey Registration ─────────────────────────────────────────────

/**
 * Verifies the registration response and stores the credential.
 * Follows the Revolyzz pattern: verify attestation, store in DB.
 */
export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  challenge: string,
  userId: string,
  deviceName: string
): Promise<RegistrationVerifyResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("You must be logged in to register a passkey");
  }

  if (user.id !== userId) {
    throw new Error("User ID mismatch");
  }

  // Verify the attestation (same as Revolyzz)
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo?.credentialID) {
    throw new Error("Verification failed");
  }

  const credentialID = verification.registrationInfo.credentialID;
  const credentialPublicKey = verification.registrationInfo.credentialPublicKey;
  const counter = verification.registrationInfo.counter;
  const transports = response.response.transports
    ? response.response.transports.join(",")
    : undefined;

  // Store credential in DB (single create — no multi-step needed)
  await prisma.webauthn_credentials.create({
    data: {
      user_id: userId,
      credential_id: credentialID,
      public_key: Buffer.from(credentialPublicKey),
      counter,
      transports,
      device_name: deviceName,
    },
  });

  // Return updated credential list
  const updatedCredList = await prisma.webauthn_credentials.findMany({
    where: { user_id: userId },
    select: {
      id: true,
      credential_id: true,
      device_name: true,
      last_used: true,
      created_at: true,
    },
  });

  return {
    success: true,
    credentials: updatedCredList.map((c) => ({
      id: c.id,
      credentialId: c.credential_id,
      deviceName: c.device_name,
      lastUsed: c.last_used,
      createdAt: c.created_at,
    })),
  };
}

// ── Generate Passkey Auth Options ───────────────────────────────────────────

/**
 * Generates authentication challenge for passkey login.
 * Follows the Revolyzz pattern: loads all credentials for allowCredentials.
 */
export async function generatePasskeyAuthOptions(): Promise<AuthOptionsResult> {
  // Load all credentials (for discoverable login)
  const credentials = await prisma.webauthn_credentials.findMany({
    select: {
      credential_id: true,
      transports: true,
    },
  });

  const allowCredentials = credentials.map((cred) => ({
    id: cred.credential_id,
    type: "public-key" as const,
    transports: cred.transports
      ? (cred.transports.split(",") as AuthenticatorTransportFuture[])
      : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "required",
  });

  return {
    options,
  };
}

// ── Verify Passkey Authentication ───────────────────────────────────────────

/**
 * Verifies passkey authentication and creates session.
 * Follows the Revolyzz pattern: verify assertion, create session, set cookie.
 */
export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  challenge: string
): Promise<AuthVerifyResult> {
  // Find the credential in the database
  const authenticatorRecord = await prisma.webauthn_credentials.findUnique({
    where: { credential_id: response.id },
    include: { users: true },
  });

  if (!authenticatorRecord || !authenticatorRecord.users) {
    throw new Error("Credential not found");
  }

  const user = authenticatorRecord.users;

  if (!user.is_active) {
    throw new Error("Account is deactivated. Contact admin.");
  }

  // Build the authenticator device object for verification (v10 API)
  const authenticator: AuthenticatorDevice = {
    credentialID: authenticatorRecord.credential_id,
    credentialPublicKey: authenticatorRecord.public_key,
    counter: authenticatorRecord.counter,
    transports: authenticatorRecord.transports
      ? (authenticatorRecord.transports.split(",") as AuthenticatorTransportFuture[])
      : (["internal"] as AuthenticatorTransportFuture[]),
  };

  // Verify the assertion
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator,
  });

  if (!verification.verified) {
    throw new Error("Verification failed");
  }

  // Build session payload
  const sessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    subsidiary: user.subsidiary,
    company: user.company,
  };

  const token = await new SignJWT(sessionPayload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);

  // Multi-step: update credential, deactivate old sessions, create new session + refresh token
  const headersList = await headers();
  const cookieStore = await cookies();
  const ip = headersList.get("x-forwarded-for") || null;
  const userAgent = headersList.get("user-agent") || null;

  const result = await prisma.$transaction(async (tx) => {
    // Update credential counter and last used
    await tx.webauthn_credentials.update({
      where: { id: authenticatorRecord.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        last_used: new Date(),
      },
    });

    // Deactivate existing sessions
    await tx.sessions.updateMany({
      where: { user_id: user.id, is_active: true },
      data: { is_active: false },
    });

    // Create new session
    const newSession = await tx.sessions.create({
      data: {
        session_token: token,
        user_id: user.id,
        expires: new Date(Date.now() + SESSION_DURATION_MS),
        ip_address: ip,
        user_agent: authenticatorRecord.device_name || userAgent,
        is_active: true,
      },
    });

    // Create refresh token
    const refreshTokenValue = await createRefreshToken(user.id, newSession.id);

    await tx.refresh_tokens.create({
      data: {
        user_id: user.id,
        token: refreshTokenValue,
        session_id: newSession.id,
        expires: new Date(Date.now() + REFRESH_DURATION_MS),
        is_revoked: false,
      },
    });

    // Update last login time
    await tx.users.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    return { refreshToken: refreshTokenValue };
  });

  // Set token cookies
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });

  cookieStore.set("refresh_token", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_DURATION_MS / 1000,
    path: "/",
  });

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

// ── Get User Passkeys ───────────────────────────────────────────────────────

/**
 * Lists all passkeys for the authenticated user.
 */
export async function getUserPasskeys(userId: string): Promise<PasskeyInfo[]> {
  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    throw new Error("Not authenticated or user ID mismatch");
  }

  const credentials = await prisma.webauthn_credentials.findMany({
    where: { user_id: userId },
    select: {
      id: true,
      credential_id: true,
      device_name: true,
      last_used: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  return credentials.map((c) => ({
    id: c.id,
    credentialId: c.credential_id,
    deviceName: c.device_name,
    lastUsed: c.last_used,
    createdAt: c.created_at,
  }));
}

// ── Remove Passkey ──────────────────────────────────────────────────────────

/**
 * Removes a passkey credential for the authenticated user.
 * Prevents removing the last passkey (same as Revolyzz pattern).
 */
export async function removePasskey(
  userId: string,
  credentialId: string
): Promise<PasskeyInfo[]> {
  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    throw new Error("Not authenticated or user ID mismatch");
  }

  // Find the credential and verify ownership
  const credential = await prisma.webauthn_credentials.findFirst({
    where: {
      credential_id: credentialId,
      user_id: userId,
    },
  });

  if (!credential) {
    throw new Error("Credential not found or does not belong to you");
  }

  // Count user's credentials — prevent removing the last one
  const credentialCount = await prisma.webauthn_credentials.count({
    where: { user_id: userId },
  });

  if (credentialCount <= 1) {
    throw new Error("Cannot remove the last passkey");
  }

  // Delete the credential
  await prisma.webauthn_credentials.delete({
    where: { id: credential.id },
  });

  // Return updated list
  const updatedCredentials = await prisma.webauthn_credentials.findMany({
    where: { user_id: userId },
    select: {
      id: true,
      credential_id: true,
      device_name: true,
      last_used: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  return updatedCredentials.map((c) => ({
    id: c.id,
    credentialId: c.credential_id,
    deviceName: c.device_name,
    lastUsed: c.last_used,
    createdAt: c.created_at,
  }));
}
