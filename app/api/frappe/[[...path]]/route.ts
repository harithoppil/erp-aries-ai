/**
 * Generic Frappe Proxy — forwards any request to the Frappe backend.
 *
 * Path: /api/frappe/<anything>
 * Forwards to: <FRAPPE_URL>/api/<anything>
 *
 * This acts as a CORS-safe bridge between the Next.js frontend and
 * the Frappe / ERPNext backend running on a different port / origin.
 */

import { NextRequest, NextResponse } from "next/server";

const FRAPPE_BASE =
  process.env.FRAPPE_URL || process.env.NEXT_PUBLIC_FRAPPE_URL || "http://localhost:9000";

async function proxyRequest(req: NextRequest, method: string) {
  // Reconstruct the target path: /api/frappe/method/login → /api/method/login
  const pathname = req.nextUrl.pathname;
  const frappePath = pathname.replace(/^\/api\/frappe/, "");
  const targetUrl = `${FRAPPE_BASE}${frappePath}${req.nextUrl.search}`;

  // Forward cookies
  const cookie = req.headers.get("cookie") || "";

  // Build headers
  const headers = new Headers();
  headers.set("cookie", cookie);
  if (method !== "GET" && method !== "HEAD") {
    const ct = req.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
  }

  // Forward acceptable headers
  for (const [key, val] of req.headers.entries()) {
    if (["x-requested-with", "x-frappe-csrf-token", "accept", "authorization"].includes(key.toLowerCase())) {
      headers.set(key, val);
    }
  }

  // Read body
  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  // Fetch from Frappe
  const res = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: "manual",
  });

  // Build response
  const response = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
  });

  // Forward Set-Cookie headers
  res.headers.forEach((val, key) => {
    if (key.toLowerCase() === "set-cookie") {
      response.headers.append(key, val);
    } else if (!response.headers.has(key)) {
      response.headers.set(key, val);
    }
  });

  return response;
}

export async function GET(req: NextRequest) {
  return proxyRequest(req, "GET");
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, "POST");
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req, "PUT");
}

export async function PATCH(req: NextRequest) {
  return proxyRequest(req, "PATCH");
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req, "DELETE");
}
