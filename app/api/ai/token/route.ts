/**
 * Ephemeral OAuth Token API Route.
 *
 * Replaces Python backend /api/v1/ai/token.
 * Mints a short-lived OAuth access token from the GCA_KEY service account.
 * Used by the browser for direct Vertex AI calls (Track 1).
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cache token in-process (same pattern as ai/actions.ts)
let cachedToken: { token: string; expiresAt: number; projectId: string } | null = null;

export async function GET() {
  try {
    // Return cached token if valid for at least 5 more minutes
    if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({
        token: cachedToken.token,
        expires_at: new Date(cachedToken.expiresAt).toISOString(),
        project_id: cachedToken.projectId,
      });
    }

    const { GoogleAuth } = await import("google-auth-library");
    const keyJson = process.env.GCA_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!keyJson) {
      return NextResponse.json(
        { error: "GCA_KEY not configured" },
        { status: 503 }
      );
    }

    const parsedKey = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    const projectId = parsedKey.project_id || "";

    const auth = new GoogleAuth({
      credentials: parsedKey,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("No access token returned");

    cachedToken = {
      token,
      expiresAt: Date.now() + 3600 * 1000, // ~1 hour
      projectId,
    };

    return NextResponse.json({
      token,
      expires_at: new Date(cachedToken.expiresAt).toISOString(),
      project_id: projectId,
    });
  } catch (error:any) {
    console.error("[api/ai/token] Failed:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Failed to mint token" },
      { status: 500 }
    );
  }
}
