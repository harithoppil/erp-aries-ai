"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Home, BookOpen, Bot, Package, Users,
  DollarSign, Wrench, FolderKanban, ShoppingCart,
  ChevronLeft, ChevronRight, Anchor,
  Truck, Sparkles,
  GitBranch, MessageSquare, Database, Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/enquiries", label: "Enquiries", icon: FileText, badge: 6 },
      { href: "/erp/accounts", label: "Accounts", icon: DollarSign },
      { href: "/erp/stock", label: "Stock", icon: Package },
      { href: "/erp/procurement", label: "Purchase Orders", icon: ShoppingCart },
      { href: "/erp/procurement", label: "Suppliers", icon: Truck },
      { href: "/erp/hr", label: "Personnel", icon: Users },
      { href: "/erp/assets", label: "Assets", icon: Wrench },
      { href: "/erp/projects", label: "Projects", icon: FolderKanban },
      { href: "/documents", label: "Documents", icon: Upload },
      { href: "/wiki", label: "Wiki", icon: BookOpen },
    ],
  },
  {
    label: "AI Admin",
    items: [
      { href: "/ai", label: "AI Chat", icon: Bot },
      { href: "/pipeline", label: "Workflows", icon: GitBranch },
      { href: "/settings", label: "Personas", icon: Sparkles },
      { href: "/settings", label: "Channels", icon: MessageSquare },
      { href: "/settings", label: "RAG Index", icon: Database },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mode: "desktop" | "tablet";
}

export function Sidebar({ collapsed, onToggle, mode }: SidebarProps) {
  const pathname = usePathname();
  const { dark, toggle: toggleDark } = useDarkMode();
  const isCollapsed = mode === "tablet" || collapsed;
  const showToggle = mode === "desktop";

  return (
    <motion.aside
      className="fixed left-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto bg-[#0f172a] text-[#cbd5e1] dark:bg-[#0f172a]"
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 border-b border-slate-800 px-4 py-4 ${!isCollapsed ? "" : "justify-center"}`}>
        <img src="/aries-logo-transparent.png" alt="Aries" className="h-8 w-8 shrink-0" />
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">Aries</div>
            <div className="text-[10px] text-slate-400">Marine ERP</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="pb-20">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!isCollapsed && (
              <div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative
                    ${isActive
                      ? "bg-[#1e3a5f] text-white border-l-4 border-[#0ea5e9]"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white border-l-4 border-transparent"
                    }
                    ${isCollapsed ? "justify-center" : ""}
                  `}
                >
                  <Icon size={20} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {"badge" in item && item.badge && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </div>
        ))}
      </nav>

      {/* Toggle button */}
      {showToggle && (
        <button
          onClick={onToggle}
          className="absolute bottom-4 right-4 hidden h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white lg:flex"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </motion.aside>
  );
}
