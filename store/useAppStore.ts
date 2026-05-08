"use client";

import { create } from "zustand";
import { useActionDispatcher, parseActionMarkers } from "@/store/useActionDispatcher";
import { planUIActions, executeFunctionCalls, type FunctionCall } from "@/lib/gemini-client";
import { chatWithPersona } from "@/app/ai/actions";

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
  enabled?: boolean;
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
  personaError: string | null;

  // Page context
  currentPageLabel: string;
  currentPageData: string;
  setPageContext: (label: string, dataSummary: string) => void;

  // UI Action execution state (for visual feedback)
  uiActionActive: boolean;
  lastUiActions: FunctionCall[];
}

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
  personaError: null,

  loadPersonas: async () => {
    // Always retry if we have no personas — the loaded flag just prevents
    // redundant fetches when personas are already loaded successfully.
    if (get().personasLoaded && get().personas.length > 0) return;
    set({ personaError: null });
    try {
      // Use Server Action for persona CRUD — hits Prisma directly
      const { listPersonas } = await import("@/app/ai/actions");
      const result = await listPersonas({ enabled: true });
      if (result.success) {
        const enabled = result.personas.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          position: p.position,
          model: p.model,
          greeting: p.greeting,
          category: p.category,
          enabled: p.enabled,
        }));
        set({
          personas: enabled,
          activePersona: enabled[0]?.id || "",
          personasLoaded: true,
          personaError: null,
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
      } else {
        set({ personaError: result.error });
      }
    } catch (e: any) {
      console.error("[loadPersonas] Failed:", e?.message || e);
      set({ personaError: e?.message || "Network error" });
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
  setPageContext: (label, dataSummary) => {
    const prevLabel = get().currentPageLabel;
    set({ currentPageLabel: label, currentPageData: dataSummary });

    // Inject system message when user navigates to a different page
    // This tells the LLM the context shifted without resetting the conversation
    if (prevLabel && prevLabel !== label && get().messages.length > 1) {
      const navMsg: ChatMessage = {
        id: `page-change-${Date.now()}`,
        sender: "system",
        content: `[User navigated to "${label}" page. Available actions and context have changed.]`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, navMsg] }));
    }
  },

  // UI Action state
  uiActionActive: false,
  lastUiActions: [],

  sendMessage: async (content, pageContext) => {
    // Try to load personas if we don't have one yet
    if (!get().activePersona) {
      await get().loadPersonas();
    }

    // If still no persona after retry, show actionable error
    const personaId = get().activePersona;
    if (!personaId) {
      const errMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "system",
        content: "Can't reach the AI backend. Please check that the server is running on port 8001, then click Retry.",
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

    const context = pageContext || get().currentPageData;
    const pageLabel = get().currentPageLabel;
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

    // Track 2: Normal chat (reasoning + text response) — uses Server Action
    const chatPromise = chatWithPersona(personaId, fullMessage);

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
      const chatResult = await chatPromise;
      if (!chatResult.success) {
        throw new Error(chatResult.error);
      }

      // Parse and execute any UI action markers in the response (fallback)
      const rawContent = chatResult.content || "I received your message but couldn't generate a response.";
      const { cleanText, actions } = parseActionMarkers(rawContent);

      // Execute any fallback action markers from slow track
      for (const action of actions) {
        dispatcher.executeAction(action.name, action.args);
      }

      const aiMsg: ChatMessage = {
        id: chatResult.message_id || (Date.now() + 1).toString(),
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
    // Always try to load personas if we don't have any yet
    if (willOpen && get().personas.length === 0) {
      get().loadPersonas();
    }
  },
}));
