/**
 * Unified AgentLoop — calls Chat Completions API, loops on tool calls.
 *
 * Replaces backend/app/services/agent_loop.py.
 * Uses the OpenAI-compatible Chat Completions endpoint:
 *   Gemini: https://aiplatform.googleapis.com/v1beta1/projects/.../endpoints/openapi/chat/completions
 *   Azure:  https://xxx.services.ai.azure.com/openai/v1/chat/completions
 *
 * Auth: Azure uses api-key header; Gemini uses ?key= query param or OAuth Bearer.
 *
 * The loop:
 *   while rounds < MAX:
 *     call Chat Completions API with tools + conversation history
 *     if response has tool_calls -> execute via mcp-gateway -> append tool results -> continue
 *     if response has text content -> stream/return final text -> done
 *
 * Usage:
 *   const loop = createAgentLoop({ persona, gateway });
 *   const result = await loop.run("Create a customer named Acme");
 *
 * Streaming:
 *   const stream = loop.runStream("...");
 *   for await (const event of stream) {
 *     // event.type = "tool_call" | "tool_result" | "text_delta" | "done"
 *   }
 */

import { MCPGateway, getMCPGateway, type MCPTool } from "@/lib/mcp-gateway";
import { getGeminiToken } from "@/app/dashboard/ai/actions";
import { errorMessage } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentLoopPersona {
  id: string;
  nickname: string;
  about?: string;
  greeting?: string;
  model?: string;
  temperature?: number;
  allowed_tools?: string[] | null;
  allowed_mcp_servers?: string[] | null;
  knowledge_base_prompt?: string | null;
  enable_knowledge_base?: boolean;
}

export interface AgentLoopOptions {
  persona: AgentLoopPersona;
  gateway?: MCPGateway;
  maxRounds?: number;
  chatUrl?: string;
  model?: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  callId: string;
}

export interface AgentLoopResult {
  content: string;
  toolCalls: ToolCallRecord[];
  rounds: number;
  model: string;
}

export type AgentLoopEvent =
  | { type: "tool_call"; name: string; args: Record<string, unknown>; callId: string }
  | { type: "tool_result"; name: string; result: string; callId: string }
  | { type: "text_delta"; content: string }
  | { type: "done"; result: AgentLoopResult }
  | { type: "error"; error: string };

// ── Chat Completions message types ───────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ── API response types (for Chat Completions non-streaming) ────────────────

interface ChatCompletionChoice {
  index?: number;
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: ChatToolCall[];
  };
  finish_reason?: string;
}

