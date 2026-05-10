"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { toDisplayLabel } from "@/lib/erpnext/prisma-delegate";

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

// Match /dashboard/erp/{doctype} and /dashboard/erp/{doctype}/{name}
const ERP_LIST_RE = /^\/dashboard\/erp\/([^/]+)$/;
const ERP_DETAIL_RE = /^\/dashboard\/erp\/([^/]+)\/([^/]+)$/;

/**
 * Derive a human-readable label from the pathname.
 * Handles dynamic doctype routes using toDisplayLabel().
 */
function pathnameToLabel(pathname: string): string {
  // Static routes first
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];

  // Dynamic ERP list: /dashboard/erp/sales-order → "Sales Order"
  const listMatch = pathname.match(ERP_LIST_RE);
  if (listMatch) return toDisplayLabel(listMatch[1]);

  // Dynamic ERP detail: /dashboard/erp/sales-order/SO-0001 → "Sales Order / SO-0001"
  const detailMatch = pathname.match(ERP_DETAIL_RE);
  if (detailMatch) {
    const doctypeLabel = toDisplayLabel(detailMatch[1]);
    if (detailMatch[2] === "new") return `New ${doctypeLabel}`;
    return `${doctypeLabel} / ${detailMatch[2]}`;
  }

  // Fallback: capitalize path segments
  return (
    pathname
      .split("/")
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" > ") || "Unknown"
  );
}

/**
 * Hook that sets page context in the app store whenever the route changes.
 * This allows the AI chat panel to know what page the user is viewing.
 * Call this from individual page components with optional data summary.
 */
export function usePageContext(dataSummary?: string) {
  const pathname = usePathname();
  const { setPageContext } = useAppStore();

  useEffect(() => {
    const label = pathnameToLabel(pathname);
    setPageContext(label, dataSummary || "");
  }, [pathname, dataSummary, setPageContext]);
}

/**
 * Get sidebar pages list for AI context
 */
export function getSidebarContext(): string {
  return `Available pages: ${SIDEBAR_PAGES.join(", ")}`;
}
