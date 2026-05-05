"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Home, BookOpen, Bot, Package, Users,
  DollarSign, Wrench, FolderKanban, ShoppingCart, Settings,
  ChevronLeft, ChevronRight, Anchor, Moon, Sun,
  LayoutDashboard, Calculator, BarChart3, Ship,
  Briefcase, Warehouse, ClipboardList, HardHat,
  ChevronDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";

/* ═══════════════════════════════════════════════════════════
 * Sidebar navigation — merged v2.0 + v3 ERP modules
 * ═══════════════════════════════════════════════════════════ */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  group: string;
  children?: { href: string; label: string }[];
}

const NAV_ITEMS: NavItem[] = [
  // Navigation
  { href: "/", label: "Home", icon: Home, group: "nav" },
  { href: "/enquiries", label: "Enquiries", icon: FileText, group: "nav" },
  { href: "/wiki", label: "Wiki", icon: BookOpen, group: "nav" },
  { href: "/ai", label: "AI Chat", icon: Bot, group: "nav" },
  { href: "/pipeline", label: "Pipeline", icon: FolderKanban, group: "nav" },

  // ERP — Dashboard
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "erp" },

  // ERP — Sales
  {
    href: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    group: "erp",
    children: [
      { href: "/sales/customers", label: "Customers" },
      { href: "/sales/quotations", label: "Quotations" },
      { href: "/sales/orders", label: "Orders" },
      { href: "/sales/invoices", label: "Invoices" },
    ],
  },

  // ERP — Purchasing
  {
    href: "/purchasing",
    label: "Purchasing",
    icon: Package,
    group: "erp",
    children: [
      { href: "/purchasing/suppliers", label: "Suppliers" },
      { href: "/purchasing/purchase-orders", label: "Orders" },
    ],
  },

  // ERP — Inventory
  {
    href: "/inventory",
    label: "Inventory",
    icon: Warehouse,
    group: "erp",
    children: [
      { href: "/inventory/items", label: "Items" },
      { href: "/inventory/stock-balance", label: "Warehouses" },
      { href: "/inventory/stock-ledger", label: "Stock Ledger" },
    ],
  },

  // ERP — CRM
  {
    href: "/crm",
    label: "CRM",
    icon: Users,
    group: "erp",
    children: [
      { href: "/crm/leads", label: "Leads" },
      { href: "/crm/opportunities", label: "Opportunities" },
    ],
  },

  // ERP — Projects
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    group: "erp",
    children: [
      { href: "/projects/list", label: "Project List" },
      { href: "/projects/tasks", label: "Tasks" },
      { href: "/projects/timesheets", label: "Timesheets" },
    ],
  },

  // ERP — HR
  {
    href: "/hr",
    label: "HR",
    icon: Briefcase,
    group: "erp",
    children: [
      { href: "/hr/employees", label: "Employees" },
      { href: "/hr/attendance", label: "Attendance" },
      { href: "/hr/leave", label: "Leave" },
      { href: "/hr/payroll", label: "Payroll" },
    ],
  },

  // ERP — Marine
  {
    href: "/marine",
    label: "Marine",
    icon: Ship,
    group: "erp",
    children: [
      { href: "/marine/vessels", label: "Vessels" },
      { href: "/marine/dive-operations", label: "Dive Ops" },
      { href: "/marine/safety", label: "Safety" },
      { href: "/marine/fuel-logs", label: "Fuel" },
      { href: "/marine/charters", label: "Charters" },
    ],
  },

  // ERP — Accounting
  {
    href: "/accounting",
    label: "Accounting",
    icon: Calculator,
    group: "erp",
    children: [
      { href: "/accounting/journal-entries", label: "Journal Entries" },
      { href: "/accounting/accounts", label: "Chart of Accounts" },
      { href: "/accounting/general-ledger", label: "General Ledger" },
    ],
  },

  // ERP — Reports
  { href: "/reports", label: "Reports", icon: BarChart3, group: "erp" },

  // Legacy ERP modules (kept for compat)
  { href: "/erp/accounts", label: "Accounts (Legacy)", icon: DollarSign, group: "legacy" },
  { href: "/erp/assets", label: "Assets (Legacy)", icon: Wrench, group: "legacy" },
  { href: "/erp/stock", label: "Stock (Legacy)", icon: Package, group: "legacy" },
  { href: "/erp/projects", label: "Projects (Legacy)", icon: FolderKanban, group: "legacy" },
  { href: "/erp/hr", label: "HR (Legacy)", icon: Users, group: "legacy" },
  { href: "/erp/procurement", label: "Procurement (Legacy)", icon: ShoppingCart, group: "legacy" },

  // System
  { href: "/settings", label: "Settings", icon: Settings, group: "system" },
];

const GROUPS: Record<string, string> = {
  nav: "Navigation",
  erp: "Operations",
  legacy: "Legacy",
  system: "System",
};

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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

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
                  const hasChildren = item.children && item.children.length > 0;
                  const sectionOpen = openSections[item.label] ?? active;

                  const link = (
                    <div>
                      {hasChildren ? (
                        <button
                          onClick={() => toggleSection(item.label)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
                                className="overflow-hidden whitespace-nowrap flex-1 text-left"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {!isCollapsed && (
                            <motion.div animate={{ rotate: sectionOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                              <ChevronDown className="h-3 w-3" />
                            </motion.div>
                          )}
                          {active && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 h-6 w-[3px] rounded-r-full bg-primary"
                              transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            />
                          )}
                        </button>
                      ) : (
                        <Link
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
                      )}

                      {/* Children */}
                      <AnimatePresence>
                        {hasChildren && sectionOpen && !isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-4 border-l border-border pl-3 py-1 space-y-0.5">
                              {item.children!.map((child) => {
                                const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={`block rounded-md px-3 py-1.5 text-xs transition-colors ${
                                      childActive
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    }`}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );

                  // Wrap with tooltip when collapsed
                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return <div key={item.href}>{link}</div>;
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
              v2.0 — Gemini + MCP
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
