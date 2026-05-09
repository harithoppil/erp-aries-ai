"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, ChevronDown, ChevronLeft, ChevronRight,
  ShoppingCart, Store, Package, Factory, FolderKanban,
  Landmark, Briefcase, ShieldCheck, Building2,
  Settings, LayoutGrid, BarChart3, Bot, GitBranch,
  MessageSquare, Database, Sparkles, BookOpen,
  LogOut, User, Truck, FileText, ClipboardList,
  Clock, Users, Layers, TrendingDown, TrendingUp,
  Receipt, CreditCard, GitBranch as AccountTree,
  Handshake, Timer, Calendar, PieChart,
  Target, ArrowLeftRight, Flag, Search, AlertOctagon,
  Globe, Printer, Upload, Download,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";
import { useSession } from "@/hooks/use-session";
import { signoutAction } from "@/app/auth/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  pattern?: "tabs" | "drill-down";
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Navigation Config ─────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      // ── Dashboard (singleton, no children) ────────────────────────────────
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

      // ── Selling (tabs pattern, 6 items) ───────────────────────────────────
      {
        label: "Selling",
        icon: ShoppingCart,
        children: [
          { label: "Customers", href: "/dashboard/erp/customers", icon: Users },
          { label: "Enquiries", href: "/dashboard/enquiries", icon: MessageSquare },
          { label: "Quotations", href: "/dashboard/erp/quotations", icon: Receipt },
          { label: "Sales Orders", href: "/dashboard/erp/sales-orders", icon: ClipboardList },
          { label: "Sales Invoice", href: "/dashboard/erp/selling/invoices", icon: FileText },
          { label: "Reports", href: "/dashboard/erp/reports", icon: BarChart3 },
        ],
      },

      // ── Buying (tabs pattern, 7 items — borderline) ───────────────────────
      {
        label: "Buying",
        icon: Store,
        children: [
          { label: "Suppliers", href: "/dashboard/erp/procurement", icon: Truck },
          { label: "Material Request", href: "/dashboard/erp/material-requests", icon: ClipboardList },
          { label: "Request for Quotation", href: "/dashboard/erp/buying/rfq", icon: Receipt },
          { label: "Supplier Quotation", href: "/dashboard/erp/quotations", icon: FileText },
          { label: "Purchase Order", href: "/dashboard/erp/procurement", icon: Package },
          { label: "Purchase Invoice", href: "/dashboard/erp/buying/invoices", icon: FileText },
          { label: "Procurement", href: "/dashboard/erp/procurement", icon: Handshake },
        ],
      },

      // ── Stock (drill-down, 7 items) ───────────────────────────────────────
      {
        label: "Stock",
        icon: Package,
        pattern: "drill-down",
        children: [
          { label: "Dashboard", href: "/dashboard/erp/stock", icon: LayoutDashboard },
          { label: "Stock Entry", href: "/dashboard/erp/stock/entries", icon: ArrowLeftRight },
          { label: "Purchase Receipt", href: "/dashboard/erp/stock/purchase-receipts", icon: Truck },
          { label: "Delivery Note", href: "/dashboard/erp/stock/delivery-notes", icon: FileText },
          { label: "Material Request", href: "/dashboard/erp/material-requests", icon: ClipboardList },
          { label: "Pick List", href: "/dashboard/erp/stock", icon: ClipboardList },
          { label: "Warehouses", href: "/dashboard/erp/stock/warehouses", icon: Building2 },
        ],
      },

      // ── Manufacturing (tabs pattern, 5 items) ─────────────────────────────
      {
        label: "Manufacturing",
        icon: Factory,
        children: [
          { label: "Dashboard", href: "/dashboard/erp/stock", icon: LayoutDashboard },
          { label: "BOM", href: "/dashboard/erp/manufacturing/work-orders", icon: Layers },
          { label: "Work Order", href: "/dashboard/erp/manufacturing/work-orders", icon: Factory },
          { label: "Job Card", href: "/dashboard/erp/manufacturing/work-orders", icon: ClipboardList },
          { label: "Stock Entry", href: "/dashboard/erp/stock/entries", icon: ArrowLeftRight },
        ],
      },

      // ── Projects (tabs pattern, 4 items) ──────────────────────────────────
      {
        label: "Projects",
        icon: FolderKanban,
        children: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "Project", href: "/dashboard/erp/projects", icon: FolderKanban },
          { label: "Task", href: "/dashboard/erp/projects/tasks", icon: Flag },
          { label: "Timesheet", href: "/dashboard/erp/timesheets", icon: Timer },
        ],
      },

      // ── Accounting (drill-down, 8 items) ──────────────────────────────────
      {
        label: "Accounting",
        icon: Landmark,
        pattern: "drill-down",
        children: [
          { label: "Invoicing", href: "/dashboard/erp/selling/invoices", icon: Receipt },
          { label: "Payments", href: "/dashboard/erp/payments", icon: CreditCard },
          { label: "Chart of Accounts", href: "/dashboard/erp/chart-of-accounts", icon: AccountTree },
          { label: "Journal Entries", href: "/dashboard/erp/journal-entries", icon: BookOpen },
          { label: "Financial Reports", href: "/dashboard/erp/reports", icon: BarChart3, children: [
            { label: "General Ledger", href: "/dashboard/erp/reports/general-ledger", icon: BookOpen },
            { label: "Trial Balance", href: "/dashboard/erp/reports/trial-balance", icon: Target },
            { label: "Balance Sheet", href: "/dashboard/erp/reports/balance-sheet", icon: TrendingUp },
            { label: "Profit & Loss", href: "/dashboard/erp/reports/profit-and-loss", icon: TrendingDown },
          ]},
          { label: "Budget", href: "/dashboard/erp/accounts/budgets", icon: PieChart },
          { label: "Cost Centers", href: "/dashboard/erp/accounts/cost-centers", icon: Target },
          { label: "Bank Accounts", href: "/dashboard/erp/accounts/bank-accounts", icon: Landmark },
        ],
      },

      // ── Assets (drill-down, 5 items) ──────────────────────────────────────
      {
        label: "Assets",
        icon: Briefcase,
        pattern: "drill-down",
        children: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "Asset", href: "/dashboard/erp/assets", icon: Briefcase },
          { label: "Depreciation", href: "/dashboard/erp/assets", icon: TrendingDown },
          { label: "Asset Movement", href: "/dashboard/erp/assets", icon: Truck },
          { label: "Maintenance", href: "/dashboard/erp/assets", icon: Factory },
          { label: "Reports", href: "/dashboard/erp/reports", icon: BarChart3 },
        ],
      },

      // ── Quality (drill-down, 5 items) ─────────────────────────────────────
      {
        label: "Quality",
        icon: ShieldCheck,
        pattern: "drill-down",
        children: [
          { label: "Quality Inspection", href: "/dashboard/erp/stock", icon: Search },
          { label: "Quality Goal", href: "/dashboard/erp/stock", icon: Flag },
          { label: "Quality Review", href: "/dashboard/erp/stock", icon: BarChart3 },
          { label: "Non Conformance", href: "/dashboard/erp/stock", icon: AlertOctagon },
          { label: "Setup", href: "/dashboard/erp/stock", icon: Settings },
        ],
      },

      // ── Organization (drill-down, 5 items) ────────────────────────────────
      {
        label: "Organization",
        icon: Building2,
        pattern: "drill-down",
        children: [
          { label: "Company", href: "/dashboard/erp/setup/company", icon: Building2 },
          { label: "Department", href: "/dashboard/erp/hr", icon: AccountTree },
          { label: "Users", href: "/dashboard/erp/hr", icon: Users },
          { label: "Fiscal Years", href: "/dashboard/erp/setup/fiscal-years", icon: Calendar },
          { label: "Email Account", href: "/dashboard/settings", icon: MessageSquare },
        ],
      },

      // ── Framework (drill-down, 3 items) ───────────────────────────────────
      {
        label: "Framework",
        icon: LayoutGrid,
        pattern: "drill-down",
        children: [
          { label: "Data Import", href: "/dashboard/documents", icon: Upload },
          { label: "Data Export", href: "/dashboard/documents", icon: Download },
          { label: "Reports", href: "/dashboard/erp/reports", icon: BarChart3 },
          { label: "Printing", href: "/dashboard/settings", icon: Printer },
          { label: "System", href: "/dashboard/settings", icon: Settings },
          { label: "Website", href: "/dashboard/settings", icon: Globe },
        ],
      },

      // ── System Settings (drill-down, 8 items) ─────────────────────────────
      {
        label: "System Settings",
        icon: Settings,
        pattern: "drill-down",
        children: [
          { label: "Global Defaults", href: "/dashboard/settings", icon: Settings },
          { label: "Accounts Settings", href: "/dashboard/settings", icon: Landmark },
          { label: "Selling Settings", href: "/dashboard/settings", icon: ShoppingCart },
          { label: "Buying Settings", href: "/dashboard/settings", icon: Store },
          { label: "Stock Settings", href: "/dashboard/settings", icon: Package },
          { label: "Manufacturing Settings", href: "/dashboard/settings", icon: Factory },
          { label: "Projects Settings", href: "/dashboard/settings", icon: FolderKanban },
          { label: "Support Settings", href: "/dashboard/settings", icon: MessageSquare },
        ],
      },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "AI Chat", href: "/dashboard/ai", icon: Bot },
      { label: "Workflows", href: "/dashboard/pipeline", icon: GitBranch },
      { label: "Channels", href: "/dashboard/channels", icon: MessageSquare },
      { label: "RAG Index", href: "/dashboard/settings/rag", icon: Database },
    ],
  },
];

