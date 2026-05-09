"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Bot, User, Sparkles, Copy, Check, Anchor,
  Volume2, ImageIcon, Loader2, ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/use-responsive";
import { listPersonas, chatWithPersona, type ClientSafePersona } from "@/app/dashboard/ai/actions";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  model?: string;
  streaming?: boolean;
}

/* ═══════════════════════════════════════════════════════════
 * Persona avatar colors — nautical chart palette
 * ═══════════════════════════════════════════════════════════ */
const PERSONA_COLORS: Record<string, string> = {
  Dex: "bg-sonar/20 text-sonar border-sonar/30",
  Viz: "bg-amber/20 text-amber border-amber/30",
  Avery: "bg-navy/30 text-foreground border-navy/30",
};
const PERSONA_INITIALS: Record<string, string> = {
  Dex: "DX",
  Viz: "VZ",
  Avery: "AV",
};

export default function AIChatPage() {
  const { isMobile } = useResponsive();
  const [personas, setPersonas] = useState<ClientSafePersona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load personas on mount
  useEffect(() => {
    const load = async () => {
      try {
        const result = await listPersonas({ enabled: true });
        if (result.success) {
          setPersonas(result.personas);
          if (result.personas.length > 0) {
            setSelectedPersona(result.personas[0].id);
          }
        } else {
          toast.error(result.error);
        }
      } catch (error: any) {
        console.error("Failed to load personas:", error);
        toast.error(error.message || "Failed to load AI personas");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load greeting when persona changes
  useEffect(() => {
    if (!selectedPersona) return;
    const persona = personas.find((p) => p.id === selectedPersona);
    if (persona?.greeting) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: persona.greeting,
          created_at: new Date().toISOString(),
          model: persona.model,
        },
      ]);
    } else {
      setMessages([]);
    }
  }, [selectedPersona, personas]);

  // Auto-scroll inside the message container only
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedPersona || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Create placeholder for streaming response
    const assistantId = `stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        streaming: true,
      },
    ]);

    try {
      const chatResult = await chatWithPersona(selectedPersona, userMsg.content);

      if (!chatResult.success) throw new Error(chatResult.error);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                id: chatResult.message_id || assistantId,
                content: chatResult.content,
                streaming: false,
                model: chatResult.model,
              }
            : msg
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `⚠️ Error: ${(error as Error).message}`,
                role: "system",
                streaming: false,
              }
            : msg
        )
      );
      toast.error("Chat request failed");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, selectedPersona, sending]);

  const handleCopy = useCallback(async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const currentPersona = personas.find((p) => p.id === selectedPersona);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="sonar-pulse flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Anchor className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            Initializing AI bridge...
          </span>
        </motion.div>
      </div>
    );
  }

  const personaColor = currentPersona
    ? PERSONA_COLORS[currentPersona.nickname] || "bg-primary/20 text-primary border-primary/30"
    : "";
  const personaInitials = currentPersona
    ? PERSONA_INITIALS[currentPersona.nickname] || currentPersona.nickname.slice(0, 2).toUpperCase()
    : "AI";

  return (
    <div
      className={
        isMobile
          ? "flex h-[calc(100vh-8rem)] flex-col overflow-hidden"
          : "mx-auto flex h-[calc(100vh-6rem)] max-w-4xl flex-col overflow-hidden"
      }
    >
      {/* ═══ Persona selector — glass header ═══ */}
      <div className="glass-card border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="sonar-pulse flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">AI Chat</h2>
              <p className="text-[10px] text-muted-foreground">Bridge Communications</p>
            </div>
          </div>
          {currentPersona && (
            <Badge variant="outline" className={`${personaColor} text-[10px]`}>
              {currentPersona.nickname} · {currentPersona.model}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {personas.map((p, i) => {
            const color = PERSONA_COLORS[p.nickname] || "bg-primary/20 text-primary border-primary/30";
            const initials = PERSONA_INITIALS[p.nickname] || p.nickname.slice(0, 2).toUpperCase();
            return (
              <motion.button
                key={p.id}
                onClick={() => setSelectedPersona(p.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                  selectedPersona === p.id
                    ? color
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-accent"
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                </Avatar>
                {p.nickname}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ═══ Messages area ═══ */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Assistant avatar */}
                {msg.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={`text-[10px] ${personaColor}`}>
                      {personaInitials}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Message bubble */}
                <div className="group relative max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.role === "system"
                        ? "bg-destructive/10 text-destructive rounded-bl-md border border-destructive/20"
                        : "glass-card rounded-bl-md"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-primary prose-code:before:content-[''] prose-code:after:content-['']">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Streaming indicator */}
                    {msg.streaming && (
                      <div className="mt-2 flex items-center gap-1">
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Copy button (assistant only) */}
                  {msg.role === "assistant" && !msg.streaming && msg.content && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="absolute -bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-accent group-hover:opacity-100"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Sending indicator */}
          {sending && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={`text-[10px] ${personaColor}`}>
                  {personaInitials}
                </AvatarFallback>
              </Avatar>
              <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing...
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* ═══ Input area — glass footer ═══ */}
      <div className="glass-card border-t px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentPersona ? `Ask ${currentPersona.nickname}...` : "Select a persona first"
              }
              disabled={!selectedPersona || sending}
              className="w-full rounded-xl border border-border bg-background/80 px-4 py-2.5 pr-10 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            {input && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">
                ↵
              </span>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || sending}
            className="rounded-xl px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">
            {currentPersona
              ? `${currentPersona.nickname} · ${currentPersona.position} · ${currentPersona.model}`
              : "Select a persona to start"}
          </p>
          {currentPersona?.allowed_tools && (
            <div className="flex gap-1">
              {currentPersona.allowed_tools.slice(0, 3).map((tool) => (
                <span
                  key={tool}
                  className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                >
                  {tool}
                </span>
              ))}
              {currentPersona.allowed_tools.length > 3 && (
                <span className="text-[9px] text-muted-foreground/50">
                  +{currentPersona.allowed_tools.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
