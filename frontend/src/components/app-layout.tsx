"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useResponsive } from "@/hooks/use-responsive";
import { Sidebar } from "@/components/desktop/sidebar";
import { MobileTopBar, MobileBottomNav } from "@/components/mobile/mobile-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { breakpoint, isDesktop, isMobile, mounted } = useResponsive();
  const [collapsed, setCollapsed] = useState(false);

  // SSR-safe: render nothing layout-specific until client mounts
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-primary" />
            <span className="text-sm font-medium text-muted-foreground">Loading Aries...</span>
          </div>
        </div>
      </div>
    );
  }

  const sidebarWidth = isDesktop
    ? (collapsed ? 64 : 256)
    : 64; // tablet = always collapsed

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {isMobile ? (
          /* ═══ Mobile: Split nav (top bar + bottom tabs) ═══ */
          <div className="relative min-h-screen">
            <MobileTopBar />
            <main className="pt-[60px] pb-20 px-4 py-4">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <MobileBottomNav />
          </div>
        ) : (
          /* ═══ Desktop/Tablet: Collapsible sidebar ═══ */
          <div className="relative min-h-screen">
            <Sidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed(!collapsed)}
              mode={isDesktop ? "desktop" : "tablet"}
            />
            <motion.main
              className="min-h-screen p-6 lg:p-8"
              animate={{ marginLeft: sidebarWidth }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <ErrorBoundary>{children}</ErrorBoundary>
            </motion.main>
          </div>
        )}
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
