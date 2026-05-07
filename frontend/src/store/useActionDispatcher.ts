"use client";

import { create } from "zustand";

export interface UIAction {
  name: string;
  description: string;
  parameters?: Record<string, { type: string; description: string; enum?: string[] }>;
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

  // Get action descriptions for prompt injection
  getActionDescriptions: () => string;
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
      if (a.parameters && Object.keys(a.parameters).length > 0) {
        const params = Object.entries(a.parameters)
          .map(([key, p]) => `${key} (${p.type}${p.enum ? `: ${p.enum.join("/")}` : ""})`)
          .join(", ");
        desc += ` Parameters: ${params}.`;
      }
      return desc;
    });

    return `\n\n## Available UI Actions on this page:\n${lines.join("\n")}\n\nIf the user asks you to perform an action, respond with a special action marker in your message like [ACTION:name|param1=value1|param2=value2]. You can include multiple action markers. The UI will execute them automatically.`;
  },
}));

// Regex to parse action markers: [ACTION:name|key=value|key2=value2]
const ACTION_MARKER_REGEX = /\[ACTION:([^|\]]+)(?:\|([^\]]*))?\]/g;

/**
 * Parse action markers from LLM response text.
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
