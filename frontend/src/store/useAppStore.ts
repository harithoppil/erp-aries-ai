"use client";

import { create } from "zustand";
import { useActionDispatcher, parseActionMarkers } from "./useActionDispatcher";
import { planUIActions, executeFunctionCalls, type FunctionCall } from "@/lib/gemini-client";

export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "system";
  content: string;
  timestamp: string;
}

export interface Persona {
  id: string;
  nickname: string;
  position: string;
  model: string;
  greeting: string | null;
  category: string;
}

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Chat panel
  chatOpen: boolean;
  toggleChat: () => void;
  messages: ChatMessage[];
  isTyping: boolean;
  activePersona: string;
  sendMessage: (content: string, pageContext?: string) => void;
  setPersona: (id: string) => void;
  personas: Persona[];
  loadPersonas: () => Promise<void>;
  personasLoaded: boolean;

  // Page context
  currentPageLabel: string;
  currentPageData: string;
  setPageContext: (label: string, dataSummary: string) => void;

  // UI Action execution state (for visual feedback)
  uiActionActive: boolean;
  lastUiActions: FunctionCall[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export const useAppStore = create<AppState>((set, get) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  chatOpen: false,
  messages: [
    {
      id: "welcome",
      sender: "ai",
      content: "Welcome to Aries ERP. I can see what page you're on and help you with any module. Try asking me anything!",
      timestamp: new Date().toISOString(),
    },
  ],
  isTyping: false,
  activePersona: "",
  personas: [],
  personasLoaded: false,

  loadPersonas: async () => {
    if (get().personasLoaded) return;
    try {
      const res = await fetch(`${API_BASE}/ai/personas`);
      if (!res.ok) return;
      const data: Persona[] = await res.json();
      const enabled = data.filter((p: any) => p.enabled);
      set({
        personas: enabled,
        activePersona: enabled[0]?.id || "",
        personasLoaded: true,
      });
      if (enabled[0]?.greeting) {
        set({
          messages: [
            {
              id: "greeting",
              sender: "ai",
              content: enabled[0].greeting,
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }
    } catch {
      // Silently fail — chat will show error on send
    }
  },

  setPersona: (id) => {
    const persona = get().personas.find((p) => p.id === id);
    set({
      activePersona: id,
      messages: persona?.greeting
        ? [
            {
              id: "greeting-" + id,
              sender: "ai",
              content: persona.greeting,
              timestamp: new Date().toISOString(),
            },
          ]
        : [],
    });
  },

  currentPageLabel: "",
  currentPageData: "",
  setPageContext: (label, dataSummary) =>
    set({ currentPageLabel: label, currentPageData: dataSummary }),

  // UI Action state
  uiActionActive: false,
  lastUiActions: [],

  sendMessage: async (content, pageContext) => {
    const state = get();
    if (!state.activePersona) {
      await state.loadPersonas();
    }

    // If still no persona after loading, show error and bail
    const personaId = get().activePersona;
    if (!personaId) {
      const errMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "system",
        content: "AI personas couldn't be loaded. Is the backend running?",
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errMsg], isTyping: false }));
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], isTyping: true }));

    const context = pageContext || state.currentPageData;
    const pageLabel = state.currentPageLabel;
    const contextPrefix = context
      ? `[Context: User is on the "${pageLabel}" page. Visible data summary: ${context.slice(0, 800)}]`
      : "";
    // Inject available UI actions into the prompt (still used by slow track)
    const actionDescriptions = useActionDispatcher.getState().getActionDescriptions();
    const fullMessage = contextPrefix + actionDescriptions + "\n\n" + content;

    // ═══════════════════════════════════════════════════════════════
    // DUAL-TRACK ARCHITECTURE
    // ═══════════════════════════════════════════════════════════════
    // Track 1 (Fast): UI Action Planning via Gemini function calling
    // Track 2 (Slow): Full reasoning via backend AgentLoop
    // Both fire in parallel. UI actions execute immediately.
    // ═══════════════════════════════════════════════════════════════

    const dispatcher = useActionDispatcher.getState();
    const registeredActions = dispatcher.actions;
    const handlers = dispatcher.handlers;

    // Track 1: Plan UI actions (only if we have registered actions on this page)
    // Defaults to direct mode with ephemeral tokens (fastest). Falls back to
    // backend proxy if service account isn't configured or token fails.
    const uiPlanPromise =
      registeredActions.length > 0
        ? planUIActions({
            message: content,
            pageContext: context,
            pageLabel,
            actions: registeredActions,
            direct: true, // Use ephemeral token → direct Vertex AI call
          })
        : Promise.resolve([] as FunctionCall[]);

    // Track 2: Normal chat (reasoning + text response)
    const chatPromise = fetch(`${API_BASE}/ai/chat/${personaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fullMessage, channel: "web" }),
    });

    try {
      // Wait for UI plan (fast) and execute actions immediately
      const functionCalls = await uiPlanPromise;
      if (functionCalls.length > 0) {
        set({ uiActionActive: true, lastUiActions: functionCalls });
        await executeFunctionCalls(functionCalls, handlers, {
          staggerMs: 200, // 200ms between each action for visual effect
          onExecute: (call) => {
            console.log(`[UI Action] Executed: ${call.name}`, call.args);
          },
        });
        set({ uiActionActive: false });
      }
    } catch (e) {
      console.warn("[UI Plan] Track 1 failed:", e);
      // Non-fatal — Track 2 still runs
    }

    // Wait for chat response (slow track)
    try {
      const res = await chatPromise;
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Chat failed: ${res.status}`);
      }
      const data = await res.json();

      // Parse and execute any UI action markers in the response (fallback)
      const rawContent = data.content || "I received your message but couldn't generate a response.";
      const { cleanText, actions } = parseActionMarkers(rawContent);

      // Execute any fallback action markers from slow track
      for (const action of actions) {
        dispatcher.executeAction(action.name, action.args);
      }

      const aiMsg: ChatMessage = {
        id: data.message_id || (Date.now() + 1).toString(),
        sender: "ai",
        content: cleanText,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, aiMsg], isTyping: false }));
    } catch (e) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "system",
        content: `Failed to reach AI: ${(e as Error).message}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errMsg], isTyping: false }));
    }
  },

  toggleChat: () => {
    const willOpen = !get().chatOpen;
    set({ chatOpen: willOpen });
    if (willOpen && !get().personasLoaded) {
      get().loadPersonas();
    }
  },
}));
