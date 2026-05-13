'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { resolveChartData, type DashboardChartConfig, type ChartDataPoint } from '@/lib/erpnext/chart-engine';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6d28d9', '#7c3aed', '#4f46e5', '#4338ca', '#3730a3'];

interface ERPChartWidgetProps {
  config: DashboardChartConfig;
}

export default function ERPChartWidget({ config }: ERPChartWidgetProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await resolveChartData(config);
      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error ?? 'Failed to load chart data');
      }
    });
  }, [config.name, config.doctype, config.groupField]);

  if (pending && data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{config.chartName}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{config.chartName}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-sm text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  const renderPieLabel = (props: { name?: string; percent?: number }) => {
    const name = String(props.name ?? '');
    const percent = Number(props.percent ?? 0);
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{config.chartName}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          {config.chartType === 'Bar' ? (
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                {data.map((_entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : config.chartType === 'Line' ? (
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={config.chartType === 'Donut' ? 50 : 0}
                outerRadius={80}
                paddingAngle={2}
                label={renderPieLabel}
              >
                {data.map((_entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}