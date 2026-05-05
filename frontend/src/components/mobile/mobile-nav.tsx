"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileText, Home, Bot, BookOpen, Package,
  Anchor, ChevronLeft, Menu, Moon, Sun,
  DollarSign, Wrench, FolderKanban, Users, ShoppingCart,
  LayoutDashboard, Ship, Briefcase, BarChart3, Calculator,
  Warehouse,
} from "lucide-react";
import { useDarkMode } from "@/hooks/use-responsive";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const BOTTOM_TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/enquiries", label: "Enquiries", icon: FileText },
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
];

const MORE_ITEMS = [
  { href: "/sales/customers", label: "Customers", icon: Users },
  { href: "/sales/quotations", label: "Quotations", icon: FileText },
  { href: "/sales/orders", label: "Orders", icon: ShoppingCart },
  { href: "/sales/invoices", label: "Invoices", icon: DollarSign },
  { href: "/purchasing/suppliers", label: "Suppliers", icon: Package },
  { href: "/purchasing/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/inventory/items", label: "Items", icon: Package },
  { href: "/inventory/stock-balance", label: "Stock Balance", icon: Warehouse },
  { href: "/inventory/stock-ledger", label: "Stock Ledger", icon: FileText },
  { href: "/crm/leads", label: "Leads", icon: Users },
  { href: "/crm/opportunities", label: "Opportunities", icon: FolderKanban },
  { href: "/projects/list", label: "Projects", icon: FolderKanban },
  { href: "/projects/tasks", label: "Tasks", icon: FileText },
  { href: "/projects/timesheets", label: "Timesheets", icon: FileText },
  { href: "/hr/employees", label: "Employees", icon: Users },
  { href: "/hr/attendance", label: "Attendance", icon: FileText },
  { href: "/hr/leave", label: "Leave", icon: FileText },
  { href: "/hr/payroll", label: "Payroll", icon: DollarSign },
  { href: "/marine/vessels", label: "Vessels", icon: Ship },
  { href: "/marine/dive-operations", label: "Dive Ops", icon: Anchor },
  { href: "/marine/safety", label: "Safety", icon: Wrench },
  { href: "/marine/fuel-logs", label: "Fuel", icon: DollarSign },
  { href: "/marine/charters", label: "Charters", icon: Ship },
  { href: "/accounting/journal-entries", label: "Journal Entries", icon: Calculator },
  { href: "/accounting/accounts", label: "Chart of Accounts", icon: Calculator },
  { href: "/accounting/general-ledger", label: "General Ledger", icon: Calculator },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/pipeline", label: "Pipeline", icon: FolderKanban },
  { href: "/erp/accounts", label: "Accounts (Legacy)", icon: DollarSign },
  { href: "/erp/assets", label: "Assets (Legacy)", icon: Wrench },
  { href: "/erp/stock", label: "Stock (Legacy)", icon: Package },
  { href: "/erp/projects", label: "Projects (Legacy)", icon: FolderKanban },
  { href: "/erp/hr", label: "HR (Legacy)", icon: Users },
  { href: "/erp/procurement", label: "Procurement (Legacy)", icon: ShoppingCart },
  { href: "/settings", label: "Settings", icon: Briefcase },
];

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSubPage = pathname !== "/";

  const currentTab = [...BOTTOM_TABS, ...MORE_ITEMS].find(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/")
  );

  return (
    <header className="glass fixed left-0 right-0 top-0 z-50 flex h-[60px] items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {isSubPage && (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Anchor className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold">
            {isSubPage ? currentTab?.label || "Aries" : "Aries ERP"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleDark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={dark}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
            >
              <Menu className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Anchor className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold">Aries ERP</p>
                <p className="text-[10px] text-muted-foreground">All Operations</p>
              </div>
            </div>
            <nav className="mt-4 space-y-1 max-h-[70vh] overflow-y-auto">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
      {BOTTOM_TABS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-colors ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {active && (
              <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
