"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/enquiries": "Enquiries",
  "/enquiries/new": "New Enquiry",
  "/wiki": "Wiki",
  "/ai": "AI Chat (Full Page)",
  "/pipeline": "Pipeline",
  "/settings": "Settings",
  "/erp/accounts": "Accounts & Finance",
  "/erp/assets": "Assets & Equipment",
  "/erp/stock": "Stock & Inventory",
  "/erp/projects": "Projects",
  "/erp/hr": "HR & Personnel",
  "/erp/procurement": "Procurement",
  "/documents": "Documents & OCR",
};

const SIDEBAR_PAGES = [
  "Dashboard",
  "Enquiries",
  "Wiki",
  "AI Chat",
  "Accounts",
  "Assets",
  "Stock",
  "Projects",
  "HR",
  "Procurement",
  "Documents",
  "Pipeline",
  "Settings",
];

/**
 * Hook that sets page context in the app store whenever the route changes.
 * This allows the AI chat panel to know what page the user is viewing.
 * Call this from individual page components with optional data summary.
 */
export function usePageContext(dataSummary?: string) {
  const pathname = usePathname();
  const { setPageContext } = useAppStore();

  useEffect(() => {
    const label =
      ROUTE_LABELS[pathname] ||
      pathname
        .split("/")
        .filter(Boolean)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" > ") ||
      "Unknown";

    setPageContext(label, dataSummary || "");
  }, [pathname, dataSummary, setPageContext]);
}

/**
 * Get sidebar pages list for AI context
 */
export function getSidebarContext(): string {
  return `Available pages: ${SIDEBAR_PAGES.join(", ")}`;
}
