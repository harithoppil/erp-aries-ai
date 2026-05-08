"use client";

import { create } from "zustand";

/**
 * JSON Schema property definition — mirrors what Gemini / OpenAI / Anthropic
 * all accept for function/tool parameter properties.
 */
export interface SchemaProperty {
  type: string;                          // "string" | "number" | "boolean" | "array" | "object"
  description?: string;
  enum?: string[];                       // Allowed values for string fields
  items?: SchemaProperty;               // For array type — item schema
  properties?: Record<string, SchemaProperty>;  // For object type — nested properties
  required?: string[];                   // For object type — required nested fields
}

/**
 * Canonical action definition — provider-agnostic.
 * Each adapter (Gemini, OpenAI, Anthropic) converts this to its own envelope.
 */
export interface UIAction {
  name: string;
  description: string;
  /** JSON Schema for the action's parameters. Top-level must be type: "object". */
  parameters?: {
    type: "object";
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
}

export interface UIActionHandler {
  name: string;
  handler: (args: Record<string, any>) => void;
}

interface ActionDispatcherState {
  // Registered actions for current page
  actions: UIAction[];
  handlers: Map<string, (args: Record<string, any>) => void>;

  // Register/unregister
  registerActions: (actions: UIAction[], handlers: Record<string, (args: Record<string, any>) => void>) => void;
  unregisterActions: () => void;

  // Execute an action by name
  executeAction: (name: string, args: Record<string, any>) => boolean;

  // Get action descriptions for prompt injection (slow track fallback)
  getActionDescriptions: () => string;

  // Get actions in canonical format (for adapter conversion)
  getCanonicalActions: () => UIAction[];
}

export const useActionDispatcher = create<ActionDispatcherState>((set, get) => ({
  actions: [],
  handlers: new Map(),

  registerActions: (actions, handlerMap) => {
    const handlers = new Map<string, (args: Record<string, any>) => void>();
    Object.entries(handlerMap).forEach(([name, handler]) => {
      handlers.set(name, handler);
    });
    set({ actions, handlers });
  },

  unregisterActions: () => {
    set({ actions: [], handlers: new Map() });
  },

  executeAction: (name, args) => {
    const handler = get().handlers.get(name);
    if (!handler) {
      console.warn(`[ActionDispatcher] No handler registered for action: ${name}`);
      return false;
    }
    try {
      handler(args);
      return true;
    } catch (e) {
      console.error(`[ActionDispatcher] Action ${name} failed:`, e);
      return false;
    }
  },

  getActionDescriptions: () => {
    const { actions } = get();
    if (actions.length === 0) return "";

    const lines = actions.map((a) => {
      let desc = `- ${a.name}: ${a.description}`;
      if (a.parameters) {
        const props = a.parameters.properties;
        const req = a.parameters.required || [];
        const params = Object.entries(props)
          .map(([key, p]) => {
            const reqMark = req.includes(key) ? "*" : "";
            const enumStr = p.enum ? `: ${p.enum.join("/")}` : "";
            return `${key}${reqMark} (${p.type}${enumStr})`;
          })
          .join(", ");
        desc += ` Parameters: ${params}.`;
      }
      return desc;
    });

    return `\n\n## Available UI Actions on this page:\n${lines.join("\n")}\n\nIf the user asks you to perform an action, respond with a special action marker in your message like [ACTION:name|param1=value1|param2=value2]. You can include multiple action markers. The UI will execute them automatically.`;
  },

  getCanonicalActions: () => get().actions,
}));

// Regex to parse action markers: [ACTION:name|key=value|key2=value2]
const ACTION_MARKER_REGEX = /\[ACTION:([^|\]]+)(?:\|([^\]]*))?\]/g;

/**
 * Parse action markers from LLM response text (slow track fallback).
 * Returns { cleanText: string without markers, actions: array of { name, args } }
 */
export function parseActionMarkers(text: string): {
  cleanText: string;
  actions: { name: string; args: Record<string, string> }[];
} {
  const actions: { name: string; args: Record<string, string> }[] = [];

  const cleanText = text.replace(ACTION_MARKER_REGEX, (match, name, paramStr) => {
    const args: Record<string, string> = {};
    if (paramStr) {
      paramStr.split("|").forEach((pair: string) => {
        const [key, value] = pair.split("=");
        if (key && value !== undefined) {
          args[key.trim()] = value.trim();
        }
      });
    }
    actions.push({ name: name.trim(), args });
    return ""; // Remove marker from displayed text
  });

  return { cleanText: cleanText.trim(), actions };
}

/**
 * Helper to define a typed action with full JSON Schema.
 * Usage:
 *   defineAction({
 *     name: "create_customer",
 *     description: "Open and fill the create customer form",
 *     parameters: {
 *       type: "object",
 *       required: ["customer_name", "customer_code"],
 *       properties: {
 *         customer_name: { type: "string", description: "Customer name" },
 *         customer_code: { type: "string", description: "Unique code" },
 *         industry: { type: "string", enum: ["oil_gas","marine","renewable","construction","other"] },
 *         credit_limit: { type: "number", description: "Credit limit in AED" },
 *       }
 *     }
 *   })
 */
export function defineAction(action: UIAction): UIAction {
  return action;
}
