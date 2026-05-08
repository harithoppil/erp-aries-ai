"use server";

import { SignJWT, jwtVerify } from "jose";
import { hashPassword, verifyPassword } from "@/lib/password";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// ── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "aries-erp-jwt-secret-fallback"
);
const COOKIE_NAME = "token";
const SESSION_DURATION = "24h";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// ── Helper: Verify JWT ───────────────────────────────────────────────────────

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
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
  // Find user by email
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!user.is_active) {
    return { success: false, error: "Account is deactivated. Contact admin." };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Build session payload
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    subsidiary: user.subsidiary,
    company: user.company,
  };

  // Create JWT
  const token = await createToken(payload);

  // Create session record in DB
  const cookieStore = await cookies();
  const ip = cookieStore.get("x-forwarded-for")?.value || null;

  await prisma.sessions.create({
    data: {
      user_id: user.id,
      session_token: token,
      expires: new Date(Date.now() + SESSION_DURATION_MS),
      ip_address: ip,
      is_active: true,
    },
  });

  // Update last login
  await prisma.users.update({
    where: { id: user.id },
    data: { last_login: new Date() },
  });

  // Set httpOnly cookie
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
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
  // Check if email already exists
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await prisma.users.create({
    data: {
      email,
      password_hash: passwordHash,
      name,
      role,
      department: department || null,
      subsidiary: subsidiary || null,
    },
  });

  // Auto-login after signup
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

  // Create session record
  await prisma.sessions.create({
    data: {
      user_id: user.id,
      session_token: token,
      expires: new Date(Date.now() + SESSION_DURATION_MS),
      is_active: true,
    },
  });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return { success: true, data: payload };
}

// ── Signout ──────────────────────────────────────────────────────────────────

export async function signoutAction(): Promise<ActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    // Deactivate session in DB
    await prisma.sessions.updateMany({
      where: { session_token: token, is_active: true },
      data: { is_active: false },
    });
  }

  // Clear cookie
  cookieStore.delete(COOKIE_NAME);

  return { success: true };
}

// ── Get Session (verify JWT from cookie) ─────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Optionally: verify session is still active in DB
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

export async function getCurrentUser() {
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
