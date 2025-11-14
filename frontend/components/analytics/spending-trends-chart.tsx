'use client';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface SpendingTrendsChartProps {
  data: any[];
  dateRange: string;
}

export function SpendingTrendsChart({ data, dateRange }: SpendingTrendsChartProps) {
  // Transform data for chart
  const chartData = data.map((item) => ({
    date: format(new Date(item.weekStart || item.date), 'MMM dd'),
    spent: item.totalSpentCents / 100, // Convert cents to pesos
    budget: item.budgetCents ? item.budgetCents / 100 : null,
  }));

  const formatCurrency = (value: number) => `₱${value.toFixed(0)}`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">{payload[0].payload.date}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">₱{entry.value.toFixed(2)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#e5e7eb"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#e5e7eb"
              tickFormatter={formatCurrency}
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
      ) : (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <p>No spending data available for this period</p>
        </div>
      )}
    </Card>
  );
}
