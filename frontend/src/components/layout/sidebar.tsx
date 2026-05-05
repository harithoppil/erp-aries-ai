"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Briefcase, Ship,
  Anchor, Calculator, BarChart3, Settings, MessageSquare, Building2,
  ChevronDown, ChevronRight, LogOut, Warehouse, FolderKanban, HardHat
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  {
    label: "Sales", icon: ShoppingCart, href: "/sales",
    children: [
      { label: "Quotations", href: "/sales/quotations" },
      { label: "Orders", href: "/sales/orders" },
      { label: "Invoices", href: "/sales/invoices" },
      { label: "Customers", href: "/sales/customers" },
    ],
  },
  {
    label: "Purchasing", icon: Package, href: "/purchasing",
    children: [
      { label: "Purchase Orders", href: "/purchasing/purchase-orders" },
      { label: "Suppliers", href: "/purchasing/suppliers" },
    ],
  },
  {
    label: "Inventory", icon: Warehouse, href: "/inventory",
    children: [
      { label: "Items", href: "/inventory/items" },
      { label: "Stock Ledger", href: "/inventory/stock-ledger" },
      { label: "Stock Balance", href: "/inventory/stock-balance" },
    ],
  },
  {
    label: "Accounting", icon: Calculator, href: "/accounting",
    children: [
      { label: "Chart of Accounts", href: "/accounting/accounts" },
      { label: "Journal Entries", href: "/accounting/journal-entries" },
      { label: "General Ledger", href: "/accounting/general-ledger" },
    ],
  },
  {
    label: "CRM", icon: Users, href: "/crm",
    children: [
      { label: "Leads", href: "/crm/leads" },
      { label: "Opportunities", href: "/crm/opportunities" },
    ],
  },
  {
    label: "Projects", icon: FolderKanban, href: "/projects",
    children: [
      { label: "Projects List", href: "/projects/list" },
      { label: "Tasks", href: "/projects/tasks" },
      { label: "Timesheets", href: "/projects/timesheets" },
    ],
  },
  {
    label: "HR", icon: Briefcase, href: "/hr",
    children: [
      { label: "Employees", href: "/hr/employees" },
      { label: "Attendance", href: "/hr/attendance" },
      { label: "Leave", href: "/hr/leave" },
      { label: "Payroll", href: "/hr/payroll" },
    ],
  },
  {
    label: "Marine", icon: Ship, href: "/marine",
    children: [
      { label: "Vessels", href: "/marine/vessels" },
      { label: "Dive Ops", href: "/marine/dive-operations" },
      { label: "Safety Equipment", href: "/marine/safety" },
      { label: "Fuel Logs", href: "/marine/fuel-logs" },
      { label: "Charters", href: "/marine/charters" },
    ],
  },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "AI Assistant", icon: MessageSquare, href: "/ai" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Sales: true, Marine: true,
  });

  function toggle(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function logout() {
    localStorage.removeItem("aries_token");
    localStorage.removeItem("aries_user");
    window.location.href = "/login";
  }

  return (
    <aside className="w-64 min-h-screen bg-navy text-white flex flex-col sticky top-0">
      <div className="p-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold rounded-lg flex items-center justify-center">
            <Anchor className="w-5 h-5 text-navy" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">ARIES MARINE</h1>
            <p className="text-[10px] text-white/60 tracking-widest">ERP SYSTEM</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openSections[item.label];

          return (
            <div key={item.label}>
              <Link href={hasChildren ? "#" : item.href} onClick={() => hasChildren && toggle(item.label)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/10",
                  isActive && !hasChildren && "bg-gold/20 text-gold border-r-2 border-gold",
                  !isActive && "text-white/80"
                )}>
                <Icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                {hasChildren && (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
              </Link>
              {hasChildren && isOpen && (
                <div className="bg-black/20">
                  {item.children!.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link key={child.href} href={child.href}
                        className={cn(
                          "block pl-12 pr-4 py-2 text-xs transition-colors hover:bg-white/10",
                          childActive ? "text-gold bg-gold/10" : "text-white/60"
                        )}>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <button onClick={logout} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}
