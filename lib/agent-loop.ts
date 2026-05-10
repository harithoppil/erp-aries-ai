/**
 * Unified AgentLoop — calls Gemini Chat Completions API, loops on tool calls.
 *
 * Replaces backend/app/services/agent_loop.py.
 * Uses the OpenAI-compatible Chat Completions endpoint on Vertex AI:
 *   https://aiplatform.googleapis.com/v1beta1/projects/.../endpoints/openapi/chat/completions
 *
 * Auth: GOOGLE_CLOUD_API_KEY as ?key= query param (simplest, confirmed working).
 *        Also supports OAuth Bearer token via GCA_KEY service account.
 *
 * The loop:
 *   while rounds < MAX:
 *     call Chat Completions API with tools + conversation history
 *     if response has tool_calls → execute via mcp-gateway → append tool results → continue
 *     if response has text content → stream/return final text → done
 *
 * Usage:
 *   const loop = new AgentLoop({ persona, gateway });
 *   const result = await loop.run({ userMessage: "Create a customer named Acme" });
 *   // result = { content: "...", toolCalls: [...], rounds: 3 }
 *
 * Streaming:
 *   const stream = loop.runStream({ userMessage: "..." });
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
  /** Override the Chat Completions URL (default: from env GEMINI_CHAT_COMPLETIONS_URL) */
  chatUrl?: string;
  /** Override model name (default: persona.model or GEMINI_CHAT_MODEL) */
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

// ── AgentLoop class ──────────────────────────────────────────────────────────

export class AgentLoop {
  private persona: AgentLoopPersona;
  private gateway: MCPGateway;
  private maxRounds: number;
  private chatUrl: string;
  private defaultModel: string;

  constructor(options: AgentLoopOptions) {
    this.persona = options.persona;
    this.gateway = options.gateway || getMCPGateway();
    this.maxRounds = options.maxRounds || 10;
    this.chatUrl = options.chatUrl ||
      process.env.GEMINI_CHAT_COMPLETIONS_URL ||
      "https://aiplatform.googleapis.com/v1beta1/projects/project-9a3e09d5-57ca-491d-a74/locations/us-central1/endpoints/openapi/chat/completions";
    this.defaultModel = options.model ||
      process.env.GEMINI_CHAT_MODEL ||
      "google/gemini-3-flash-preview";
  }

  /**
   * Run the agent loop and return the final result (non-streaming).
   * Good for Server Actions where we wait for the full response.
   */
  async run(userMessage: string, history?: ChatMessage[]): Promise<AgentLoopResult> {
    const model = this.persona.model || this.defaultModel;
    const tools = this.buildTools();
    const messages = this.buildMessages(userMessage, history);
    const allToolCalls: ToolCallRecord[] = [];
    let rounds = 0;

    while (rounds < this.maxRounds) {
      rounds++;

      const response = await this.callChatCompletions(messages, tools, model, false);
      const choice = response.choices?.[0];
      if (!choice) break;

      const msg = choice.message;
      const toolCalls = msg?.tool_calls || [];

      // If no tool calls, we have the final text answer
      if (toolCalls.length === 0) {
        return {
          content: msg?.content || "",
          toolCalls: allToolCalls,
          rounds,
          model,
        };
      }

      // Add assistant message with tool calls to conversation
      messages.push(msg as ChatMessage);

      // Execute each tool call and feed results back
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

        // Execute tool
        let result: string;
        try {
          result = await this.gateway.callTool(toolName, toolArgs);
          // Truncate large results (same as Python AgentLoop)
          if (result.length > 10000) {
            result = result.slice(0, 10000) + "\n... (truncated)";
          }
        } catch (e) {
          result = `Error executing ${toolName}: ${errorMessage(e)}`;
        }

        allToolCalls.push({ name: toolName, args: toolArgs, result, callId });

        // Feed result back as "tool" role message
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

  /**
   * Run the agent loop with streaming events.
   * Yields tool_call, tool_result, text_delta, and done events.
   * Use this for SSE API routes.
   */
  async *runStream(userMessage: string, history?: ChatMessage[]): AsyncGenerator<AgentLoopEvent> {
    const model = this.persona.model || this.defaultModel;
    const tools = this.buildTools();
    const messages = this.buildMessages(userMessage, history);
    const allToolCalls: ToolCallRecord[] = [];
    let rounds = 0;

    while (rounds < this.maxRounds) {
      rounds++;

      // Use streaming API call
      const stream = this.callChatCompletionsStream(messages, tools, model);
      let assistantContent = "";
      let toolCallsBuffer: ChatToolCall[] = [];
      let currentText = "";

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        // Handle text deltas
        if (delta?.content) {
          currentText += delta.content;
          yield { type: "text_delta", content: delta.content };
        }

        // Handle tool call deltas (accumulate)
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
              // Append arguments delta
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

        // If finish_reason is "tool_calls", we're done with this round
        if (choice.finish_reason === "tool_calls") {
          break;
        }

        // If finish_reason is "stop", we have the final text
        if (choice.finish_reason === "stop") {
          assistantContent = currentText;
        }
      }

      // If we got text and no tool calls, we're done
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

      // If no tool calls and no text, we're done
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

      // Add assistant message with complete tool calls to conversation
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: currentText || null,
        tool_calls: toolCallsBuffer,
      };
      messages.push(assistantMsg);

      // Execute each tool call
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

        // Execute tool
        let result: string;
        try {
          result = await this.gateway.callTool(toolName, toolArgs);
          if (result.length > 10000) {
            result = result.slice(0, 10000) + "\n... (truncated)";
          }
        } catch (e) {
          result = `Error executing ${toolName}: ${errorMessage(e)}`;
        }

        allToolCalls.push({ name: toolName, args: toolArgs, result, callId });
        yield { type: "tool_result", name: toolName, result, callId };

        // Feed result back
        messages.push({
          role: "tool",
          tool_call_id: callId,
          content: result,
        });
      }
    }

