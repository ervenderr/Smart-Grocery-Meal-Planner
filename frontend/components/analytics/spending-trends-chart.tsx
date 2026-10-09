'use client';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { toTrendChartPoints } from '@/lib/analytics/chart-data';
import { useCurrency } from '@/lib/currency/currency-provider';

interface SpendingTrendsChartProps {
  data: unknown;
  dateRange?: string;
}

export function SpendingTrendsChart({ data }: SpendingTrendsChartProps) {
  const { format: formatMoney, compact } = useCurrency();
  const chartData = toTrendChartPoints(data);

  const formatAxis = (value: number) => compact(Math.round(value * 100));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">{payload[0].payload.fullLabel}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{formatMoney(Math.round(entry.value * 100))}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Spending Trends</h3>
          <p className="text-sm text-gray-600 mt-1">Track your spending over time</p>
        </div>
        <div className="rounded-full bg-blue-100 p-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="h-60 min-w-0 sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 14, fill: '#6b7280' }}
              stroke="#e5e7eb"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 14, fill: '#6b7280' }}
              stroke="#e5e7eb"
              width={56}
              tickFormatter={formatAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="spent"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Spent"
            />
            {chartData.some(d => d.budget !== null) && (
              <Line
                type="monotone"
                dataKey="budget"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#10b981', r: 4 }}
                name="Budget"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-60 text-gray-500 sm:h-[300px]">
          <p>No spending data available for this period</p>
        </div>
      )}
    </Card>
  );
}
