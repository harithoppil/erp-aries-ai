'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  BarChart3, Users, Package, ShoppingCart, FileText, Building2,
  ArrowRight, TrendingUp,
} from 'lucide-react';
import {
  fetchDashboardData,
  type NumberCardData,
  type ChartDataPoint,
  type DashboardResult,
} from '@/app/dashboard/erp/dashboard-actions';

function CardIcon({ doctype }: { doctype: string }): JSX.Element {
  if (doctype.includes('customer') || doctype.includes('supplier') || doctype.includes('employee'))
    return <Users className="h-5 w-5" />;
  if (doctype.includes('item') || doctype.includes('product'))
    return <Package className="h-5 w-5" />;
  if (doctype.includes('sales') || doctype.includes('purchase') || doctype.includes('order') || doctype.includes('invoice'))
    return <ShoppingCart className="h-5 w-5" />;
  if (doctype.includes('payment') || doctype.includes('journal'))
    return <FileText className="h-5 w-5" />;
  if (doctype.includes('company') || doctype.includes('account'))
    return <Building2 className="h-5 w-5" />;
  return <BarChart3 className="h-5 w-5" />;
}

const CARD_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-lime-50 text-lime-700 border-lime-200',
  'bg-violet-50 text-violet-700 border-violet-200',
];

function MiniBarChart({ data }: { data: ChartDataPoint[] }): JSX.Element {
  if (data.length === 0) return <div className="text-xs text-muted-foreground">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{d.label}</span>
          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Skeletons ────────────────────────────────────────────────────────────────

function DashboardCardSkeleton(): JSX.Element {
  return (
    <Card className="border">
      <CardContent className="p-4">
        <Skeleton className="h-5 w-5 mb-2 rounded" />
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function DashboardChartSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton({ isMobile }: { isMobile: boolean }): JSX.Element {
  const gridCols = isMobile ? 'grid-cols-2' : 'grid-cols-6';
  return (
    <div className="space-y-6">
      <div className={`grid ${gridCols} gap-3`}>
        {Array(6).fill(0).map((_, i) => <DashboardCardSkeleton key={i} />)}
      </div>
      <div className={isMobile ? 'space-y-4' : 'grid grid-cols-3 gap-4'}>
        {Array(3).fill(0).map((_, i) => <DashboardChartSkeleton key={i} />)}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ERPDashboard(): JSX.Element {
  const [cards, setCards] = useState<NumberCardData[]>([]);
  const [charts, setCharts] = useState<{ label: string; type: string; data: ChartDataPoint[]; doctype: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  useEffect(() => {
    fetchDashboardData().then((result: DashboardResult) => {
      if (result.success) {
        setCards(result.cards);
        setCharts(result.charts);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <DashboardSkeleton isMobile={isMobile} />;
  }

  const cardGrid = isMobile ? 'grid-cols-2' : 'grid-cols-6';
  const chartGrid = isMobile ? 'grid-cols-1' : 'grid-cols-3';

  return (
    <div className="space-y-6">
      {/* Number cards */}
      <div className={`grid ${cardGrid} gap-3`}>
        {cards.map((card, i) => (
          <Card
            key={card.doctype}
            className={`cursor-pointer hover:shadow-md transition-shadow border ${CARD_COLORS[i % CARD_COLORS.length]}`}
            onClick={() => router.push(`/dashboard/erp/${card.doctype}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CardIcon doctype={card.doctype} />
                <ArrowRight className="h-3 w-3 opacity-50" />
              </div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs mt-0.5 opacity-80">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {charts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Breakdown Charts
          </h2>
          <div className={`grid ${chartGrid} gap-4`}>
            {charts.map((chart) => (
              <Card key={chart.label} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/dashboard/erp/${chart.doctype}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {chart.label}
                    <Badge variant="outline" className="text-[10px]">{chart.doctype}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniBarChart data={chart.data} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
