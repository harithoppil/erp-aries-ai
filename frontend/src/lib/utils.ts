import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number | undefined, currency: string = "AED"): string {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" });
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Active: "bg-green-100 text-green-800",
    Present: "bg-green-100 text-green-800",
    Paid: "bg-green-100 text-green-800",
    Submitted: "bg-blue-100 text-blue-800",
    Confirmed: "bg-blue-100 text-blue-800",
    Draft: "bg-gray-100 text-gray-800",
    Open: "bg-blue-100 text-blue-800",
    Planning: "bg-purple-100 text-purple-800",
    "In Progress": "bg-yellow-100 text-yellow-800",
    Completed: "bg-green-100 text-green-800",
    Cancelled: "bg-red-100 text-red-800",
    Overdue: "bg-red-100 text-red-800",
    Rejected: "bg-red-100 text-red-800",
    Accepted: "bg-green-100 text-green-800",
    Expired: "bg-red-100 text-red-800",
    Maintenance: "bg-yellow-100 text-yellow-800",
    Decommissioned: "bg-gray-100 text-gray-800",
    OK: "bg-green-100 text-green-800",
    "Needs Repair": "bg-yellow-100 text-yellow-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}
