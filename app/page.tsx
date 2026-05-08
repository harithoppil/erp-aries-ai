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
import { usePageContext } from "@/hooks/usePageContext";

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

  // Feed page context to AI chat panel
  const contextSummary = enquiries
    ? `Dashboard: ${stats.total} total enquiries, ${stats.active} active, ${stats.pendingReview} pending review, ${stats.completed} completed. Recent: ${enquiries.slice(0, 3).map((e) => `${e.client_name} (${e.status})`).join(", ")}`
    : "Dashboard: Loading data...";
  usePageContext(contextSummary);

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
