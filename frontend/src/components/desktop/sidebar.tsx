"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Home, BookOpen, Bot, Package, Users,
  DollarSign, Wrench, FolderKanban, ShoppingCart, Settings,
  ChevronLeft, ChevronRight, Anchor, Moon, Sun,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home, group: "nav" },
  { href: "/enquiries", label: "Enquiries", icon: FileText, group: "nav" },
  { href: "/wiki", label: "Wiki", icon: BookOpen, group: "nav" },
  { href: "/ai", label: "AI Chat", icon: Bot, group: "nav" },
  { href: "/erp/accounts", label: "Accounts", icon: DollarSign, group: "erp" },
  { href: "/erp/assets", label: "Assets", icon: Wrench, group: "erp" },
  { href: "/erp/stock", label: "Stock", icon: Package, group: "erp" },
  { href: "/erp/projects", label: "Projects", icon: FolderKanban, group: "erp" },
  { href: "/erp/hr", label: "HR", icon: Users, group: "erp" },
  { href: "/erp/procurement", label: "Procurement", icon: ShoppingCart, group: "erp" },
  { href: "/settings", label: "Settings", icon: Settings, group: "system" },
];

const GROUPS: Record<string, string> = {
  nav: "Navigation",
  erp: "Operations",
  system: "System",
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mode: "desktop" | "tablet"; // desktop = toggleable, tablet = always-collapsed
}

export function Sidebar({ collapsed, onToggle, mode }: SidebarProps) {
  const pathname = usePathname();
  const { dark, toggle: toggleDark } = useDarkMode();
  const isCollapsed = mode === "tablet" || collapsed;
  const showToggle = mode === "desktop";

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground"
      animate={{ width: isCollapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-border px-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Anchor className="h-4 w-4 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <h1 className="text-sm font-bold tracking-tight">Aries ERP</h1>
                <p className="text-[10px] text-muted-foreground">AI Presales Consultant</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {Object.entries(GROUPS).map(([groupKey, groupLabel]) => {
          const items = NAV_ITEMS.filter((i) => i.group === groupKey);
          if (items.length === 0) return null;
          return (
            <div key={groupKey} className="mb-3">
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {groupLabel}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const link = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {active && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute left-0 h-6 w-[3px] rounded-r-full bg-primary"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                    </Link>
                  );

                  // Wrap with tooltip when collapsed
                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger render={link} />
                        <TooltipContent side="right" className="text-xs">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return link;
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="border-t border-border p-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={dark}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {dark ? "Light Mode" : "Dark Mode"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle (desktop only) */}
        {showToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Version */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-1 px-3 text-[10px] text-muted-foreground"
            >
              v0.1.0 — Gemini + MCP
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
