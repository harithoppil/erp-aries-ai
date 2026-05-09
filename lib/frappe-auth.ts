"use server";

import { SignJWT, jwtVerify } from "jose";
import { hashPassword, verifyPassword } from "@/lib/password";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// ── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) throw new Error("JWT_SECRET environment variable is required");
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

const COOKIE_NAME = "token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const SESSION_DURATION = "24h";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Password Policy ─────────────────────────────────────────────────────────

interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least 1 uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least 1 lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least 1 digit");
  return { valid: errors.length === 0, errors };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  subsidiary: string | null;
  company: string;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

// ── Helper: Create JWT ───────────────────────────────────────────────────────

async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET);
}

// ── Helper: Create Refresh Token ────────────────────────────────────────────

async function createRefreshToken(
  userId: string,
  sessionId: string
): Promise<string> {
  return new SignJWT({ userId, sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

// ── Helper: Verify JWT ───────────────────────────────────────────────────────

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ── Helper: Verify Refresh Token ────────────────────────────────────────────

interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  type: string;
}

async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const data = payload as unknown as RefreshTokenPayload;
    if (data.type !== "refresh") return null;
    return data;
  } catch {
    return null;
  }
}

// ── Login ────────────────────────────────────────────────────────────────────

export async function loginAction({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<ActionResult<SessionPayload>> {
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!user.is_active) {
    return { success: false, error: "Account is deactivated. Contact admin." };
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return { success: false, error: "Invalid email or password" };
  }

  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    subsidiary: user.subsidiary,
    company: user.company,
  };

  const token = await createToken(payload);

  const cookieStore = await cookies();
  const ip = cookieStore.get("x-forwarded-for")?.value || null;

  // Create session + refresh token in a transaction
  const session = await prisma.$transaction(async (tx) => {
    const newSession = await tx.sessions.create({
      data: {
        user_id: user.id,
        session_token: token,
        expires: new Date(Date.now() + SESSION_DURATION_MS),
        ip_address: ip,
        is_active: true,
      },
    });

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

    await tx.users.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    return { session: newSession, refreshToken: refreshTokenValue };
  });

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_DURATION_MS / 1000,
  });

  return { success: true, data: payload };
}

// ── Signup ───────────────────────────────────────────────────────────────────

export async function signupAction({
  name,
  email,
  password,
  role = "user",
  department,
  subsidiary,
}: {
  name: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  subsidiary?: string;
}): Promise<ActionResult<SessionPayload>> {
  // Enforce password policy
  const policy = validatePasswordPolicy(password);
  if (!policy.valid) {
    return { success: false, error: policy.errors.join(". ") };
  }

  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        email,
        password_hash: passwordHash,
        name,
        role,
        department: department || null,
        subsidiary: subsidiary || null,
      },
    });

    const payload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      subsidiary: user.subsidiary,
      company: user.company,
    };

    const token = await createToken(payload);

    const newSession = await tx.sessions.create({
      data: {
        user_id: user.id,
        session_token: token,
        expires: new Date(Date.now() + SESSION_DURATION_MS),
        is_active: true,
      },
    });

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

    return { user, token, refreshToken: refreshTokenValue };
  });

  const payload: SessionPayload = {
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    role: result.user.role,
    department: result.user.department,
    subsidiary: result.user.subsidiary,
    company: result.user.company,
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_DURATION_MS / 1000,
  });

  return { success: true, data: payload };
}

// ── Signout ──────────────────────────────────────────────────────────────────

export async function signoutAction(): Promise<ActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const refreshTokenValue = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  await prisma.$transaction(async (tx) => {
    if (token) {
      await tx.sessions.updateMany({
        where: { session_token: token, is_active: true },
        data: { is_active: false },
      });
    }

    if (refreshTokenValue) {
      await tx.refresh_tokens.updateMany({
        where: { token: refreshTokenValue, is_revoked: false },
        data: { is_revoked: true },
      });
    }
  });

  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  return { success: true };
}

// ── Refresh Token ────────────────────────────────────────────────────────────

