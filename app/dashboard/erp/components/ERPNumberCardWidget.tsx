'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { resolveNumberCard, type NumberCardConfig } from '@/lib/erpnext/chart-engine';
import { formatNumber } from '@/lib/erpnext/locale';

interface ERPNumberCardWidgetProps {
  config: NumberCardConfig;
}

export default function ERPNumberCardWidget({ config }: ERPNumberCardWidgetProps) {
  const [value, setValue] = useState<number | null>(null);
  const [trend, setTrend] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await resolveNumberCard(config);
      if (result.success && result.value !== undefined) {
        setValue(result.value);
        setTrend(result.trend ?? null);
        setError(null);
      } else {
        setError(result.error ?? 'Failed to load');
      }
    });
  }, [config.name, config.doctype, config.aggregation]);

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {config.cardName}
        </p>
        {pending && value === null ? (
          <div className="mt-2 flex items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        ) : (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {value !== null ? formatNumber(value, value % 1 !== 0 ? 2 : 0) : '—'}
            </span>
            {trend !== null && (
              <span className={`inline-flex items-center text-xs font-medium ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {trend > 0 ? <TrendingUp className="mr-0.5 h-3 w-3" /> : trend < 0 ? <TrendingDown className="mr-0.5 h-3 w-3" /> : <Minus className="mr-0.5 h-3 w-3" />}
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}