"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Wrench, FileText, Ship, Package, Users, Calculator } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "tool_call" | "thinking" | "form";
  tool?: string;
}

const SUGGESTED_PROMPTS = [
  { text: "What is our monthly revenue and profit?", icon: Calculator },
  { text: "Show me vessel status and fleet utilization", icon: Ship },
  { text: "Create a PO for dive gear from TechnipFMC", icon: FileText },
  { text: "Which items are below minimum stock?", icon: Package },
  { text: "Show me employee attendance today", icon: Users },
  { text: "Generate a sales quotation for ADNOC Offshore", icon: FileText },
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput(""); setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", type: "thinking" }]);

    try {
      const eventSource = new EventSource(`http://localhost:8000/api/v1/ai/chat?query=${encodeURIComponent(text)}&company_id=demo`);
      let accumulated = "";

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "done") { eventSource.close(); setLoading(false); return; }
        if (data.type === "thinking") {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: data.content, type: "thinking" } : m));
        } else if (data.type === "tool_call") {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Using tool: ${data.tool}...`, type: "tool_call", tool: data.tool } : m));
        } else if (data.type === "result") {
          accumulated += data.content;
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: accumulated, type: "text" } : m));
        } else if (data.type === "form") {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: data.message, type: "form" } : m));
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, I encountered an error. Please try again.", type: "text" } : m));
        setLoading(false);
      };
    } catch (err) {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Connection error. Please check your network.", type: "text" } : m));
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-navy rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 bg-gold rounded-lg flex items-center justify-center">
          <Bot className="w-4 h-4 text-navy" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Aries AI Assistant</h1>
          <p className="text-[10px] text-white/50">Powered by Gemini 2.5 Pro + MCP</p>
        </div>
        {loading && <Loader2 className="w-4 h-4 text-gold animate-spin ml-auto" />}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">How can I help you today?</h2>
            <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">
              Ask me anything about sales, inventory, vessels, employees, or accounting. I can also create documents for you.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {SUGGESTED_PROMPTS.map((prompt, i) => {
                const Icon = prompt.icon;
                return (
                  <button key={i} onClick={() => sendMessage(prompt.text)}
                    className="flex items-center gap-2 p-3 bg-white/5 rounded-lg text-left hover:bg-white/10 transition-colors text-white/80 text-xs">
                    <Icon className="w-4 h-4 text-gold shrink-0" />
                    {prompt.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 bg-gold/20 rounded-lg flex items-center justify-center shrink-0 mt-1">
                {msg.type === "tool_call" ? <Wrench className="w-3.5 h-3.5 text-gold" /> : <Bot className="w-3.5 h-3.5 text-gold" />}
              </div>
            )}
            <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-gold text-white"
                : msg.type === "thinking"
                ? "bg-white/5 text-white/60 italic"
                : "bg-white/10 text-white/90"
            }`}>
              {msg.content || (msg.type === "thinking" ? "Thinking..." : "")}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 bg-navy-light rounded-lg flex items-center justify-center shrink-0 mt-1">
                <User className="w-3.5 h-3.5 text-gold" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about revenue, vessels, employees, inventory..."
          className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-gold"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-gold hover:bg-[#B08D2F] text-navy font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