export async function refreshTokenAction(): Promise<ActionResult<SessionPayload>> {
  const cookieStore = await cookies();
  const refreshTokenValue = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshTokenValue) {
    return { success: false, error: "No refresh token provided" };
  }

  const refreshPayload = await verifyRefreshToken(refreshTokenValue);
  if (!refreshPayload) {
    return { success: false, error: "Invalid or expired refresh token" };
  }

  // Check the refresh token in DB
  const storedToken = await prisma.refresh_tokens.findUnique({
    where: { token: refreshTokenValue },
  });

  if (!storedToken || storedToken.is_revoked || storedToken.expires < new Date()) {
    return { success: false, error: "Refresh token revoked or expired" };
  }

  // Verify the user still exists and is active
  const user = await prisma.users.findUnique({
    where: { id: refreshPayload.userId },
  });

  if (!user || !user.is_active) {
    return { success: false, error: "User not found or deactivated" };
  }

  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    subsidiary: user.subsidiary,
    company: user.company,
  };

  const newAccessToken = await createToken(payload);

  // Rotate refresh token: revoke old, create new — all in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Revoke old refresh token
    await tx.refresh_tokens.update({
      where: { id: storedToken.id },
      data: { is_revoked: true },
    });

    // Deactivate old session if it exists
    if (storedToken.session_id) {
      await tx.sessions.updateMany({
        where: { id: storedToken.session_id, is_active: true },
        data: { is_active: false },
      });
    }

    // Create new session
    const newSession = await tx.sessions.create({
      data: {
        user_id: user.id,
        session_token: newAccessToken,
        expires: new Date(Date.now() + SESSION_DURATION_MS),
        is_active: true,
      },
    });

    // Create new refresh token
    const newRefreshTokenValue = await createRefreshToken(user.id, newSession.id);

    await tx.refresh_tokens.create({
      data: {
        user_id: user.id,
        token: newRefreshTokenValue,
        session_id: newSession.id,
        expires: new Date(Date.now() + REFRESH_DURATION_MS),
        is_revoked: false,
      },
    });

    return { refreshToken: newRefreshTokenValue };
  });

  cookieStore.set(COOKIE_NAME, newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_DURATION_MS / 1000,
  });

  return { success: true, data: payload };
}

// ── Change Password ──────────────────────────────────────────────────────────

export async function changePasswordAction({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  // Enforce password policy on new password
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return { success: false, error: policy.errors.join(". ") };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return { success: false, error: "Not authenticated" };
  }

  const sessionPayload = await verifyToken(token);
  if (!sessionPayload) {
    return { success: false, error: "Invalid session" };
  }

  const user = await prisma.users.findUnique({
    where: { id: sessionPayload.userId },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const passwordValid = await verifyPassword(currentPassword, user.password_hash);
  if (!passwordValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  const newHash = await hashPassword(newPassword);

  await prisma.users.update({
    where: { id: user.id },
    data: { password_hash: newHash },
  });

  return { success: true };
}

// ── Session Revocation ───────────────────────────────────────────────────────

export async function revokeAllSessionsAction(
  userId: string
): Promise<ActionResult> {
  await prisma.$transaction(async (tx) => {
    await tx.sessions.updateMany({
      where: { user_id: userId, is_active: true },
      data: { is_active: false },
    });

    await tx.refresh_tokens.updateMany({
      where: { user_id: userId, is_revoked: false },
      data: { is_revoked: true },
    });
  });

  return { success: true };
}

export async function revokeSessionAction(
  sessionId: string
): Promise<ActionResult> {
  await prisma.$transaction(async (tx) => {
    await tx.sessions.update({
      where: { id: sessionId },
      data: { is_active: false },
    });

    await tx.refresh_tokens.updateMany({
      where: { session_id: sessionId, is_revoked: false },
      data: { is_revoked: true },
    });
  });

  return { success: true };
}

// ── Get Session (verify JWT from cookie) ─────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const session = await prisma.sessions.findUnique({
    where: { session_token: token },
    select: { is_active: true, expires: true },
  });

  if (!session || !session.is_active || session.expires < new Date()) {
    return null;
  }

  return payload;
}

// ── Get Current User (full record) ──────────────────────────────────────────

export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  subsidiary: string | null;
  company: string | null;
  is_active: boolean | null;
  avatar_url: string | null;
  last_login: Date | null;
  created_at: Date | null;
} | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.users.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      subsidiary: true,
      company: true,
      is_active: true,
      avatar_url: true,
      last_login: true,
      created_at: true,
    },
  });

  return user;
}

// ── Seed default admin (call once from seed script) ─────────────────────────

export async function seedAdminUser(): Promise<ActionResult> {
  const existing = await prisma.users.findUnique({
    where: { email: "admin@ariesmarine.com" },
  });

  if (existing) {
    return { success: true, error: "Admin user already exists" };
  }

  const passwordHash = await hashPassword("admin123");

  await prisma.users.create({
    data: {
      email: "admin@ariesmarine.com",
      password_hash: passwordHash,
      name: "Admin",
      role: "admin",
      company: "Aries Marine",
      is_active: true,
    },
  });

  return { success: true };
}