    // Max rounds reached
    const result: AgentLoopResult = {
      content: "Maximum tool rounds reached. Please try rephrasing your request.",
      toolCalls: allToolCalls,
      rounds,
      model,
    };
    yield { type: "done", result };
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Build the system prompt from persona configuration.
   */
  private buildSystemPrompt(): string {
    const parts: string[] = [];

    if (this.persona.about) {
      parts.push(this.persona.about);
    }

    if (this.persona.knowledge_base_prompt && this.persona.enable_knowledge_base) {
      parts.push(`\nKnowledge base context:\n${this.persona.knowledge_base_prompt}`);
    }

    // Add available tools info
    const tools = this.buildTools();
    if (tools.length > 0) {
      const toolNames = tools.map(t => t.function.name).join(", ");
      parts.push(`\nYou have access to the following tools: ${toolNames}. Use them when appropriate to fulfill the user's request.`);
    }

    return parts.join("\n\n") || "You are a helpful AI assistant for an ERP system.";
  }

  /**
   * Build the messages array for the Chat Completions API.
   */
  private buildMessages(userMessage: string, history?: ChatMessage[]): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System prompt
    messages.push({
      role: "system",
      content: this.buildSystemPrompt(),
    });

    // Conversation history (limit to last 20 messages like Python AgentLoop)
    if (history && history.length > 0) {
      const recent = history.slice(-20);
      for (const msg of recent) {
        // Skip system messages from history (we already have our own)
        if (msg.role === "system") continue;
        messages.push(msg);
      }
    }

    // Current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    return messages;
  }

  /**
   * Build Chat Completions tools array from persona's allowed tools.
   */
  private buildTools(): ChatCompletionTool[] {
    const allowedTools = this.persona.allowed_tools;
    if (!allowedTools || allowedTools.length === 0) return [];

    const mcpTools = this.gateway.getPersonaTools(allowedTools);
    return mcpTools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.mcpToolToSchema(tool),
      },
    }));
  }

  /**
   * Convert MCPTool.parameters to JSON Schema for Chat Completions.
   */
  private mcpToolToSchema(tool: MCPTool): Record<string, unknown> {
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

  /**
   * Call the Chat Completions API (non-streaming).
   */
  private async callChatCompletions(
    messages: ChatMessage[],
    tools: ChatCompletionTool[],
    model: string,
    stream: boolean = false
  ): Promise<ChatCompletionResponse> {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    const url = apiKey
      ? `${this.chatUrl}?key=${apiKey}`
      : this.chatUrl;

    // Build headers — use API key if available, otherwise OAuth token
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!apiKey) {
      const tokenResult = await getGeminiToken();
      if (tokenResult.success) {
        headers["Authorization"] = `Bearer ${tokenResult.token}`;
      }
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 8192,
      temperature: this.persona.temperature ?? 0.7,
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

  /**
   * Call the Chat Completions API (streaming) — yields SSE chunks.
   */
  private async *callChatCompletionsStream(
    messages: ChatMessage[],
    tools: ChatCompletionTool[],
    model: string
  ): AsyncGenerator<StreamChunk> {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    const url = apiKey
      ? `${this.chatUrl}?key=${apiKey}`
      : this.chatUrl;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!apiKey) {
      const tokenResult = await getGeminiToken();
      if (tokenResult.success) {
        headers["Authorization"] = `Bearer ${tokenResult.token}`;
      }
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 8192,
      temperature: this.persona.temperature ?? 0.7,
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

    // Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

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
}