// ── Sidebar Component ─────────────────────────────────────────────────────────

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

  // Accordion state: only one L1 module expanded at a time
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Drill-down stack: tracks sidebar navigation depth
  // Each entry is { moduleLabel: string, parentLabel?: string }
  const [drillStack, setDrillStack] = useState<
    { moduleLabel: string; parentLabel?: string }[]
  >([]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  // Toggle L1 module (accordion)
  const toggleModule = useCallback(
    (label: string, hasChildren: boolean) => {
      if (!hasChildren) return;
      setExpandedModule((prev) => (prev === label ? null : label));
      // Reset drill-down when switching modules
      setDrillStack([]);
    },
    [],
  );

  // Drill into a sub-module that has children
  const drillInto = useCallback(
    (moduleLabel: string, parentLabel?: string) => {
      setDrillStack((prev) => [...prev, { moduleLabel, parentLabel }]);
    },
    [],
  );

  // Go back in drill-down
  const drillBack = useCallback(() => {
    setDrillStack((prev) => prev.slice(0, -1));
  }, []);

  // Check if an item or its children is active
  const isActive = useCallback(
    (item: NavItem): boolean => {
      if (item.href && pathname === item.href) return true;
      if (item.children) {
        return item.children.some(
          (child) =>
            (child.href && pathname === child.href) ||
            (child.children && child.children.some((gc) => gc.href === pathname)),
        );
      }
      return false;
    },
    [pathname],
  );

  // Get current drill-down level
  const currentDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  async function handleSignout() {
    await signoutAction();
    router.push("/auth");
  }

  // ── Render Helpers ────────────────────────────────────────────────────────────

  // Find a module by label recursively
  function findModule(label: string, items: NavItem[]): NavItem | null {
    for (const item of items) {
      if (item.label === label) return item;
      if (item.children) {
        const found = findModule(label, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  // Render a nav item (L1 or L2)
  function renderNavItem(item: NavItem, depth: number = 0) {
    const Icon = item.icon;
    const hasChildren = (item.children?.length ?? 0) > 0;
    const active = isActive(item);
    const isExpanded = expandedModule === item.label;
    const isDrillable = item.pattern === "drill-down" && hasChildren;

    // Collapsed sidebar: icon + tooltip only
    if (isCollapsed) {
      const content = hasChildren ? (
        <button
          onClick={() => toggleModule(item.label, hasChildren)}
          className={`flex w-full items-center justify-center py-2.5 transition-colors relative
            ${active
              ? "bg-[#1e3a5f] text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
        >
          <Icon size={20} />
        </button>
      ) : (
        <Link
          href={item.href!}
          className={`flex w-full items-center justify-center py-2.5 transition-colors relative
            ${active
              ? "bg-[#1e3a5f] text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
        >
          <Icon size={20} />
        </Link>
      );

      return (
        <Tooltip key={item.label}>
          <TooltipTrigger>{content}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    // Expanded sidebar: full item
    return (
      <div key={item.label}>
        <div
          className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors cursor-pointer
            ${active
              ? "bg-[#1e3a5f] text-white border-l-4 border-[#0ea5e9]"
              : "text-slate-300 hover:bg-slate-800 hover:text-white border-l-4 border-transparent"
            }
            ${depth > 0 ? "pl-" + (12 + depth * 4) : ""}
          `}
          onClick={() => {
            if (hasChildren) {
              if (isDrillable && depth === 1) {
                // Drill into L3
                drillInto(item.label, expandedModule ?? undefined);
              } else {
                toggleModule(item.label, hasChildren);
              }
            } else if (item.href) {
              router.push(item.href);
            }
          }}
        >
          <Icon size={depth === 0 ? 20 : 16} />
          <span className="flex-1 truncate">{item.label}</span>
          {hasChildren && depth === 0 && (
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          )}
          {hasChildren && depth > 0 && !isDrillable && (
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${expandedModule === item.label ? "rotate-180" : ""}`}
            />
          )}
          {isDrillable && depth > 0 && (
            <ChevronRight size={12} className="text-slate-500" />
          )}
        </div>

        {/* Expanded children (accordion) */}
        <AnimatePresence initial={false}>
          {isExpanded && hasChildren && depth === 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {item.children!.map((child) => renderNavItem(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Render drill-down view
  function renderDrillDown() {
    if (!currentDrill) return null;

    // Walk the drill stack to find the current module
    let currentModule: NavItem | null = null;
    const allItems = NAV_GROUPS.flatMap((g) => g.items);

    for (const level of drillStack) {
      const searchIn = currentModule?.children ?? allItems;
      currentModule = findModule(level.moduleLabel, searchIn);
    }

    if (!currentModule || !currentModule.children) return null;

    return (
      <div>
        {/* Back button */}
        <button
          onClick={drillBack}
          className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-800 w-full transition-colors border-b border-slate-800"
        >
          <ChevronLeft size={16} />
          <span>Back to {currentDrill.parentLabel || "Menu"}</span>
        </button>

        {/* Module header */}
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {currentDrill.moduleLabel}
        </div>

        {/* Drill-down items */}
        {currentModule.children.map((child) => {
          const Icon = child.icon;
          const childActive = child.href ? pathname === child.href : false;
          return (
            <Link
              key={child.label}
              href={child.href || "#"}
              className={`flex items-center gap-3 px-4 pl-8 py-2 text-sm transition-colors
                ${childActive
                  ? "bg-[#1e3a5f] text-white border-l-4 border-[#0ea5e9]"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white border-l-4 border-transparent"
                }`}
            >
              <Icon size={16} />
              <span className="truncate">{child.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────────

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#0f172a] text-[#cbd5e1] dark:bg-[#0f172a]"
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Logo — fixed top */}
      <div
        className={`flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-4 ${
          !isCollapsed ? "" : "justify-center"
        }`}
      >
        <img
          src="/aries-logo-transparent.png"
          alt="Aries"
          className="h-8 w-8 shrink-0"
        />
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">Aries</div>
            <div className="text-[10px] text-slate-400">Marine ERP</div>
          </div>
        )}
      </div>

      {/* Navigation — scrollable middle section */}
      <nav className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentDrill && !isCollapsed ? (
            // Drill-down view
            <motion.div
              key="drilldown"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderDrillDown()}
            </motion.div>
          ) : (
            // Normal module list
            <motion.div
              key="main"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  {!isCollapsed && (
                    <div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {group.label}
                    </div>
                  )}
                  {group.items.map((item) => renderNavItem(item, 0))}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* User Card — fixed bottom */}
      <div className="shrink-0 border-t border-slate-800 bg-[#0f172a]">
        {user ? (
          <div
            className={`px-4 py-3 ${isCollapsed ? "flex flex-col items-center" : ""}`}
          >
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-700"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white ring-2 ring-slate-700">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {user.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}{" "}
                    &middot; {user.company}
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
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-700"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white ring-2 ring-slate-700">
                      {initials}
                    </div>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {user.name} — Sign Out
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

        {/* Toggle button */}
        {showToggle && (
          <div
            className={`border-t border-slate-800/50 px-4 py-2 ${
              isCollapsed ? "flex justify-center" : "flex justify-end"
            }`}
          >
            <button
              onClick={onToggle}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
