/**
 * SSE Streaming Chat API Route.
 *
 * Replaces Python backend /api/v1/ai/chat/{persona_id}.
 * Runs AgentLoop server-side and streams events to the browser via SSE.
 *
 * POST /api/ai/chat
 *   Body: { personaId, message, conversationId? }
 *   Response: text/event-stream
 *     event: tool_call    → { name, args, callId }
 *     event: tool_result  → { name, result, callId }
 *     event: text_delta   → { content }
 *     event: done         → { content, rounds, model }
 *     event: error        → { error }
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AgentLoop, type AgentLoopEvent } from "@/lib/agent-loop";
import { generateId } from "@/lib/uuid";

// Force dynamic — no SSG
export const dynamic = "force-dynamic";
// Allow up to 5 minutes for long agent loops
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { personaId, message, conversationId } = body;

  if (!personaId || !message) {
    return new Response(JSON.stringify({ error: "Missing personaId or message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load persona from Prisma
  const persona = await prisma.ai_personas.findUnique({
    where: { id: personaId },
  });

  if (!persona) {
    return new Response(JSON.stringify({ error: "Persona not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get or create conversation
  let conversation = conversationId
    ? await prisma.ai_conversations.findUnique({ where: { id: conversationId } })
    : null;

  if (!conversation) {
    conversation = await prisma.ai_conversations.create({
      data: {
        id: generateId(),
        persona_id: personaId,
        channel: "web",
        title: message.slice(0, 60),
      },
    });
  }

  // Save user message
  await prisma.ai_messages.create({
    data: {
      id: generateId(),
      conversation_id: conversation.id,
      role: "user",
      content: message,
    },
  });

  // Load conversation history (last 20 messages)
  const historyMessages = await prisma.ai_messages.findMany({
    where: { conversation_id: conversation.id },
    orderBy: { created_at: "asc" },
    take: 20,
  });

  // Build history in Chat Completions format
  const history = historyMessages
    .filter(m => m.role !== "system")
    .map(m => {
      const msg: Record<string, any> = { role: m.role, content: m.content };
      // Restore tool_calls if present
      if (m.tool_calls) {
        try {
          msg.tool_calls = typeof m.tool_calls === "string" ? JSON.parse(m.tool_calls) : m.tool_calls;
        } catch {}
      }
      if (m.tool_call_id) {
        msg.tool_call_id = m.tool_call_id;
      }
      return msg;
    });

  // Parse allowed tools
  let allowedTools: string[] | null = null;
  if (persona.allowed_tools) {
    try {
      allowedTools = typeof persona.allowed_tools === "string"
        ? JSON.parse(persona.allowed_tools)
        : persona.allowed_tools;
    } catch {
      allowedTools = null;
    }
  }

  // Create the AgentLoop
  const loop = new AgentLoop({
    persona: {
      id: persona.id,
      nickname: persona.nickname,
      about: persona.about || undefined,
      greeting: persona.greeting || undefined,
      model: persona.model || undefined,
      temperature: persona.temperature ?? undefined,
      allowed_tools: allowedTools,
      allowed_mcp_servers: persona.allowed_mcp_servers
        ? (typeof persona.allowed_mcp_servers === "string"
            ? JSON.parse(persona.allowed_mcp_servers)
            : persona.allowed_mcp_servers)
        : null,
      knowledge_base_prompt: persona.knowledge_base_prompt || null,
      enable_knowledge_base: persona.enable_knowledge_base,
    },
  });

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        for await (const event of loop.runStream(message, history as any)) {
          switch (event.type) {
            case "tool_call":
              sendEvent("tool_call", {
                name: event.name,
                args: event.args,
                callId: event.callId,
              });
              break;

            case "tool_result":
              sendEvent("tool_result", {
                name: event.name,
                result: event.result,
                callId: event.callId,
              });
              break;

            case "text_delta":
              sendEvent("text_delta", { content: event.content });
              break;

            case "done":
              sendEvent("done", {
                content: event.result.content,
                rounds: event.result.rounds,
                model: event.result.model,
                toolCalls: event.result.toolCalls.length,
                conversationId: conversation!.id,
              });

              // Save assistant message to Prisma
              await prisma.ai_messages.create({
                data: {
                  id: generateId(),
                  conversation_id: conversation!.id,
                  role: "assistant",
                  content: event.result.content,
                  // Save tool call metadata
                  tool_calls: event.result.toolCalls.length > 0
                    ? JSON.stringify(event.result.toolCalls.map(tc => ({
                        name: tc.name,
                        args: tc.args,
                        callId: tc.callId,
                      })))
                    : undefined,
                },
              });
              break;

            case "error":
              sendEvent("error", { error: event.error });
              break;
          }
        }
      } catch (error: any) {
        sendEvent("error", { error: error.message || "AgentLoop failed" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
