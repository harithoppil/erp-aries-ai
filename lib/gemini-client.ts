/**
 * Raw Gemini / Vertex AI client for browser-side function calling.
 *
 * Uses EPHEMERAL TOKENS for security:
 * 1. Browser asks backend /ai/token for a short-lived OAuth token
 * 2. Backend mints token from service account (GCA_KEY) — expires ~1 hour
 * 3. Browser calls Vertex AI REST API directly with Bearer token
 * 4. No long-lived credentials ever touch the browser
 *
 * Two modes:
 * - DIRECT (default with ephemeral token): Browser → /ai/token → Vertex AI
 * - PROXY (fallback): Browser → /ai/ui-plan → Backend handles Gemini call
 *
 * Now uses the provider-agnostic adapter pattern from ai-tool-adapters.ts.
 * The tool schema conversion and response parsing are delegated to the adapter,
 * making it easy to swap to OpenAI or Anthropic in the future.
 *
 * Usage:
 *   const calls = await planUIActions({
 *     message: "Add a customer named Acme",
 *     pageContext: "Customers page: 5 customers...",
 *     actions: [{ name: "create_customer", description: "...", parameters: {...} }],
 *   });
 *   // calls = [{ name: "create_customer", args: { customer_name: "Acme", ... } }]
 */

import { API_BASE } from "@/lib/api";
import { getAdapter, type AIProvider, type FunctionCallResult } from "@/lib/ai-tool-adapters";
import type { UIAction } from "@/store/useActionDispatcher";

/** A function call returned by any AI provider (unified format) */
export type FunctionCall = FunctionCallResult;

export interface PlanOptions {
  message: string;
  pageContext: string;
  pageLabel: string;
  actions: UIAction[];
  direct?: boolean;       // true = use ephemeral token + direct Vertex AI call
  model?: string;         // Vertex AI model ID
  provider?: AIProvider;  // Which provider to use (default: gemini)
}

/** Cached ephemeral token to avoid fetching on every call */
let cachedToken: { token: string; expiresAt: number; projectId: string } | null = null;

/**
 * Call AI provider to plan UI actions.
 * Returns a list of function calls to execute.
 */
export async function planUIActions(options: PlanOptions): Promise<FunctionCall[]> {
  const provider = options.provider || "gemini";

  // For now, direct mode only supports Gemini (OpenAI/Anthropic go through proxy)
  if (provider === "gemini" && options.direct !== false) {
    try {
      return await callVertexAIDirect(options);
    } catch (e) {
      console.warn("[GeminiClient] Direct call failed, falling back to proxy:", e);
    }
  }
  return callAIViaProxy(options);
}

/**
 * MODE 1: DIRECT — Ephemeral token → Vertex AI REST API from browser.
 *
 * Security: No long-lived key in browser. Token expires in ~1 hour.
 * Speed: ~50-150ms round-trip (no backend proxy hop).
 *
 * Uses the Gemini adapter to convert canonical actions → functionDeclarations
 * and parse the response → FunctionCall[].
 */
async function callVertexAIDirect(options: PlanOptions): Promise<FunctionCall[]> {
  const { message, pageContext, pageLabel, actions, model = "gemini-3-flash-preview" } = options;
  const adapter = getAdapter("gemini");

  // Step 1: Get (or refresh) ephemeral token
  const auth = await getEphemeralToken();

  // Step 2: Convert canonical actions → Gemini functionDeclarations
  const toolSpec = adapter.toToolSpec(actions);

  // Step 3: Build prompt
  const prompt = `You are a UI action planner for an ERP web app. The user is on the "${pageLabel}" page.

Page context: ${pageContext.slice(0, 600)}

User request: ${message}

Decide which UI actions (if any) to execute immediately. Only call functions directly relevant to the request. Infer reasonable form values from the user's message. If the user is just asking a question, do not call any functions. When calling a function with object parameters, provide all required fields. If a required field is missing from the user's message, ask the user instead of calling the function.`;

  // Step 4: Call Vertex AI REST API directly from browser
  const location = "us-central1"; // Vertex AI location
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${auth.projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [toolSpec],
      toolConfig: {
        functionCallingConfig: { mode: "AUTO" },
      },
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // If token expired, clear cache and retry once
    if (response.status === 401) {
      cachedToken = null;
      throw new Error("Token expired — will retry with fresh token");
    }
    throw new Error(`Vertex AI error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  // Step 5: Parse response using adapter
  return adapter.parseResponse(data);
}

/**
 * Fetch ephemeral OAuth token from backend. Cached until near expiry.
 */
async function getEphemeralToken(): Promise<{ token: string; projectId: string }> {
  // Return cached token if valid for at least 5 more minutes
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { token: cachedToken.token, projectId: cachedToken.projectId };
  }

  const res = await fetch(`${API_BASE}/ai/token`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token endpoint failed: ${err.detail || res.statusText}`);
  }

  const data = await res.json();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600 * 1000;

  cachedToken = {
    token: data.token,
    expiresAt,
    projectId: data.project_id,
  };

  return { token: data.token, projectId: data.project_id };
}

/**
 * MODE 2: PROXY — Backend handles the AI call securely.
 * Fallback if direct mode fails or if service account isn't configured.
 * Also used for OpenAI/Anthropic providers (their direct API keys shouldn't
 * be in the browser).
 */
async function callAIViaProxy(options: PlanOptions): Promise<FunctionCall[]> {
  const provider = options.provider || "gemini";
  const adapter = getAdapter(provider);

  // Convert actions to provider-specific format for the proxy
  const toolSpec = adapter.toToolSpec(options.actions);

  const res = await fetch(`${API_BASE}/ai/ui-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: options.message,
      page_context: options.pageContext,
      page_label: options.pageLabel,
      actions: options.actions, // Send canonical format — proxy can convert
      provider,
      tool_spec: toolSpec,     // Pre-converted format for the provider
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn("[UI Plan] Backend proxy failed:", err);
    return [];
  }

  const data = await res.json();
  return adapter.parseResponse(data);
}

/**
 * Execute function calls with optional staggered animation delay.
 * Each call is looked up in the provided handler map and executed.
 */
export async function executeFunctionCalls(
  calls: FunctionCall[],
  handlers: Map<string, (args: Record<string, any>) => void>,
  options: { staggerMs?: number; onExecute?: (call: FunctionCall) => void } = {}
): Promise<void> {
  const { staggerMs = 150, onExecute } = options;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const handler = handlers.get(call.name);

    if (!handler) {
      console.warn(`[GeminiClient] No handler for action: ${call.name}`);
      continue;
    }

    // Stagger execution for visual effect (dialog opens, then form fills one by one)
    if (i > 0 && staggerMs > 0) {
      await new Promise(r => setTimeout(r, staggerMs));
    }

    try {
      handler(call.args);
      onExecute?.(call);
    } catch (e) {
      console.error(`[GeminiClient] Action ${call.name} failed:`, e);
    }
  }
}
