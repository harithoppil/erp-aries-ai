"use client";

import { type LucideIcon } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconClassName?: string;
}

interface StatGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4 | 5;
}

/**
 * Responsive stat card grid. Auto-scales from 2 cols (mobile) to N cols (desktop).
 * Replaces the repeated stat card pattern across all ERP pages.
 */
export default function StatGrid({ stats, columns = 4 }: StatGridProps) {
  const colClass = {
    2: "grid-cols-2 md:grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
  }[columns];

  return (
    <div className={`grid ${colClass} gap-4`}>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              {Icon && (
                <Icon size={16} className={stat.iconClassName || "text-[#64748b]"} />
              )}
              <span className="text-xs font-medium text-[#64748b] uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#0f172a]">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
}
