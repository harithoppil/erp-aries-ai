<frontend>
  <!--
  This file contains a concatenated representation of a codebase.
  An <index> is provided below with the list of files included.
  To find the contents of a specific file, search for `<filename>` and `</filename>` tags.
  -->

  ## File Index

  ```
  <index>
    next-env.d.ts
    README.md
    AGENTS.md
    CLAUDE.md
    next.config.ts
    src/types/api.ts
    src/app/layout.tsx
    src/app/page.tsx
    src/app/globals.css
    src/app/settings/page.tsx
    src/app/pipeline/page.tsx
    src/app/wiki/page.tsx
    src/app/ai/page.tsx
    src/app/erp/projects/page.tsx
    src/app/erp/accounts/page.tsx
    src/app/erp/procurement/page.tsx
    src/app/erp/hr/page.tsx
    src/app/erp/stock/page.tsx
    src/app/erp/assets/page.tsx
    src/app/enquiries/page.tsx
    src/app/enquiries/new/page.tsx
    src/app/enquiries/[id]/page.tsx
    src/components/error-boundary.tsx
    src/components/app-layout.tsx
    src/components/desktop/sidebar.tsx
    src/components/mobile/mobile-nav.tsx
    src/hooks/use-responsive.ts
  </index>
  ```

  ---

  | # | File | Path | Lines | Tokens |
  |---|------|------|-------|--------|
  | 1 | [`next-env.d.ts`](#next-env-d-ts) | `./` | 6 | 98 |
  | 2 | [`README.md`](#readme-md) | `./` | 5 | 81 |
  | 3 | [`AGENTS.md`](#agents-md) | `./` | 5 | 110 |
  | 4 | [`CLAUDE.md`](#claude-md) | `./` | 1 | 46 |
  | 5 | [`next.config.ts`](#next-config-ts) | `./` | 26 | 196 |
  | 6 | [`api.ts`](#src-types-api-ts) | `src/types` | 99 | 733 |
  | 7 | [`layout.tsx`](#src-app-layout-tsx) | `src/app` | 31 | 311 |
  | 8 | [`page.tsx`](#src-app-page-tsx) | `src/app` | 373 | 3,264 |
  | 9 | [`globals.css`](#src-app-globals-css) | `src/app` | 261 | 3,732 |
  | 10 | [`page.tsx`](#src-app-settings-page-tsx) | `src/app/settings` | 166 | 1,691 |
  | 11 | [`page.tsx`](#src-app-pipeline-page-tsx) | `src/app/pipeline` | 85 | 1,370 |
  | 12 | [`page.tsx`](#src-app-wiki-page-tsx) | `src/app/wiki` | 101 | 940 |
  | 13 | [`page.tsx`](#src-app-ai-page-tsx) | `src/app/ai` | 460 | 3,859 |
  | 14 | [`page.tsx`](#src-app-erp-projects-page-tsx) | `src/app/erp/projects` | 58 | 595 |
  | 15 | [`page.tsx`](#src-app-erp-accounts-page-tsx) | `src/app/erp/accounts` | 122 | 1,259 |
  | 16 | [`page.tsx`](#src-app-erp-procurement-page-tsx) | `src/app/erp/procurement` | 74 | 812 |
  | 17 | [`page.tsx`](#src-app-erp-hr-page-tsx) | `src/app/erp/hr` | 70 | 729 |
  | 18 | [`page.tsx`](#src-app-erp-stock-page-tsx) | `src/app/erp/stock` | 77 | 868 |
  | 19 | [`page.tsx`](#src-app-erp-assets-page-tsx) | `src/app/erp/assets` | 70 | 733 |
  | 20 | [`page.tsx`](#src-app-enquiries-page-tsx) | `src/app/enquiries` | 79 | 929 |
  | 21 | [`page.tsx`](#src-app-enquiries-new-page-tsx) | `src/app/enquiries/new` | 76 | 989 |
  | 22 | [`page.tsx`](#src-app-enquiries-id-page-tsx) | `src/app/enquiries/[id]` | 184 | 2,450 |
  | 23 | [`error-boundary.tsx`](#src-components-error-boundary-tsx) | `src/components` | 51 | 417 |
  | 24 | [`app-layout.tsx`](#src-components-app-layout-tsx) | `src/components` | 72 | 628 |
  | 25 | [`sidebar.tsx`](#src-components-desktop-sidebar-tsx) | `src/components/desktop` | 214 | 1,947 |
  | 26 | [`mobile-nav.tsx`](#src-components-mobile-mobile-nav-tsx) | `src/components/mobile` | 148 | 1,428 |
  | 27 | [`use-responsive.ts`](#src-hooks-use-responsive-ts) | `src/hooks` | 70 | 582 |
  | | **Total** | | **2,984** | **30,797** |

  ---

  <next-env.d.ts>

<a name="next-env-d-ts"></a>
### `next-env.d.ts`

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

  </next-env.d.ts>

  <README.md>

<a name="readme-md"></a>
### `README.md`

```md
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:
```

  </README.md>

  <AGENTS.md>

<a name="agents-md"></a>
### `AGENTS.md`

```md
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
```

  </AGENTS.md>

  <CLAUDE.md>

<a name="claude-md"></a>
### `CLAUDE.md`

```md
@AGENTS.md
```

  </CLAUDE.md>

  <next.config.ts>

<a name="next-config-ts"></a>
### `next.config.ts`

```ts
import type { NextConfig } from "next";
import os from "os";

/** Collect all local network IPs so dev server accepts connections from any device on the LAN. */
function getLocalIPs(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        ips.push(entry.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalIPs(),
  turbopack: {
    root: "..",
  },
};

export default nextConfig;
```

  </next.config.ts>

  <src/types/api.ts>

<a name="src-types-api-ts"></a>
### `src/types/api.ts`

```ts
// Auto-generated from Python Pydantic schemas
// Run: python scripts/generate_types.py
// DO NOT EDIT MANUALLY — changes will be overwritten

export type EnquiryStatus = "draft" | "ingested" | "classified" | "rules_applied" | "llm_drafted" | "policy_review" | "human_review" | "approved" | "executing" | "completed" | "rejected";

export const STATUS_COLORS: Record<EnquiryStatus, string> = {
  "draft": "bg-muted/50 text-muted-foreground",
  "ingested": "bg-primary/10 text-primary",
  "classified": "bg-primary/15 text-primary",
  "rules_applied": "bg-sonar/10 text-sonar",
  "llm_drafted": "bg-amber/10 text-amber",
  "policy_review": "bg-primary/20 text-primary",
  "human_review": "bg-destructive/10 text-destructive",
  "approved": "bg-primary/15 text-primary",
  "executing": "bg-sonar/15 text-sonar",
  "completed": "bg-primary/20 text-primary",
  "rejected": "bg-destructive/15 text-destructive",
};

export interface EnquiryCreate {
  client_name: string;
  client_email?: string | null;
  channel?: string;
  industry?: string | null;
  subdivision?: string | null;
  description: string;
}

export interface EnquiryRead {
  id: string;
  enquiry_number: string | null;
  client_name: string;
  client_email: string | null;
  channel: string;
  industry: string | null;
  subdivision: string | null;
  description: string;
  status: EnquiryStatus;
  estimated_value: unknown | null;
  estimated_cost: unknown | null;
  estimated_margin: unknown | null;
  scope_category: string | null;
  complexity: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryUpdate {
  client_name?: string | null;
  client_email?: string | null;
  industry?: string | null;
  subdivision?: string | null;
  description?: string | null;
  estimated_value?: unknown | null;
  estimated_cost?: unknown | null;
  status?: unknown | null;
  approved_by?: string | null;
}

export interface DocumentRead {
  id: string;
  enquiry_id: string;
  filename: string;
  content_type: string;
  storage_path: string;
  wiki_source_page: string | null;
  processing_status: string;
  created_at: string;
}

export interface WikiPageRead {
  path: string;
  content: string;
  last_modified?: string | null;
  last_commit?: string | null;
}

export interface WikiSearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface PipelineRunRequest {
  enquiry_id: string;
}

export interface PipelineRunResponse {
  enquiry_id: string;
  status: string;
  message: string;
  wiki_pages_created?: string[];
  rules_output?: unknown | null;
  llm_draft?: string | null;
}
```

  </src/types/api.ts>

  <src/app/layout.tsx>

<a name="src-app-layout-tsx"></a>
### `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { cn } from "@/lib/utils";

/*
 * Aries ERP — Nautical Industrial
 *
 * Fonts: Geist (modern, precise — instrument readout feel)
 *        Geist Mono (data displays, code blocks)
 * Light mode default, dark mode toggle
 */

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Aries ERP — AI Presales Consultant",
  description: "Hybrid AI Presales Consultant — MCP-native, Gemini-powered, Wiki-first",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
```

  </src/app/layout.tsx>

  <src/app/page.tsx>

<a name="src-app-page-tsx"></a>
### `src/app/page.tsx`

```tsx
"use client";

import { useMemo } from "react";
import { useEnquiries } from "@/lib/api";
import { EnquiryRead, STATUS_COLORS } from "@/types/api";
import Link from "next/link";
import { motion } from "motion/react";
import {
  FileText, TrendingUp, AlertCircle, CheckCircle,
  Anchor, BarChart3, Calendar, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResponsive } from "@/hooks/use-responsive";

/* ═══════════════════════════════════════════════════════════
 * Dashboard — Bridge Command Center
 *
 * Layout: 4 stat cards (with animated counters)
 *         Enquiry heatmap calendar (GitHub-style)
 *         Recent enquiries list
 * ═══════════════════════════════════════════════════════════ */

function AnimatedCounter({ value }: { value: number }) {
  return (
    <span className="text-3xl font-bold tabular-nums">
      {value}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <AnimatedCounter value={value} />
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══ Heatmap Calendar — GitHub-style contribution graph ═══ */
function HeatmapCalendar({ enquiries }: { enquiries: EnquiryRead[] }) {
  // Group enquiries by date
  const dateMap = new Map<string, number>();
  enquiries.forEach((e) => {
    const date = e.created_at?.split("T")[0] || "";
    if (date) {
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    }
  });

  const maxCount = Math.max(...dateMap.values(), 1);

  // Build last 12 weeks (84 days)
  const days: { date: string; count: number; level: number }[] = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const count = dateMap.get(key) || 0;
    const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
    days.push({ date: key, count, level });
  }

  const levelColors = [
    "bg-muted/30",                      // 0: No activity
    "bg-primary/20",                    // 1: Low
    "bg-primary/40",                    // 2: Medium
    "bg-primary/60",                    // 3: High
    "bg-primary",                       // 4: Max
  ];

  const weeks = [];
  for (let w = 0; w < 12; w++) {
    weeks.push(days.slice(w * 7, (w + 1) * 7));
  }

  return (
    <div className="flex gap-0.5" role="grid" aria-label="Enquiry activity heatmap">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-0.5" role="row">
          {week.map((day) => (
            <div
              key={day.date}
              className={`h-3 w-3 rounded-[2px] ${levelColors[day.level]} transition-transform hover:scale-150 hover:z-10`}
              role="gridcell"
              aria-label={`${day.date}: ${day.count} enquiries`}
              title={`${day.date}: ${day.count} enquiries`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isMobile } = useResponsive();
  const { data: enquiries, error, isLoading } = useEnquiries();

  const stats = useMemo(() => ({
    total: enquiries?.length ?? 0,
    active: enquiries?.filter((e) => !["completed", "rejected"].includes(e.status)).length ?? 0,
    pendingReview: enquiries?.filter((e) => ["human_review", "policy_review"].includes(e.status)).length ?? 0,
    completed: enquiries?.filter((e) => e.status === "completed").length ?? 0,
  }), [enquiries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Anchor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Command Center</h1>
            <p className="text-[11px] text-muted-foreground">Enquiry pipeline overview</p>
          </div>
        </div>
        <Link href="/enquiries/new">
          <Button size="sm" className="gap-2 rounded-xl">
            <FileText className="h-3.5 w-3.5" />
            New Enquiry
          </Button>
        </Link>
      </motion.div>

      {/* Stat cards */}
      <div className={isMobile ? "grid grid-cols-2 gap-3" : "grid grid-cols-4 gap-4"}>
        <StatCard
          label="Total Enquiries"
          value={stats.total}
          icon={FileText}
          accent="bg-sonar/15 text-sonar"
          delay={0}
        />
        <StatCard
          label="Active Pipeline"
          value={stats.active}
          icon={TrendingUp}
          accent="bg-amber/15 text-amber"
          delay={0.05}
        />
        <StatCard
          label="Pending Review"
          value={stats.pendingReview}
          icon={AlertCircle}
          accent="bg-destructive/15 text-destructive"
          delay={0.1}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle}
          accent="bg-primary/15 text-primary"
          delay={0.15}
        />
      </div>

      {/* Heatmap + Chart row */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
        {/* Activity heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                Enquiry Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, w) => (
                    <div key={w} className="flex flex-col gap-0.5">
                      {Array.from({ length: 7 }).map((_, d) => (
                        <Skeleton key={d} className="h-3 w-3 rounded-[2px]" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <HeatmapCalendar enquiries={enquiries || []} />
              )}
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>12 weeks ago</span>
                <div className="flex items-center gap-1">
                  Less
                  {[0, 1, 2, 3, 4].map((l) => (
                    <div
                      key={l}
                      className={`h-2.5 w-2.5 rounded-[2px] ${
                        l === 0 ? "bg-muted/30" : `bg-primary/${l * 20}`
                      }`}
                    />
                  ))}
                  More
                </div>
                <span>Today</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pipeline status distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-primary" />
                Pipeline Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full rounded" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(STATUS_COLORS).map(([status, colorClass]) => {
                    const count = enquiries?.filter((e) => e.status === status).length ?? 0;
                    if (count === 0) return null;
                    const pct = enquiries?.length ? (count / enquiries.length) * 100 : 0;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="capitalize">{status.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                          <motion.div
                            className={`h-full rounded-full ${colorClass}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent enquiries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Enquiries</CardTitle>
              <Link href="/enquiries">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-destructive text-sm">
                Failed to load: {error.message}
              </div>
            ) : !enquiries?.length ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No enquiries yet.{" "}
                <Link href="/enquiries/new" className="text-primary underline">
                  Create one
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {enquiries.slice(0, 8).map((e: EnquiryRead, i: number) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.03 }}
                  >
                    <Link
                      href={`/enquiries/${e.id}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.client_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {e.industry || "No industry"} · {e.channel}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`ml-2 shrink-0 text-[10px] ${STATUS_COLORS[e.status] || ""}`}
                      >
                        {e.status.replace(/_/g, " ")}
                      </Badge>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
```

  </src/app/page.tsx>

  <src/app/globals.css>

<a name="src-app-globals-css"></a>
### `src/app/globals.css`

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  /* Nautical accent colors — always available */
  --color-sonar: var(--sonar);
  --color-sonar-foreground: var(--sonar-foreground);
  --color-amber: var(--amber);
  --color-amber-foreground: var(--amber-foreground);
  --color-navy: var(--navy);
  --color-navy-foreground: var(--navy-foreground);
}

/*
 * ═══════════════════════════════════════════════════════════
 * ARIES ERP — Nautical Industrial Design System
 * ═══════════════════════════════════════════════════════════
 *
 * Inspired by marine navigation bridges, depth-finder instruments,
 * and sonar displays. Dark mode default — like instrument panels at sea.
 *
 * Color language:
 *   Teal/Cyan  → Sonar, depth, navigation  (primary actions)
 *   Amber      → Alert, caution, nav light  (warnings, attention)
 *   Navy       → Deep water, hull steel     (structural elements)
 */

:root {
  /* Light mode — coastal dawn */
  --background: oklch(0.985 0.001 250);
  --foreground: oklch(0.18 0.02 250);
  --card: oklch(0.995 0.001 250);
  --card-foreground: oklch(0.18 0.02 250);
  --popover: oklch(0.995 0.001 250);
  --popover-foreground: oklch(0.18 0.02 250);
  --primary: oklch(0.55 0.15 195);         /* Sonar teal */
  --primary-foreground: oklch(0.98 0.005 250);
  --secondary: oklch(0.94 0.02 250);
  --secondary-foreground: oklch(0.25 0.02 250);
  --muted: oklch(0.94 0.01 250);
  --muted-foreground: oklch(0.50 0.02 250);
  --accent: oklch(0.92 0.04 195);
  --accent-foreground: oklch(0.22 0.05 195);
  --destructive: oklch(0.58 0.22 25);      /* Coral red — distress signal */
  --border: oklch(0.88 0.02 250);
  --input: oklch(0.88 0.02 250);
  --ring: oklch(0.55 0.15 195);
  --chart-1: oklch(0.55 0.15 195);         /* Teal */
  --chart-2: oklch(0.60 0.18 48);          /* Amber */
  --chart-3: oklch(0.45 0.12 250);         /* Navy */
  --chart-4: oklch(0.65 0.10 150);         /* Seafoam */
  --chart-5: oklch(0.50 0.08 30);          /* Rust */
  --radius: 0.5rem;
  --sidebar: oklch(0.96 0.005 250);
  --sidebar-foreground: oklch(0.18 0.02 250);
  --sidebar-primary: oklch(0.55 0.15 195);
  --sidebar-primary-foreground: oklch(0.98 0.005 250);
  --sidebar-accent: oklch(0.92 0.04 195);
  --sidebar-accent-foreground: oklch(0.22 0.05 195);
  --sidebar-border: oklch(0.88 0.02 250);
  --sidebar-ring: oklch(0.55 0.15 195);
  /* Nautical accents */
  --sonar: oklch(0.55 0.15 195);
  --sonar-foreground: oklch(0.98 0.005 250);
  --amber: oklch(0.70 0.17 55);
  --amber-foreground: oklch(0.15 0.05 55);
  --navy: oklch(0.25 0.05 250);
  --navy-foreground: oklch(0.95 0.01 250);
}

.dark {
  /* Dark mode — bridge at night, instrument panel */
  --background: oklch(0.13 0.02 250);      /* Deep ocean */
  --foreground: oklch(0.93 0.01 250);
  --card: oklch(0.17 0.03 250);             /* Slightly lighter panel */
  --card-foreground: oklch(0.93 0.01 250);
  --popover: oklch(0.17 0.03 250);
  --popover-foreground: oklch(0.93 0.01 250);
  --primary: oklch(0.65 0.16 195);         /* Bright sonar teal */
  --primary-foreground: oklch(0.12 0.02 250);
  --secondary: oklch(0.22 0.03 250);
  --secondary-foreground: oklch(0.90 0.01 250);
  --muted: oklch(0.22 0.03 250);
  --muted-foreground: oklch(0.65 0.02 250);
  --accent: oklch(0.25 0.06 195);
  --accent-foreground: oklch(0.85 0.10 195);
  --destructive: oklch(0.70 0.20 25);      /* Bright coral */
  --border: oklch(0.28 0.03 250);
  --input: oklch(0.28 0.03 250);
  --ring: oklch(0.65 0.16 195);
  --chart-1: oklch(0.65 0.16 195);         /* Bright teal */
  --chart-2: oklch(0.75 0.17 55);          /* Amber glow */
  --chart-3: oklch(0.50 0.08 250);         /* Muted navy */
  --chart-4: oklch(0.55 0.10 150);         /* Muted seafoam */
  --chart-5: oklch(0.60 0.12 30);          /* Warm rust */
  --sidebar: oklch(0.15 0.03 250);          /* Deepest panel */
  --sidebar-foreground: oklch(0.90 0.01 250);
  --sidebar-primary: oklch(0.65 0.16 195);
  --sidebar-primary-foreground: oklch(0.12 0.02 250);
  --sidebar-accent: oklch(0.25 0.06 195);
  --sidebar-accent-foreground: oklch(0.85 0.10 195);
  --sidebar-border: oklch(0.28 0.03 250);
  --sidebar-ring: oklch(0.65 0.16 195);
  /* Nautical accents */
  --sonar: oklch(0.65 0.16 195);
  --sonar-foreground: oklch(0.12 0.02 250);
  --amber: oklch(0.75 0.17 55);
  --amber-foreground: oklch(0.12 0.05 55);
  --navy: oklch(0.18 0.04 250);
  --navy-foreground: oklch(0.90 0.01 250);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  html {
    @apply font-sans;
  }
}

/* ═══════════════════════════════════════════════════════════
 * Custom scrollbar — thin, nautical
 * ═══════════════════════════════════════════════════════════ */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: oklch(0.5 0.02 250 / 40%);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: oklch(0.5 0.02 250 / 60%);
}
.dark ::-webkit-scrollbar-thumb {
  background: oklch(0.6 0.04 195 / 30%);
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: oklch(0.6 0.04 195 / 50%);
}

/* ═══════════════════════════════════════════════════════════
 * Glass morphism utilities
 * ═══════════════════════════════════════════════════════════ */
.glass {
  background: oklch(0.98 0.005 250 / 80%);
  backdrop-filter: blur(16px) saturate(1.5);
  border: 1px solid oklch(0.85 0.02 250 / 50%);
}
.dark .glass {
  background: oklch(0.15 0.03 250 / 70%);
  border: 1px solid oklch(0.35 0.04 250 / 30%);
}

.glass-card {
  background: oklch(0.98 0.005 250 / 60%);
  backdrop-filter: blur(12px) saturate(1.3);
  border: 1px solid oklch(0.88 0.02 250 / 50%);
}
.dark .glass-card {
  background: oklch(0.18 0.03 250 / 60%);
  border: 1px solid oklch(0.32 0.04 250 / 25%);
}

/* ═══════════════════════════════════════════════════════════
 * Sonar pulse animation
 * ═══════════════════════════════════════════════════════════ */
@keyframes sonar-pulse {
  0% { box-shadow: 0 0 0 0 oklch(0.55 0.15 195 / 40%); }
  70% { box-shadow: 0 0 0 8px oklch(0.55 0.15 195 / 0%); }
  100% { box-shadow: 0 0 0 0 oklch(0.55 0.15 195 / 0%); }
}
/* Dark mode sonar handled via CSS custom properties above */
.sonar-pulse {
  animation: sonar-pulse 2s infinite;
}

/* ═══════════════════════════════════════════════════════════
 * Sonar ping (single pulse for notifications)
 * ═══════════════════════════════════════════════════════════ */
@keyframes ping-once {
  0% { transform: scale(1); opacity: 0.8; }
  75%, 100% { transform: scale(2); opacity: 0; }
}

/* ═══════════════════════════════════════════════════════════
 * Depth gauge gradient — for progress bars
 * ═══════════════════════════════════════════════════════════ */
.depth-gradient {
  background: linear-gradient(
    135deg,
    oklch(0.65 0.16 195) 0%,
    oklch(0.50 0.12 210) 50%,
    oklch(0.25 0.05 250) 100%
  );
}

/* ═══════════════════════════════════════════════════════════
 * Noise texture overlay — adds depth to backgrounds
 * ═══════════════════════════════════════════════════════════ */
.noise-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 128px 128px;
}
```

  </src/app/globals.css>

  <src/app/settings/page.tsx>

<a name="src-app-settings-page-tsx"></a>
### `src/app/settings/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { useDarkMode } from "@/hooks/use-responsive";
import { Settings as SettingsIcon, Moon, Sun, Key, Database, Cloud, Shield } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const isMobile = useIsMobile();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const handleSaveApiKey = () => {
    // In a real app this would POST to backend; for now store locally
    if (apiKey.trim()) {
      localStorage.setItem("aries-api-key", apiKey.trim());
      setApiKeySaved(true);
      toast.success("API key saved");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">System Settings</h2>
      </div>

      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        {/* Appearance */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            {dark ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-amber" />}
            <h3 className="font-semibold">Appearance</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
            </div>
            <button
              onClick={toggleDark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={dark}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                dark ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  dark ? "translate-x-5.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* API Authentication */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Key className="h-4 w-4 text-amber" />
            <h3 className="font-semibold">API Authentication</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setApiKeySaved(false); }}
                  placeholder="Enter API key..."
                  className="flex-1 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim()}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              {apiKeySaved && <p className="mt-1 text-xs text-sonar">Key saved successfully</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              When set, all API requests require the X-API-Key header. Leave empty for development mode (no auth).
            </p>
          </div>
        </div>

        {/* Database Info */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-sonar" />
            <h3 className="font-semibold">Database</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Engine</dt>
              <dd>SQLite (aiosqlite)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-xs">./aries.db</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ORM</dt>
              <dd>SQLAlchemy 2.0</dd>
            </div>
          </dl>
        </div>

        {/* Cloud Configuration */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Cloud Services</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">AI Provider</dt>
              <dd>Google Vertex AI</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Embedding Model</dt>
              <dd className="text-xs">gemini-embedding-2</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage</dt>
              <dd>GCS (aries-raw-sources)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Wiki</dt>
              <dd>Local filesystem</dd>
            </div>
          </dl>
        </div>

        {/* Security */}
        <div className={isMobile ? "" : "col-span-2"}>
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Security & Compliance</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[
                { label: "SQL Injection", status: "Protected", ok: true },
                { label: "Path Traversal", status: "Protected", ok: true },
                { label: "Upload Cap", status: "50 MB", ok: true },
                { label: "API Auth", status: apiKeySaved ? "Enabled" : "Dev Mode", ok: apiKeySaved },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={`font-medium ${item.ok ? "text-sonar" : "text-amber"}`}>{item.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

  </src/app/settings/page.tsx>

  <src/app/pipeline/page.tsx>

<a name="src-app-pipeline-page-tsx"></a>
### `src/app/pipeline/page.tsx`

```tsx
"use client";

import { useIsMobile } from "@/hooks/use-responsive";
import { CheckCircle, FileText, Brain, Shield, Zap, Workflow } from "lucide-react";

const NODES = [
  { id: 1, name: "New Enquiry", phase: 1, icon: FileText, desc: "Client enquiry captured from email, WhatsApp, phone, or web" },
  { id: 2, name: "Intake UI", phase: 1, icon: FileText, desc: "Operations team reviews and captures details" },
  { id: 3, name: "Backend API + MCP Gateway", phase: 1, icon: Workflow, desc: "API orchestration and MCP tool federation" },
  { id: 4, name: "MarkItDown Ingestion", phase: 2, icon: FileText, desc: "Documents converted to clean markdown" },
  { id: 7, name: "LLM Wiki", phase: 2, icon: Brain, desc: "Git-versioned knowledge repository" },
  { id: 8, name: "Hybrid Retrieval", phase: 2, icon: Workflow, desc: "Wiki-first + vector + keyword search" },
  { id: 9, name: "Wiki-First Retrieval", phase: 3, icon: Brain, desc: "Read index.md, follow links to relevant pages" },
  { id: 10, name: "Gemini Classification", phase: 3, icon: Brain, desc: "Structured JSON classification via Gemini" },
  { id: 11, name: "Rules Engine", phase: 3, icon: Shield, desc: "Deterministic pricing, margins, tax, policy" },
  { id: 12, name: "Gemini 2.5 Pro Reasoning", phase: 3, icon: Brain, desc: "1M context proposal drafting" },
  { id: 13, name: "Policy Gate", phase: 3, icon: Shield, desc: "Validated and within policy?" },
  { id: 14, name: "MCP Agent Orchestration", phase: 4, icon: Zap, desc: "Coordinate tools, workflows, system actions" },
  { id: 15, name: "Human Approval", phase: 4, icon: CheckCircle, desc: "Two-person rule for high-value" },
  { id: 16, name: "Execution (Parallel)", phase: 4, icon: Zap, desc: "ERP, SAP, Outlook, PDF, Wiki Update" },
];

const PHASE_COLORS = {
  1: "border-primary/20 bg-primary/10",
  2: "border-purple-200 bg-purple-50",
  3: "border-amber-200 bg-amber-50",
  4: "border-green-200 bg-green-50",
};

const PHASE_NAMES: Record<number, string> = {
  1: "Phase 1: Input & Intake",
  2: "Phase 2: Knowledge Compilation",
  3: "Phase 3: AI & Decisioning",
  4: "Phase 4: Orchestration & Execution",
};

export default function PipelinePage() {
  const isMobile = useIsMobile();

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Pipeline Architecture</h2>

      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        {[1, 2, 3, 4].map((phase) => (
          <div key={phase}>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{PHASE_NAMES[phase]}</h3>
            <div className="space-y-2">
              {NODES.filter((n) => n.phase === phase).map((node) => {
                const Icon = node.icon;
                return (
                  <div
                    key={node.id}
                    className={`rounded-xl border p-4 ${PHASE_COLORS[node.phase as keyof typeof PHASE_COLORS]}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-card p-2 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Node {node.id}: {node.name}</p>
                        <p className="text-xs text-foreground">{node.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border bg-card p-6">
        <h3 className="mb-3 font-semibold">Hard Rules (from spec)</h3>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-red-500" /> Rules engine runs BEFORE LLM — pricing, margins, tax never decided by AI alone</li>
          <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-red-500" /> Two human gates: policy validation (Node 13) + release approval (Node 15)</li>
          <li className="flex items-start gap-2"><Zap className="mt-0.5 h-4 w-4 text-amber-500" /> Execution fan-out is parallel, not sequential</li>
          <li className="flex items-start gap-2"><Brain className="mt-0.5 h-4 w-4 text-purple-500" /> Wiki writes are append-or-merge, never overwrite-without-trace</li>
          <li className="flex items-start gap-2"><Brain className="mt-0.5 h-4 w-4 text-purple-500" /> index.md is read on every query — agent&apos;s mental model</li>
        </ul>
      </div>
    </div>
  );
}
```

  </src/app/pipeline/page.tsx>

  <src/app/wiki/page.tsx>

<a name="src-app-wiki-page-tsx"></a>
### `src/app/wiki/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { listWikiPages, getWikiPage, searchWiki } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

export default function WikiPage() {
  const isMobile = useIsMobile();
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ path: string; title: string; snippet: string; score: number }>>([]);

  useEffect(() => {
    listWikiPages().then(setPages);
  }, []);

  const handleSelectPage = async (path: string) => {
    setSelectedPage(path);
    const page = await getWikiPage(path);
    setContent(page.content);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const results = await searchWiki(searchQuery);
    setSearchResults(results);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">LLM Wiki</h2>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 pr-3"
            placeholder="Search wiki..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button onClick={handleSearch} className="rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90">
          Search
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Search Results</h3>
          {searchResults.map((r) => (
            <button
              key={r.path}
              onClick={() => handleSelectPage(r.path)}
              className="mb-2 block w-full rounded-lg p-2 text-left text-sm hover:bg-accent/50"
            >
              <p className="font-medium text-primary">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.snippet.slice(0, 120)}...</p>
            </button>
          ))}
        </div>
      )}

      <div className={isMobile ? "space-y-4" : "grid grid-cols-[280px_1fr] gap-6"}>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Pages</h3>
          <div className="space-y-1">
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => handleSelectPage(p)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                  selectedPage === p ? "bg-primary/10 text-primary" : "hover:bg-accent/50"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          {selectedPage ? (
            <>
              <h3 className="mb-3 font-semibold">{selectedPage}</h3>
              <pre className="whitespace-pre-wrap text-sm text-foreground">{content}</pre>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Select a page to view</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

  </src/app/wiki/page.tsx>

  <src/app/ai/page.tsx>

<a name="src-app-ai-page-tsx"></a>
### `src/app/ai/page.tsx`

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Bot, User, Sparkles, Copy, Check, Anchor,
  Volume2, ImageIcon, Loader2, ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResponsive } from "@/hooks/use-responsive";
import { throttledFetch } from "@/lib/throttledFetch";
import { API_BASE } from "@/lib/api";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  model?: string;
  streaming?: boolean;
}

interface Persona {
  id: string;
  username: string;
  nickname: string;
  position: string;
  category: string;
  model: string;
  greeting: string | null;
  about: string | null;
  allowed_tools: string[] | null;
  enabled: boolean;
}

/* ═══════════════════════════════════════════════════════════
 * Persona avatar colors — nautical chart palette
 * ═══════════════════════════════════════════════════════════ */
const PERSONA_COLORS: Record<string, string> = {
  Dex: "bg-sonar/20 text-sonar border-sonar/30",
  Viz: "bg-amber/20 text-amber border-amber/30",
  Avery: "bg-navy/30 text-foreground border-navy/30",
};
const PERSONA_INITIALS: Record<string, string> = {
  Dex: "DX",
  Viz: "VZ",
  Avery: "AV",
};

export default function AIChatPage() {
  const { isMobile } = useResponsive();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load personas on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await throttledFetch(`${API_BASE}/ai/personas`);
        const data = await res.json();
        const enabled = data.filter((p: Persona) => p.enabled);
        setPersonas(enabled);
        if (enabled.length > 0) {
          setSelectedPersona(enabled[0].id);
        }
      } catch (e) {
        console.error("Failed to load personas:", e);
        toast.error("Failed to load AI personas");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load greeting when persona changes
  useEffect(() => {
    if (!selectedPersona) return;
    const persona = personas.find((p) => p.id === selectedPersona);
    if (persona?.greeting) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: persona.greeting,
          created_at: new Date().toISOString(),
          model: persona.model,
        },
      ]);
    } else {
      setMessages([]);
    }
  }, [selectedPersona, personas]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedPersona || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Create placeholder for streaming response
    const assistantId = `stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        streaming: true,
      },
    ]);

    try {
      const res = await throttledFetch(`${API_BASE}/ai/chat/${selectedPersona}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, channel: "web" }),
      });

      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);

      const data = await res.json();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                id: data.message_id || assistantId,
                content: data.content,
                streaming: false,
                model: data.model,
              }
            : msg
        )
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `⚠️ Error: ${(e as Error).message}`,
                role: "system",
                streaming: false,
              }
            : msg
        )
      );
      toast.error("Chat request failed");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, selectedPersona, sending]);

  const handleCopy = useCallback(async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const currentPersona = personas.find((p) => p.id === selectedPersona);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="sonar-pulse flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Anchor className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            Initializing AI bridge...
          </span>
        </motion.div>
      </div>
    );
  }

  const personaColor = currentPersona
    ? PERSONA_COLORS[currentPersona.nickname] || "bg-primary/20 text-primary border-primary/30"
    : "";
  const personaInitials = currentPersona
    ? PERSONA_INITIALS[currentPersona.nickname] || currentPersona.nickname.slice(0, 2).toUpperCase()
    : "AI";

  return (
    <div
      className={
        isMobile
          ? "flex h-[calc(100vh-8rem)] flex-col"
          : "mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col"
      }
    >
      {/* ═══ Persona selector — glass header ═══ */}
      <div className="glass-card border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="sonar-pulse flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">AI Chat</h2>
              <p className="text-[10px] text-muted-foreground">Bridge Communications</p>
            </div>
          </div>
          {currentPersona && (
            <Badge variant="outline" className={`${personaColor} text-[10px]`}>
              {currentPersona.nickname} · {currentPersona.model}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {personas.map((p, i) => {
            const color = PERSONA_COLORS[p.nickname] || "bg-primary/20 text-primary border-primary/30";
            const initials = PERSONA_INITIALS[p.nickname] || p.nickname.slice(0, 2).toUpperCase();
            return (
              <motion.button
                key={p.id}
                onClick={() => setSelectedPersona(p.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                  selectedPersona === p.id
                    ? color
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-accent"
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                </Avatar>
                {p.nickname}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ═══ Messages area ═══ */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Assistant avatar */}
                {msg.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={`text-[10px] ${personaColor}`}>
                      {personaInitials}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Message bubble */}
                <div className="group relative max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.role === "system"
                        ? "bg-destructive/10 text-destructive rounded-bl-md border border-destructive/20"
                        : "glass-card rounded-bl-md"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-primary prose-code:before:content-[''] prose-code:after:content-['']">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Streaming indicator */}
                    {msg.streaming && (
                      <div className="mt-2 flex items-center gap-1">
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Copy button (assistant only) */}
                  {msg.role === "assistant" && !msg.streaming && msg.content && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="absolute -bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-accent group-hover:opacity-100"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Sending indicator */}
          {sending && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={`text-[10px] ${personaColor}`}>
                  {personaInitials}
                </AvatarFallback>
              </Avatar>
              <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing...
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* ═══ Input area — glass footer ═══ */}
      <div className="glass-card border-t px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentPersona ? `Ask ${currentPersona.nickname}...` : "Select a persona first"
              }
              disabled={!selectedPersona || sending}
              className="w-full rounded-xl border border-border bg-background/80 px-4 py-2.5 pr-10 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            {input && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">
                ↵
              </span>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || sending}
            className="rounded-xl px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">
            {currentPersona
              ? `${currentPersona.nickname} · ${currentPersona.position} · ${currentPersona.model}`
              : "Select a persona to start"}
          </p>
          {currentPersona?.allowed_tools && (
            <div className="flex gap-1">
              {currentPersona.allowed_tools.slice(0, 3).map((tool) => (
                <span
                  key={tool}
                  className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                >
                  {tool}
                </span>
              ))}
              {currentPersona.allowed_tools.length > 3 && (
                <span className="text-[9px] text-muted-foreground/50">
                  +{currentPersona.allowed_tools.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

  </src/app/ai/page.tsx>

  <src/app/erp/projects/page.tsx>

<a name="src-app-erp-projects-page-tsx"></a>
### `src/app/erp/projects/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await throttledFetch(`${API_BASE}/erp/projects`);
        if (res.ok) setProjects(unwrapPaginated(await res.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading projects...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <FolderKanban className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Projects & Operations</h2>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Projects</h3></div>
        {projects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No projects yet</div>
        ) : (
          <div className="divide-y text-sm">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.project_type} · Day rate: {p.day_rate || "TBD"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "active" ? "bg-primary/15 text-primary" :
                  p.status === "completed" ? "bg-primary/15 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

  </src/app/erp/projects/page.tsx>

  <src/app/erp/accounts/page.tsx>

<a name="src-app-erp-accounts-page-tsx"></a>
### `src/app/erp/accounts/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { DollarSign } from "lucide-react";

export default function AccountsPage() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [accRes, invRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/accounts`),
          throttledFetch(`${API_BASE}/erp/invoices`),
        ]);
        if (accRes.ok) setAccounts(unwrapPaginated(await accRes.json()));
        if (invRes.ok) setInvoices(unwrapPaginated(await invRes.json()));
      } catch (e) {
        console.error("Failed to load accounts:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading accounts...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Accounts</h2>
        </div>
      </div>

      {/* Stats */}
      <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "grid grid-cols-4 gap-4 mb-6"}>
        {[
          { label: "Accounts", value: accounts.length, color: "text-primary" },
          { label: "Invoices", value: invoices.length, color: "text-sonar" },
          { label: "Receivable", value: "AED 0", color: "text-amber" },
          { label: "VAT (5%)", value: "UAE", color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Chart of Accounts</h3>
        </div>
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No accounts yet</div>
        ) : isMobile ? (
          <div className="divide-y">
            {accounts.map((a) => (
              <div key={a.id} className="p-3">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.account_type} · Balance: {a.balance || 0}</p>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2">Currency</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-foreground">{a.account_type}</td>
                  <td className="px-4 py-3 text-foreground">{a.balance || 0}</td>
                  <td className="px-4 py-3 text-foreground">{a.currency || "AED"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Recent Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No invoices yet</div>
        ) : (
          <div className="divide-y text-sm">
            {invoices.slice(0, 10).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{inv.customer_name || "Invoice"}</p>
                  <p className="text-xs text-muted-foreground">{inv.status}</p>
                </div>
                <span className="font-medium text-sonar">AED {inv.total_amount || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

  </src/app/erp/accounts/page.tsx>

  <src/app/erp/procurement/page.tsx>

<a name="src-app-erp-procurement-page-tsx"></a>
### `src/app/erp/procurement/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { ShoppingCart } from "lucide-react";

export default function ProcurementPage() {
  const isMobile = useIsMobile();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, oRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/suppliers`),
          throttledFetch(`${API_BASE}/erp/purchase-orders`),
        ]);
        if (sRes.ok) setSuppliers(unwrapPaginated(await sRes.json()));
        if (oRes.ok) setOrders(unwrapPaginated(await oRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading procurement...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-sonar" />
        <h2 className="text-2xl font-bold">Procurement</h2>
      </div>

      <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "grid grid-cols-3 gap-4 mb-6"}>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Suppliers</p>
          <p className="text-xl font-bold text-sonar">{suppliers.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Purchase Orders</p>
          <p className="text-xl font-bold text-primary">{orders.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Material Requests</p>
          <p className="text-xl font-bold text-amber">0</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Suppliers</h3></div>
        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No suppliers registered</div>
        ) : (
          <div className="divide-y text-sm">
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.country || "Unknown"} · {s.supplier_type || "General"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{s.email || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

  </src/app/erp/procurement/page.tsx>

  <src/app/erp/hr/page.tsx>

<a name="src-app-erp-hr-page-tsx"></a>
### `src/app/erp/hr/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { Users, AlertTriangle } from "lucide-react";

export default function HRPage() {
  const isMobile = useIsMobile();
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/personnel`),
          throttledFetch(`${API_BASE}/erp/personnel/compliance-alerts`),
        ]);
        if (pRes.ok) setPersonnel(unwrapPaginated(await pRes.json()));
        if (aRes.ok) setAlerts(unwrapPaginated(await aRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading HR...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">HR & Compliance</h2>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/20 bg-amber/10 p-4">
          <div className="flex items-center gap-2 text-amber">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">{alerts.length} compliance alerts</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Personnel</h3></div>
        {personnel.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No personnel registered</div>
        ) : (
          <div className="divide-y text-sm">
            {personnel.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.designation} · {p.department || "No dept"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

  </src/app/erp/hr/page.tsx>

  <src/app/erp/stock/page.tsx>

<a name="src-app-erp-stock-page-tsx"></a>
### `src/app/erp/stock/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { Package } from "lucide-react";

export default function StockPage() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [iRes, wRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/items`),
          throttledFetch(`${API_BASE}/erp/warehouses`),
        ]);
        if (iRes.ok) setItems(unwrapPaginated(await iRes.json()));
        if (wRes.ok) setWarehouses(unwrapPaginated(await wRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading stock...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Stock & Inventory</h2>
      </div>

      <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "grid grid-cols-3 gap-4 mb-6"}>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="text-xl font-bold text-primary">{items.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Warehouses</p>
          <p className="text-xl font-bold text-sonar">{warehouses.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valuation</p>
          <p className="text-xl font-bold text-primary">FIFO / Avg</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Items</h3></div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No items registered</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Group</th><th className="px-4 py-2">UOM</th></tr>
            </thead>
            <tbody className="divide-y">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-foreground">{i.item_group}</td>
                  <td className="px-4 py-3 text-foreground">{i.uom || "Nos"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

  </src/app/erp/stock/page.tsx>

  <src/app/erp/assets/page.tsx>

<a name="src-app-erp-assets-page-tsx"></a>
### `src/app/erp/assets/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { Wrench, AlertTriangle } from "lucide-react";

export default function AssetsPage() {
  const isMobile = useIsMobile();
  const [assets, setAssets] = useState<any[]>([]);
  const [calibrationDue, setCalibrationDue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, cRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/assets`),
          throttledFetch(`${API_BASE}/erp/assets/calibration-due`),
        ]);
        if (aRes.ok) setAssets(unwrapPaginated(await aRes.json()));
        if (cRes.ok) setCalibrationDue(unwrapPaginated(await cRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading assets...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Wrench className="h-6 w-6 text-amber" />
        <h2 className="text-2xl font-bold">Assets & Equipment</h2>
      </div>

      {calibrationDue.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/20 bg-amber/10 p-4">
          <div className="flex items-center gap-2 text-amber">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">{calibrationDue.length} assets have calibration due</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Assets</h3></div>
        {assets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No assets registered</div>
        ) : (
          <div className="divide-y text-sm">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.asset_type} · {a.location || "No location"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  a.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

  </src/app/erp/assets/page.tsx>

  <src/app/enquiries/page.tsx>

<a name="src-app-enquiries-page-tsx"></a>
### `src/app/enquiries/page.tsx`

```tsx
"use client";

import { useIsMobile } from "@/hooks/use-responsive";
import { useEnquiries } from "@/lib/api";
import { EnquiryRead, STATUS_COLORS } from "@/types/api";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function EnquiriesPage() {
  const isMobile = useIsMobile();
  const { data: enquiries, error, isLoading } = useEnquiries();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Enquiries</h2>
        <Link href="/enquiries/new" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error.message}</div>
      ) : !enquiries?.length ? (
        <div className="py-12 text-center text-muted-foreground">
          No enquiries yet.{" "}
          <Link href="/enquiries/new" className="text-primary underline">Create one</Link>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {enquiries.map((e: EnquiryRead) => (
            <Link key={e.id} href={`/enquiries/${e.id}`} className="block rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{e.client_name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[e.status]}`}>
                  {e.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{e.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Industry</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enquiries.map((e: EnquiryRead) => (
                <tr key={e.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/enquiries/${e.id}`} className="font-medium text-primary hover:underline">{e.client_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{e.industry || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{e.channel}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[e.status]}`}>
                      {e.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

  </src/app/enquiries/page.tsx>

  <src/app/enquiries/new/page.tsx>

<a name="src-app-enquiries-new-page-tsx"></a>
### `src/app/enquiries/new/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEnquiry } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-responsive";
import type { EnquiryCreate } from "@/types/api";

export default function NewEnquiryPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<EnquiryCreate>({
    client_name: "",
    client_email: "",
    channel: "web",
    industry: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const enquiry = await createEnquiry(form);
      router.push(`/enquiries/${enquiry.id}`);
    } catch (err) {
      toast.error("Failed to create enquiry: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={isMobile ? "" : "mx-auto max-w-2xl"}>
      <h2 className="mb-6 text-2xl font-bold">New Enquiry</h2>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Client Name *</label>
          <Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="e.g. Acme Corp" />
        </div>
        <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
          <div>
            <label className="mb-1 block text-sm font-medium">Client Email</label>
            <Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="contact@acme.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Channel</label>
            <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as EnquiryCreate["channel"] })}>
              <option value="web">Web / ERP</option>
              <option value="email">Email / Outlook</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Industry</label>
          <Input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Manufacturing, Maritime, Oil & Gas" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description *</label>
          <textarea required rows={6} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the client's requirements, scope, and any relevant context..." />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent/50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

  </src/app/enquiries/new/page.tsx>

  <src/app/enquiries/[id]/page.tsx>

<a name="src-app-enquiries-id-page-tsx"></a>
### `src/app/enquiries/[id]/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-responsive";
import { useEnquiry, runPipeline, approveEnquiry, executeEnquiry, uploadDocument, API_BASE } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { EnquiryRead, STATUS_COLORS, DocumentRead } from "@/types/api";
import { ArrowLeft, Play, CheckCircle, Upload, Zap, FileText, Loader2, Image } from "lucide-react";
import { toast } from "sonner";

interface ExecutionItem { system: string; success: boolean; message: string }

export default function EnquiryDetailPage() {
  const isMobile = useIsMobile();
  const { id } = useParams();
  const router = useRouter();
  const { data: enquiry, error, isLoading, mutate } = useEnquiry(id as string);
  const [pipelineResult, setPipelineResult] = useState<{ [key: string]: unknown } | null>(null);
  const [executionResult, setExecutionResult] = useState<{ executions: ExecutionItem[] } | null>(null);
  const [acting, setActing] = useState(false);
  const [documents, setDocuments] = useState<DocumentRead[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  // Load documents for this enquiry
  useEffect(() => {
    if (!id) return;
    const loadDocs = async () => {
      try {
        const res = await throttledFetch(`${API_BASE}/documents/${id}`);
        if (res.ok) setDocuments(await res.json());
      } catch (e) { console.error("Failed to load documents:", e); }
      finally { setDocsLoading(false); }
    };
    loadDocs();
  }, [id, acting]); // re-fetch after upload (acting goes false→true→false)

  const handleRunPipeline = async () => {
    setActing(true);
    try {
      const result = await runPipeline(id as string);
      setPipelineResult(result as unknown as { [key: string]: unknown });
      await mutate();
    } catch (e) { toast.error((e as Error).message); } finally { setActing(false); }
  };

  const handleApprove = async () => {
    setActing(true);
    try { await approveEnquiry(id as string, "Current User"); await mutate(); } finally { setActing(false); }
  };

  const handleExecute = async () => {
    setActing(true);
    try { const r = await executeEnquiry(id as string); setExecutionResult(r as any); await mutate(); } finally { setActing(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActing(true);
    try { await uploadDocument(id as string, file); toast.success("Document uploaded and ingested!"); } catch (err) { toast.error("Upload failed: " + (err as Error).message); } finally { setActing(false); }
  };

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (error) return <div className="py-12 text-center text-red-500">{error.message}</div>;
  if (!enquiry) return <div className="py-12 text-center text-muted-foreground">Enquiry not found</div>;

  const canRunPipeline = ["draft", "ingested"].includes(enquiry.status);
  const canApprove = ["policy_review", "llm_drafted"].includes(enquiry.status);
  const canExecute = enquiry.status === "approved";

  const isImage = (ct: string) => ct.startsWith("image/");

  return (
    <div className={isMobile ? "" : "mx-auto max-w-4xl"}>
      <button onClick={() => router.back()} className="mb-4 flex h-10 w-10 items-center justify-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{enquiry.client_name}</h2>
          <p className="text-sm text-muted-foreground">{enquiry.enquiry_number || "No enquiry number"} · <span className={STATUS_COLORS[enquiry.status]}>{enquiry.status.replace(/_/g, " ")}</span></p>
        </div>
        <div className="flex gap-2">
          {canRunPipeline && <button onClick={handleRunPipeline} disabled={acting} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Play className="h-4 w-4" /> Run AI Pipeline</button>}
          {canApprove && <button onClick={handleApprove} disabled={acting} className="flex items-center gap-1 rounded-lg bg-sonar px-3 py-2 text-sm text-white hover:bg-sonar/90 disabled:opacity-50"><CheckCircle className="h-4 w-4" /> Approve</button>}
          {canExecute && <button onClick={handleExecute} disabled={acting} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Zap className="h-4 w-4" /> Execute</button>}
          <label className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent/50"><Upload className="h-4 w-4" /> Upload Doc<input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.xlsx,.pptx,.csv,.jpg,.jpeg,.png,.gif,.webp,.tiff,.bmp" /></label>
        </div>
      </div>

      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">Enquiry Details</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Industry</dt><dd>{enquiry.industry || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Channel</dt><dd>{enquiry.channel}</dd></div>
            <div><dt className="text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap">{enquiry.description}</dd></div>
            {(enquiry.scope_category || enquiry.complexity) && (<>
              <div><dt className="text-muted-foreground">Category</dt><dd>{enquiry.scope_category}</dd></div>
              <div><dt className="text-muted-foreground">Complexity</dt><dd>{enquiry.complexity}</dd></div>
            </>)}
          </dl>
        </div>

        {/* Documents List */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">Documents</h3>
          {docsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  {isImage(doc.content_type) ? (
                    <Image className="h-4 w-4 shrink-0 text-amber" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.content_type} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    doc.processing_status === "completed" ? "bg-sonar/15 text-sonar" :
                    doc.processing_status === "failed" ? "bg-destructive/15 text-destructive" :
                    "bg-amber/15 text-amber"
                  }`}>{doc.processing_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {pipelineResult && (
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-semibold">AI Pipeline Output</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-primary">Status: {String(pipelineResult.status)?.replace(/_/g, " ")}</p>
                <p className="text-foreground">{String(pipelineResult.message)}</p>
              </div>
              {Boolean(pipelineResult.rules_output) && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium">Rules Output</p>
                  <pre className="mt-1 text-xs">{JSON.stringify(pipelineResult.rules_output, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {Boolean(pipelineResult?.llm_draft) && (
          <div className="col-span-2 rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-semibold">AI Draft Proposal</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{String(pipelineResult?.llm_draft ?? "")}</div>
          </div>
        )}

        {executionResult && (
          <div className="col-span-2 rounded-xl border bg-primary/10 p-5">
            <h3 className="mb-3 font-semibold text-primary">Execution Results</h3>
            <div className="space-y-2">
              {executionResult.executions?.map((r) => (
                <div key={r.system} className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${r.success ? "text-sonar" : "text-destructive"}`} />
                  <span className="font-medium">{r.system}</span>
                  <span className="text-foreground">{r.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

  </src/app/enquiries/[id]/page.tsx>

  <src/components/error-boundary.tsx>

<a name="src-components-error-boundary-tsx"></a>
### `src/components/error-boundary.tsx`

```tsx
"use client";

import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RotateCcw className="h-3 w-3" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

  </src/components/error-boundary.tsx>

  <src/components/app-layout.tsx>

<a name="src-components-app-layout-tsx"></a>
### `src/components/app-layout.tsx`

```tsx
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useResponsive } from "@/hooks/use-responsive";
import { Sidebar } from "@/components/desktop/sidebar";
import { MobileTopBar, MobileBottomNav } from "@/components/mobile/mobile-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { breakpoint, isDesktop, isMobile, mounted } = useResponsive();
  const [collapsed, setCollapsed] = useState(false);

  // SSR-safe: render nothing layout-specific until client mounts
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-primary" />
            <span className="text-sm font-medium text-muted-foreground">Loading Aries...</span>
          </div>
        </div>
      </div>
    );
  }

  const sidebarWidth = isDesktop
    ? (collapsed ? 64 : 256)
    : 64; // tablet = always collapsed

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {isMobile ? (
          /* ═══ Mobile: Split nav (top bar + bottom tabs) ═══ */
          <div className="relative min-h-screen">
            <MobileTopBar />
            <main className="pt-[60px] pb-20 px-4 py-4">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <MobileBottomNav />
          </div>
        ) : (
          /* ═══ Desktop/Tablet: Collapsible sidebar ═══ */
          <div className="relative min-h-screen">
            <Sidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed(!collapsed)}
              mode={isDesktop ? "desktop" : "tablet"}
            />
            <motion.main
              className="min-h-screen p-6 lg:p-8"
              animate={{ marginLeft: sidebarWidth }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <ErrorBoundary>{children}</ErrorBoundary>
            </motion.main>
          </div>
        )}
      </div>
      <Toaster
        position={isMobile ? "top-center" : "bottom-right"}
        richColors
        closeButton
        theme="system"
      />
    </TooltipProvider>
  );
}
```

  </src/components/app-layout.tsx>

  <src/components/desktop/sidebar.tsx>

<a name="src-components-desktop-sidebar-tsx"></a>
### `src/components/desktop/sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Home, BookOpen, Bot, Package, Users,
  DollarSign, Wrench, FolderKanban, ShoppingCart, Settings,
  ChevronLeft, ChevronRight, Anchor, Moon, Sun,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/hooks/use-responsive";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home, group: "nav" },
  { href: "/enquiries", label: "Enquiries", icon: FileText, group: "nav" },
  { href: "/wiki", label: "Wiki", icon: BookOpen, group: "nav" },
  { href: "/ai", label: "AI Chat", icon: Bot, group: "nav" },
  { href: "/erp/accounts", label: "Accounts", icon: DollarSign, group: "erp" },
  { href: "/erp/assets", label: "Assets", icon: Wrench, group: "erp" },
  { href: "/erp/stock", label: "Stock", icon: Package, group: "erp" },
  { href: "/erp/projects", label: "Projects", icon: FolderKanban, group: "erp" },
  { href: "/erp/hr", label: "HR", icon: Users, group: "erp" },
  { href: "/erp/procurement", label: "Procurement", icon: ShoppingCart, group: "erp" },
  { href: "/settings", label: "Settings", icon: Settings, group: "system" },
];

const GROUPS: Record<string, string> = {
  nav: "Navigation",
  erp: "Operations",
  system: "System",
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mode: "desktop" | "tablet"; // desktop = toggleable, tablet = always-collapsed
}

export function Sidebar({ collapsed, onToggle, mode }: SidebarProps) {
  const pathname = usePathname();
  const { dark, toggle: toggleDark } = useDarkMode();
  const isCollapsed = mode === "tablet" || collapsed;
  const showToggle = mode === "desktop";

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
                  const link = (
                    <Link
                      key={item.href}
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
                  return link;
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
              v0.1.0 — Gemini + MCP
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
```

  </src/components/desktop/sidebar.tsx>

  <src/components/mobile/mobile-nav.tsx>

<a name="src-components-mobile-mobile-nav-tsx"></a>
### `src/components/mobile/mobile-nav.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileText, Home, Bot, BookOpen, Package,
  Anchor, ChevronLeft, Menu, Moon, Sun,
  DollarSign, Wrench, FolderKanban, Users, ShoppingCart,
} from "lucide-react";
import { useDarkMode } from "@/hooks/use-responsive";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const BOTTOM_TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/enquiries", label: "Enquiries", icon: FileText },
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/erp/stock", label: "Stock", icon: Package },
];

const MORE_ITEMS = [
  { href: "/erp/accounts", label: "Accounts", icon: DollarSign },
  { href: "/erp/assets", label: "Assets", icon: Wrench },
  { href: "/erp/projects", label: "Projects", icon: FolderKanban },
  { href: "/erp/hr", label: "HR", icon: Users },
  { href: "/erp/procurement", label: "Procurement", icon: ShoppingCart },
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
            <nav className="mt-4 space-y-1">
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
```

  </src/components/mobile/mobile-nav.tsx>

  <src/hooks/use-responsive.ts>

<a name="src-hooks-use-responsive-ts"></a>
### `src/hooks/use-responsive.ts`

```ts
"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
 * Three-tier responsive hook — Nautical bridge layout
 *
 * Desktop (≥1024px): Full sidebar with collapsible toggle
 * Tablet (640–1023px): Icon-only sidebar, no toggle
 * Mobile (<640px): Split nav — top bar + bottom tabs
 * ═══════════════════════════════════════════════════════════ */

type Breakpoint = "desktop" | "tablet" | "mobile";

export function useResponsive() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) setBreakpoint("desktop");
      else if (w >= 640) setBreakpoint("tablet");
      else setBreakpoint("mobile");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    breakpoint,
    isDesktop: mounted ? breakpoint === "desktop" : true,  // SSR-safe default
    isTablet: mounted ? breakpoint === "tablet" : false,
    isMobile: mounted ? breakpoint === "mobile" : false,
    mounted,
  };
}

/* Dark mode hook — persists to localStorage */
export function useDarkMode() {
  const [dark, setDark] = useState(false); // Default light mode

  useEffect(() => {
    const stored = localStorage.getItem("aries-dark-mode");
    if (stored !== null) {
      setDark(stored === "true");
    }
    // Apply class immediately
    document.documentElement.classList.toggle("dark", stored !== null ? stored === "true" : false);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("aries-dark-mode", String(next));
      return next;
    });
  }, []);

  return { dark, toggle };
}

/* Legacy compat — used by pages still importing from use-mobile */
export function useIsMobile() {
  const { isMobile } = useResponsive();
  return isMobile;
}
```

  </src/hooks/use-responsive.ts>

</frontend>