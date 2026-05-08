"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Home, BookOpen, Bot, Package, Users,
  DollarSign, Wrench, FolderKanban, ShoppingCart,
  ChevronLeft, ChevronRight, Anchor,
  Truck, Sparkles, Wallet, Clock, BarChart3, Briefcase,
  GitBranch, MessageSquare, Database, Upload,
  TreePine, ScrollText, Scale, TrendingUp, TrendingDown,
  ClipboardList, LogOut, User,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";
import { useSession } from "@/hooks/use-session";
import { signoutAction } from "@/app/auth/actions";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/dashboard/enquiries", label: "Enquiries", icon: FileText },
      { href: "/dashboard/erp/customers", label: "Customers", icon: Briefcase },
      { href: "/dashboard/erp/quotations", label: "Quotations", icon: FileText },
      { href: "/dashboard/erp/sales-orders", label: "Sales Orders", icon: Package },
      { href: "/dashboard/erp/accounts", label: "Accounts", icon: DollarSign },
      { href: "/dashboard/erp/chart-of-accounts", label: "Chart of Accounts", icon: TreePine },
      { href: "/dashboard/erp/journal-entries", label: "Journal Entries", icon: BookOpen },
      { href: "/dashboard/erp/payments", label: "Payments", icon: Wallet },
      { href: "/dashboard/erp/reports/general-ledger", label: "General Ledger", icon: ScrollText },
      { href: "/dashboard/erp/reports/trial-balance", label: "Trial Balance", icon: Scale },
      { href: "/dashboard/erp/reports/balance-sheet", label: "Balance Sheet", icon: TrendingUp },
      { href: "/dashboard/erp/reports/profit-and-loss", label: "Profit & Loss", icon: TrendingDown },
      { href: "/dashboard/erp/stock", label: "Stock", icon: Package },
      { href: "/dashboard/erp/procurement", label: "Procurement", icon: ShoppingCart },
      { href: "/dashboard/erp/material-requests", label: "Material Requests", icon: ClipboardList },
      { href: "/dashboard/erp/hr", label: "Personnel", icon: Users },
      { href: "/dashboard/erp/assets", label: "Assets", icon: Wrench },
      { href: "/dashboard/erp/projects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/erp/timesheets", label: "Timesheets", icon: Clock },
      { href: "/dashboard/erp/reports", label: "Reports", icon: BarChart3 },
      { href: "/dashboard/documents", label: "Documents", icon: Upload },
      { href: "/dashboard/notebooks", label: "Notebooks", icon: BookOpen },
      { href: "/dashboard/wiki", label: "Wiki", icon: BookOpen },
    ],
  },
  {
    label: "AI Admin",
    items: [
      { href: "/dashboard/ai", label: "AI Chat", icon: Bot },
      { href: "/dashboard/pipeline", label: "Workflows", icon: GitBranch },
      { href: "/dashboard/settings", label: "Settings", icon: Sparkles },
      { href: "/dashboard/channels", label: "Channels", icon: MessageSquare },
      { href: "/dashboard/settings/rag", label: "RAG Index", icon: Database },
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
  const router = useRouter();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user } = useSession();
  const isCollapsed = mode === "tablet" || collapsed;
  const showToggle = mode === "desktop";

  // Get initials from name
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  async function handleSignout() {
    await signoutAction();
    router.push("/auth");
  }

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col overflow-y-auto bg-[#0f172a] text-[#cbd5e1] dark:bg-[#0f172a]"
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
                    </>
                  )}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger>{link}</TooltipTrigger>
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

      {/* User Card */}
      <div className="mt-auto border-t border-slate-800">
        {user ? (
          <div className={`px-4 py-3 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                {/* Avatar initials */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {user.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)} &middot;{" "}
                    {user.company}
                  </div>
                </div>
                <button
                  onClick={handleSignout}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <button
                    onClick={handleSignout}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:text-red-400"
                  >
                    <LogOut size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Sign Out ({user.name})
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          !isCollapsed && (
            <div className="px-4 py-3">
              <Link
                href="/auth"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
              >
                <User size={16} />
                Sign In
              </Link>
            </div>
          )
        )}
      </div>

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
