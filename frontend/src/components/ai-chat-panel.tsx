"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Sparkles, X, Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const quickActions = ["Summarize this page", "Create Record", "Export Data", "Help"];

const PERSONA_COLORS: Record<string, string> = {
  business: "bg-[#0ea5e9] text-white",
  analytics: "bg-[#8b5cf6] text-white",
  technical: "bg-[#f59e0b] text-white",
  finance: "bg-[#10b981] text-white",
};

export function AiChatPanel() {
  const {
    chatOpen,
    toggleChat,
    messages,
    isTyping,
    sendMessage,
    activePersona,
    setPersona,
    personas,
    currentPageLabel,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentPersona = personas.find((p) => p.id === activePersona);
  const activePersonaName = currentPersona?.nickname || "AI";
  const personaColor = PERSONA_COLORS[currentPersona?.category || "business"] || "bg-[#0ea5e9] text-white";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);

  const handleSend = () => {
    if (!input.trim() || !activePersona) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleQuickAction = (action: string) => {
    if (!activePersona) return;
    sendMessage(action);
  };

  if (!chatOpen) return null;

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-slate-200 dark:border-slate-700 bg-[#f1f5f9] dark:bg-slate-900">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#0ea5e9]" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Assistant</span>
          {currentPageLabel && (
            <span className="rounded-full bg-[#0ea5e9]/10 px-2 py-0.5 text-[10px] font-medium text-[#0ea5e9]">
              {currentPageLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setPersonaOpen(!personaOpen)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 px-2.5 py-1.5 text-xs transition-colors hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              <div className={`flex h-4 w-4 items-center justify-center rounded-full ${personaColor}`}>
                <Bot size={10} />
              </div>
              <span className="max-w-[80px] truncate font-medium text-slate-700 dark:text-slate-200">
                {activePersonaName}
              </span>
            </button>
            {personaOpen && (
              <>
                <div
                  className="fixed inset-0"
                  onClick={() => setPersonaOpen(false)}
                />
                <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 shadow-xl">
                  {personas.map((p) => {
                    const pColor = PERSONA_COLORS[p.category] || "bg-[#0ea5e9] text-white";
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPersona(p.id);
                          setPersonaOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${
                          activePersona === p.id ? "bg-[#0ea5e9]/5" : ""
                        }`}
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${pColor}`}>
                          <Bot size={12} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-semibold ${activePersona === p.id ? "text-[#0ea5e9]" : "text-slate-800 dark:text-slate-200"}`}>
                            {p.nickname}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">
                            {p.position}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            onClick={toggleChat}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                msg.sender === "user"
                  ? "bg-[#1e3a5f] text-white"
                  : msg.sender === "system"
                  ? "bg-red-500 text-white"
                  : personaColor
              }`}
            >
              {msg.sender === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                msg.sender === "user"
                  ? "rounded-2xl rounded-tr-sm bg-[#0ea5e9] text-white"
                  : msg.sender === "system"
                  ? "rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "rounded-2xl rounded-tl-sm border border-slate-100 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {msg.sender === "user" ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : msg.sender === "system" ? (
                msg.content
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:rounded-md prose-pre:p-2 prose-code:text-[#0ea5e9] prose-code:before:content-[''] prose-code:after:content-[''] prose-a:text-[#0ea5e9]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${personaColor}`}>
              <Bot size={14} />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2">
        {quickActions.map((action) => (
          <button
            key={action}
            onClick={() => handleQuickAction(action)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-[#0ea5e9] hover:text-white hover:border-[#0ea5e9] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-[#0ea5e9] dark:hover:border-[#0ea5e9]"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={activePersona ? `Ask ${activePersonaName}...` : "Loading..."}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
          <button
            onClick={handleSend}
            disabled={!activePersona}
            className="rounded-xl bg-[#0ea5e9] p-2.5 text-white transition-colors hover:bg-[#0284c7] disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
        {currentPersona && (
          <p className="mt-1.5 text-[10px] text-slate-400">
            {currentPersona.nickname} &middot; {currentPersona.position} &middot; {currentPersona.model}
          </p>
        )}
      </div>
    </aside>
  );
}
