"use client";

import { create } from "zustand";

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
      // Set greeting from first persona
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

  sendMessage: async (content, pageContext) => {
    const state = get();
    if (!state.activePersona) {
      await state.loadPersonas();
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
      ? `[Context: User is on the "${pageLabel}" page. Visible data summary: ${context.slice(0, 800)}]\n\n`
      : "";
    const fullMessage = contextPrefix + content;
    const personaId = get().activePersona;

    try {
      const res = await fetch(`${API_BASE}/ai/chat/${personaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMessage, channel: "web" }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Chat failed: ${res.status}`);
      }
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: data.message_id || (Date.now() + 1).toString(),
        sender: "ai",
        content: data.content || "I received your message but couldn't generate a response.",
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
