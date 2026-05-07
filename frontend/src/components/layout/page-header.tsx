"use client";

import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive";
  className?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  actions?: PageHeaderAction[];
}

/**
 * Reusable page header with title, subtitle, icon, and action buttons.
 * Replaces the repeated header pattern across all ERP pages.
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName = "text-[#0ea5e9]",
  actions = [],
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
          {Icon && <Icon className={`h-6 w-6 ${iconClassName}`} />}
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action, i) => (
            <Button
              key={i}
              onClick={action.onClick}
              variant={action.variant || "default"}
              className={`gap-2 rounded-xl ${
                action.variant !== "outline"
                  ? "bg-[#1e3a5f] hover:bg-[#2d5a87]"
                  : ""
              } ${action.className || ""}`}
            >
              {action.icon && <action.icon size={16} />}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