interface ChatCompletionResponse {
  id?: string;
  choices?: ChatCompletionChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// ── Streaming delta types ───────────────────────────────────────────────────

interface StreamDeltaToolCall {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface StreamDelta {
  role?: string;
  content?: string;
  tool_calls?: StreamDeltaToolCall[];
}

interface StreamChoice {
  index?: number;
  delta?: StreamDelta;
  finish_reason?: string | null;
}

interface StreamChunk {
  id?: string;
  choices?: StreamChoice[];
}

interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ── AgentLoop factory ──────────────────────────────────────────────────────

export function createAgentLoop(options: AgentLoopOptions) {
  const persona = options.persona;
  const gateway = options.gateway || getMCPGateway();
  const maxRounds = options.maxRounds || 10;

  // Prefer Azure DeepSeek when available, fall back to Gemini
  const azureUrl = process.env.AZURE_CHAT_COMPLETIONS_URL;
  const azureKey = process.env.AZURE_API_KEY;
  const useAzure = !!(azureUrl && azureKey);

  const chatUrl = options.chatUrl ||
    (useAzure ? azureUrl : process.env.GEMINI_CHAT_COMPLETIONS_URL) ||
    "https://aiplatform.googleapis.com/v1beta1/projects/project-9a3e09d5-57ca-491d-a74/locations/us-central1/endpoints/openapi/chat/completions";

  const defaultModel = options.model ||
    (useAzure ? (process.env.AZURE_CHAT_MODEL || "DeepSeek-V4-Flash") : process.env.GEMINI_CHAT_MODEL) ||
    "google/gemini-3-flash-preview";

  // ── Internal helpers ───────────────────────────────────────────────────────

  function buildSystemPrompt(): string {
    const parts: string[] = [];

    if (persona.about) {
      parts.push(persona.about);
    }

    if (persona.knowledge_base_prompt && persona.enable_knowledge_base) {
      parts.push(`\nKnowledge base context:\n${persona.knowledge_base_prompt}`);
    }

    const tools = buildTools();
    if (tools.length > 0) {
      const toolNames = tools.map(t => t.function.name).join(", ");
      parts.push(`\nYou have access to the following tools: ${toolNames}. Use them when appropriate to fulfill the user's request.`);
    }

    return parts.join("\n\n") || "You are a helpful AI assistant for an ERP system.";
  }

  function buildMessages(userMessage: string, history?: ChatMessage[]): ChatMessage[] {
    const messages: ChatMessage[] = [];

    messages.push({
      role: "system",
      content: buildSystemPrompt(),
    });

    if (history && history.length > 0) {
      const recent = history.slice(-20);
      for (const msg of recent) {
        if (msg.role === "system") continue;
        messages.push(msg);
      }
    }

    messages.push({
      role: "user",
      content: userMessage,
    });

    return messages;
  }

  function buildTools(): ChatCompletionTool[] {
    const allowedTools = persona.allowed_tools;
    if (!allowedTools || allowedTools.length === 0) return [];

    const mcpTools = gateway.getPersonaTools(allowedTools);
    return mcpTools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: mcpToolToSchema(tool),
      },
    }));
  }

  function mcpToolToSchema(tool: MCPTool): Record<string, unknown> {
    if (!tool.parameters) {
      return { type: "object", properties: {} };
    }

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, param] of Object.entries(tool.parameters)) {
      properties[key] = {
        type: param.type,
        description: param.description,
        ...(param.enum ? { enum: param.enum } : {}),
      };
      if (param.required) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  async function callChatCompletions(
    messages: ChatMessage[],
    tools: ChatCompletionTool[],
    model: string,
    stream: boolean = false
  ): Promise<ChatCompletionResponse> {
    const geminiKey = process.env.GOOGLE_CLOUD_API_KEY;

    const url = useAzure
      ? chatUrl
      : (geminiKey ? `${chatUrl}?key=${geminiKey}` : chatUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (useAzure) {
      headers["api-key"] = azureKey!;
    } else if (!geminiKey) {
      const tokenResult = await getGeminiToken();
      if (tokenResult.success) {
        headers["Authorization"] = `Bearer ${tokenResult.token}`;
      }
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 8192,
      temperature: persona.temperature ?? 0.7,
      stream,
    };

    if (tools.length > 0) {
      payload.tools = tools;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Chat Completions API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    return response.json();
  }

  async function* callChatCompletionsStream(
    messages: ChatMessage[],
    tools: ChatCompletionTool[],
    model: string
  ): AsyncGenerator<StreamChunk> {
    const geminiKey = process.env.GOOGLE_CLOUD_API_KEY;

    const url = useAzure
      ? chatUrl
      : (geminiKey ? `${chatUrl}?key=${geminiKey}` : chatUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (useAzure) {
      headers["api-key"] = azureKey!;
    } else if (!geminiKey) {
      const tokenResult = await getGeminiToken();
      if (tokenResult.success) {
        headers["Authorization"] = `Bearer ${tokenResult.token}`;
      }
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 8192,
      temperature: persona.temperature ?? 0.7,
      stream: true,
    };

    if (tools.length > 0) {
      payload.tools = tools;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Chat Completions API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
          try {
            const data = JSON.parse(trimmed.slice(6));
            yield data;
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function run(userMessage: string, history?: ChatMessage[]): Promise<AgentLoopResult> {
    const model = persona.model || defaultModel;
    const tools = buildTools();
    const messages = buildMessages(userMessage, history);
    const allToolCalls: ToolCallRecord[] = [];
    let rounds = 0;

    while (rounds < maxRounds) {
      rounds++;

      const response = await callChatCompletions(messages, tools, model, false);
      const choice = response.choices?.[0];
      if (!choice) break;

      const msg = choice.message;
      const toolCalls = msg?.tool_calls || [];

      if (toolCalls.length === 0) {
        return {
          content: msg?.content || "",
          toolCalls: allToolCalls,
          rounds,
          model,
        };
      }

      messages.push(msg as ChatMessage);

      for (const tc of toolCalls) {
        const fn = tc.function;
        const toolName = fn.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(fn.arguments);
        } catch {
          toolArgs = {};
        }
        const callId = tc.id;

        let result: string;
        try {
          result = await gateway.callTool(toolName, toolArgs);
          if (result.length > 10000) {
            result = result.slice(0, 10000) + "\n... (truncated)";
          }
        } catch (e) {
          result = `Error executing ${toolName}: ${errorMessage(e)}`;
        }

        allToolCalls.push({ name: toolName, args: toolArgs, result, callId });

        messages.push({
          role: "tool",
          tool_call_id: callId,
          content: result,
        });
      }
    }

    return {
      content: "Maximum tool rounds reached. Please try rephrasing your request.",
      toolCalls: allToolCalls,
      rounds,
      model,
    };
  }

  async function* runStream(userMessage: string, history?: ChatMessage[]): AsyncGenerator<AgentLoopEvent> {
    const model = persona.model || defaultModel;
    const tools = buildTools();
    const messages = buildMessages(userMessage, history);
    const allToolCalls: ToolCallRecord[] = [];
    let rounds = 0;

    while (rounds < maxRounds) {
      rounds++;

      const stream = callChatCompletionsStream(messages, tools, model);
      let assistantContent = "";
      let toolCallsBuffer: ChatToolCall[] = [];
      let currentText = "";

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta?.content) {
          currentText += delta.content;
          yield { type: "text_delta", content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const idx = tcDelta.index || 0;
            if (!toolCallsBuffer[idx]) {
              toolCallsBuffer[idx] = {
                id: tcDelta.id || "",
                type: "function",
                function: { name: tcDelta.function?.name || "", arguments: tcDelta.function?.arguments || "" },
              };
            } else {
              if (tcDelta.function?.arguments) {
                toolCallsBuffer[idx].function.arguments += tcDelta.function.arguments;
              }
              if (tcDelta.id) {
                toolCallsBuffer[idx].id = tcDelta.id;
              }
              if (tcDelta.function?.name) {
                toolCallsBuffer[idx].function.name = tcDelta.function.name;
              }
            }
          }
        }

        if (choice.finish_reason === "tool_calls") {
          break;
        }

        if (choice.finish_reason === "stop") {
          assistantContent = currentText;
        }
      }

      if (toolCallsBuffer.length === 0 && assistantContent) {
        const result: AgentLoopResult = {
          content: assistantContent,
          toolCalls: allToolCalls,
          rounds,
          model,
        };
        yield { type: "done", result };
        return;
      }

      if (toolCallsBuffer.length === 0) {
        const result: AgentLoopResult = {
          content: currentText || "No response generated.",
          toolCalls: allToolCalls,
          rounds,
          model,
        };
        yield { type: "done", result };
        return;
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: currentText || null,
        tool_calls: toolCallsBuffer,
      };
      messages.push(assistantMsg);

      for (const tc of toolCallsBuffer) {
        const fn = tc.function;
        const toolName = fn.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(fn.arguments);
        } catch {
          toolArgs = {};
        }
        const callId = tc.id;

        yield { type: "tool_call", name: toolName, args: toolArgs, callId };

        let result: string;
        try {
          result = await gateway.callTool(toolName, toolArgs);
          if (result.length > 10000) {
            result = result.slice(0, 10000) + "\n... (truncated)";
          }
        } catch (e) {
          result = `Error executing ${toolName}: ${errorMessage(e)}`;
        }

        allToolCalls.push({ name: toolName, args: toolArgs, result, callId });
        yield { type: "tool_result", name: toolName, result, callId };

        messages.push({
          role: "tool",
          tool_call_id: callId,
          content: result,
        });
      }
    }

    const result: AgentLoopResult = {
      content: "Maximum tool rounds reached. Please try rephrasing your request.",
      toolCalls: allToolCalls,
      rounds,
      model,
    };
    yield { type: "done", result };
  }

  return { run, runStream };
}

// Backward compat alias
export const AgentLoop = createAgentLoop;
