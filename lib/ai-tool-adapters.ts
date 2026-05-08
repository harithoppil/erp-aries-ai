/**
 * Provider-agnostic AI tool adapters.
 *
 * Each ERP page registers UIAction definitions with typed JSON Schema.
 * These adapters convert the SAME canonical format into the envelope
 * each AI provider expects:
 *
 *   Gemini  →  { functionDeclarations: [...] }
 *   OpenAI  →  { tools: [{ type: "function", function: { ... } }] }
 *   Anthropic → { tools: [{ name, description, input_schema }] }
 *
 * The actual JSON Schema (properties, required, enum, type) is IDENTICAL
 * across all three. Only the wrapper/envelope differs.
 *
 * Response parsing also differs:
 *   Gemini  →  candidate.content.parts[].functionCall  (args = object)
 *   OpenAI  →  choices[].message.tool_calls[]           (arguments = JSON string)
 *   Anthropic → content[].type === "tool_use"            (input = object)
 */

import type { UIAction } from "@/store/useActionDispatcher";

// ── Canonical → Gemini ─────────────────────────────────────────────────────

/**
 * Convert UIAction[] to Gemini functionDeclarations format.
 * Gemini expects flat { name, description, parameters } with
 * parameters as a JSON Schema object.
 */
export function toGeminiToolSpec(actions: UIAction[]): Record<string, any> {
  return {
    functionDeclarations: actions.map((action) => {
      const decl: Record<string, any> = {
        name: action.name,
        description: action.description,
      };
      if (action.parameters) {
        // Gemini accepts standard JSON Schema directly
        decl.parameters = convertSchemaToGemini(action.parameters);
      }
      return decl;
    }),
  };
}

/**
 * Recursively convert JSON Schema to Gemini-compatible format.
 * Gemini is very close to standard JSON Schema but doesn't support
 * some advanced features (e.g., $ref, additionalProperties).
 * We strip anything Gemini doesn't need.
 */
function convertSchemaToGemini(schema: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {
    type: schema.type || "object",
  };

  if (schema.properties) {
    result.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      result.properties[key] = convertSchemaToGemini(val as Record<string, any>);
    }
  }

  if (schema.required && schema.required.length > 0) {
    result.required = schema.required;
  }

  if (schema.enum) {
    result.enum = schema.enum;
  }

  if (schema.description) {
    result.description = schema.description;
  }

  if (schema.type === "array" && schema.items) {
    result.items = convertSchemaToGemini(schema.items as Record<string, any>);
  }

  return result;
}

/**
 * Parse Gemini/Vertex AI response → FunctionCall[].
 * Handles: candidate.content.parts[].functionCall
 * Args are already parsed objects (not JSON strings).
 */
export function parseGeminiResponse(data: any): FunctionCallResult[] {
  const calls: FunctionCallResult[] = [];
  const candidates = data.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.functionCall) {
        calls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }
  }
  return calls;
}

// ── Canonical → OpenAI Chat Completions ────────────────────────────────────

/**
 * Convert UIAction[] to OpenAI tools format.
 * OpenAI wraps each function in { type: "function", function: { name, description, parameters } }
 */
export function toOpenAIToolSpec(actions: UIAction[]): Record<string, any>[] {
  return actions.map((action) => ({
    type: "function" as const,
    function: {
      name: action.name,
      description: action.description,
      parameters: action.parameters || { type: "object", properties: {} },
    },
  }));
}

/**
 * Parse OpenAI Chat Completions response → FunctionCallResult[].
 * OpenAI returns tool_calls[] where arguments is a JSON STRING (must parse).
 * Each call has a unique id that must be echoed in the tool_result response.
 */
export function parseOpenAIResponse(data: any): FunctionCallResult[] {
  const calls: FunctionCallResult[] = [];
  const choices = data.choices || [];
  for (const choice of choices) {
    const toolCalls = choice.message?.tool_calls || [];
    for (const tc of toolCalls) {
      let args: Record<string, any> = {};
      if (tc.function?.arguments) {
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (e) {
          console.warn(`[OpenAI Adapter] Failed to parse arguments for ${tc.function.name}:`, e);
        }
      }
      calls.push({
        name: tc.function.name,
        args,
        callId: tc.id, // Must be preserved for tool_result response
      });
    }
  }
  return calls;
}

// ── Canonical → Anthropic Messages ─────────────────────────────────────────

/**
 * Convert UIAction[] to Anthropic tools format.
 * Anthropic uses { name, description, input_schema } where input_schema
 * is the same JSON Schema as Gemini's parameters.
 */
export function toAnthropicToolSpec(actions: UIAction[]): Record<string, any>[] {
  return actions.map((action) => ({
    name: action.name,
    description: action.description,
    input_schema: action.parameters || { type: "object", properties: {} },
  }));
}

/**
 * Parse Anthropic Messages response → FunctionCallResult[].
 * Anthropic returns content blocks where type === "tool_use" and
 * input is already a parsed object (like Gemini, not a JSON string).
 * Each has a unique id for the tool_result response.
 */
export function parseAnthropicResponse(data: any): FunctionCallResult[] {
  const calls: FunctionCallResult[] = [];
  const contentBlocks = data.content || [];
  for (const block of contentBlocks) {
    if (block.type === "tool_use") {
      calls.push({
        name: block.name,
        args: block.input || {},
        callId: block.id, // Must be preserved for tool_result response
      });
    }
  }
  return calls;
}

// ── Shared Types ────────────────────────────────────────────────────────────

/** Result of parsing a function/tool call from any provider. */
export interface FunctionCallResult {
  name: string;
  args: Record<string, any>;
  /** OpenAI and Anthropic assign unique IDs per call. Gemini does not. */
  callId?: string;
}

// ── Provider Registry ───────────────────────────────────────────────────────

export type AIProvider = "gemini" | "openai" | "anthropic";

export interface AIProviderAdapter {
  /** Convert canonical UIAction[] to provider-specific tool spec */
  toToolSpec: (actions: UIAction[]) => any;
  /** Parse provider response → FunctionCallResult[] */
  parseResponse: (data: any) => FunctionCallResult[];
}

const ADAPTERS: Record<AIProvider, AIProviderAdapter> = {
  gemini: {
    toToolSpec: toGeminiToolSpec,
    parseResponse: parseGeminiResponse,
  },
  openai: {
    toToolSpec: toOpenAIToolSpec,
    parseResponse: parseOpenAIResponse,
  },
  anthropic: {
    toToolSpec: toAnthropicToolSpec,
    parseResponse: parseAnthropicResponse,
  },
};

/**
 * Get the adapter for a given AI provider.
 * Default is Gemini (the current fast-track provider).
 */
export function getAdapter(provider: AIProvider = "gemini"): AIProviderAdapter {
  return ADAPTERS[provider];
}

// ── Tool Result Formatting ──────────────────────────────────────────────────

/**
 * Format a tool result for sending back to the AI provider.
 * Each provider has a different envelope for tool results.
 */

/** OpenAI tool result format */
export function formatOpenAIToolResult(callId: string, content: string): Record<string, any> {
  return {
    role: "tool",
    tool_call_id: callId,
    content,
  };
}

/** Anthropic tool result format */
export function formatAnthropicToolResult(
  toolUseId: string,
  content: string,
  isError: boolean = false
): Record<string, any> {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content,
    is_error: isError,
  };
}

/** Gemini function response format */
export function formatGeminiFunctionResponse(name: string, content: string): Record<string, any> {
  return {
    functionResponse: {
      name,
      response: { content },
    },
  };
}
