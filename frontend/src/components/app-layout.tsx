"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useResponsive } from "@/hooks/use-responsive";
import { Sidebar } from "@/components/desktop/sidebar";
import { MobileTopBar, MobileBottomNav } from "@/components/mobile/mobile-nav";
import { AiChatPanel } from "@/components/ai-chat-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { MessageSquare, Menu } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isDesktop, isMobile, isTablet, mounted } = useResponsive();
  const [collapsed, setCollapsed] = useState(false);
  const { chatOpen, toggleChat } = useAppStore();

  // SSR-safe
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Loading Aries...
            </span>
          </div>
        </div>
      </div>
    );
  }

  const sidebarWidth = isDesktop ? (collapsed ? 64 : 256) : 64;
  const chatWidth = chatOpen ? 320 : 0;

  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <div className="relative min-h-screen">
            <MobileTopBar />
            <main className="px-4 pb-20 pt-[60px]">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <MobileBottomNav />
          </div>
          {/* Floating chat button on mobile */}
          <button
            onClick={toggleChat}
            className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            <MessageSquare size={20} />
          </button>
          {/* Mobile chat overlay */}
          {chatOpen && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={toggleChat}
              />
              <div className="absolute bottom-0 left-0 right-0 top-12">
                <AiChatPanel />
              </div>
            </div>
          )}
        </div>
        <Toaster position="top-center" richColors closeButton theme="system" />
      </TooltipProvider>
    );
  }

  // Desktop / Tablet: three-panel layout
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Top header bar */}
        <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-3">
            {isTablet && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="rounded-lg p-2 hover:bg-accent"
              >
                <Menu size={20} className="text-muted-foreground" />
              </button>
            )}
            <h1 className="text-sm font-semibold">Aries ERP</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0 text-[10px] font-medium text-primary leading-none">
              AI-Powered
            </span>
          </div>

          {/* Right side: chat toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleChat}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                chatOpen
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <MessageSquare size={14} />
              <span className="hidden sm:inline text-xs">AI Assistant</span>
            </button>
          </div>
        </header>

        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mode={isDesktop ? "desktop" : "tablet"}
        />

        {/* AI Chat Panel */}
        <AiChatPanel />

        {/* Main Content — shifts between sidebar and chat panel */}
        <motion.main
          className="min-h-screen p-4 pt-16"
          animate={{
            marginLeft: sidebarWidth,
            marginRight: chatWidth,
          }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </motion.main>
      </div>
      <Toaster
        position={isMobile ? "top-center" : "bottom-right"}
        richColors
        closeButton
        theme="system"
      />
    </TooltipProvider>
  );
}
