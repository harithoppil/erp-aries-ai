/**
 * UI Action Planning API Route.
 *
 * Replaces Python backend /api/v1/ai/ui-plan.
 * Takes the user's message + page context + available UI actions,
 * asks Gemini which actions to execute, and returns structured function calls.
 *
 * This is the "fast track" (Track 1) for immediate UI actions.
 * The browser falls back to this route when direct Vertex AI calls fail.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/ai-tool-adapters";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, page_context, page_label, actions, provider = "gemini", tool_spec } = body;

  if (!message || !actions?.length) {
    return NextResponse.json({ function_calls: [] });
  }

  const adapter = getAdapter(provider);

  // Build prompt
  const prompt = `You are a UI action planner for an ERP web application. The user is on the "${page_label}" page.

Page context: ${(page_context || "").slice(0, 600)}

User request: ${message}

Decide which UI actions (if any) to execute immediately. Only call functions directly relevant to the request. Infer reasonable form values from the user's message. If the user is just asking a question, do not call any functions.`;

  try {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    const chatUrl = process.env.GEMINI_CHAT_COMPLETIONS_URL;
    const model = process.env.GEMINI_CHAT_MODEL || "google/gemini-3-flash-preview";

    if (!chatUrl || !apiKey) {
      // No Chat Completions endpoint configured — return empty
      return NextResponse.json({ function_calls: [] });
    }

    // Convert actions to OpenAI tools format (Chat Completions uses OpenAI format)
    const tools = adapter.toToolSpec(actions);

    // Build request payload
    const payload: Record<string, any> = {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.1,
    };

    // Add tools in the correct format for the provider
    if (provider === "gemini") {
      // For Gemini Chat Completions, we need OpenAI-style tools
      // Re-convert from Gemini functionDeclarations to OpenAI format
      const openAITools = actions.map((a: any) => ({
        type: "function",
        function: {
          name: a.name,
          description: a.description,
          parameters: a.parameters || { type: "object", properties: {} },
        },
      }));
      payload.tools = openAITools;
    } else {
      payload.tools = tools;
    }

    // Call Chat Completions API
    const url = `${chatUrl}?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[api/ai/ui-plan] API error:", response.status, errText.slice(0, 200));
      return NextResponse.json({ function_calls: [] });
    }

    const data = await response.json();

    // Parse tool calls from response
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    const functionCalls = toolCalls.map((tc: any) => ({
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments || "{}"),
    }));

    return NextResponse.json({ function_calls: functionCalls });
  } catch (error: any) {
    console.error("[api/ai/ui-plan] Failed:", error?.message);
    return NextResponse.json({ function_calls: [] });
  }
}
