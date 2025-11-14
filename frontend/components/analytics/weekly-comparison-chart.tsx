'use client';

import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface WeeklyComparisonChartProps {
  data: any[];
}

export function WeeklyComparisonChart({ data }: WeeklyComparisonChartProps) {
  // Transform data for weekly comparison
  const chartData = data.slice(0, 8).map((item) => {
    const weekStart = new Date(item.weekStart || item.date);
    const weekEnd = endOfWeek(weekStart);

    return {
      week: `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'dd')}`,
      spent: item.totalSpentCents / 100,
      budget: item.budgetCents ? item.budgetCents / 100 : 0,
      savings: item.budgetCents ? (item.budgetCents - item.totalSpentCents) / 100 : 0,
    };
  }).reverse(); // Show oldest to newest

  const formatCurrency = (value: number) => `₱${value.toFixed(0)}`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">{payload[0].payload.week}</p>
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
          <h3 className="text-lg font-semibold text-gray-900">Weekly Comparison</h3>
          <p className="text-sm text-gray-600 mt-1">Compare weekly spending vs budget</p>
        </div>
        <div className="rounded-full bg-green-100 p-2">
          <Calendar className="h-5 w-5 text-green-600" />
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              stroke="#e5e7eb"
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#e5e7eb"
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="rect"
            />
            <Bar dataKey="spent" fill="#3b82f6" name="Spent" radius={[4, 4, 0, 0]} />
            <Bar dataKey="budget" fill="#10b981" name="Budget" radius={[4, 4, 0, 0]} />
            <Bar dataKey="savings" fill="#8b5cf6" name="Savings" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <p>No weekly data available</p>
        </div>
      )}

      {/* Summary Stats */}
      {chartData.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Spent</p>
            <p className="text-lg font-semibold text-blue-600">
              ₱{chartData.reduce((sum, item) => sum + item.spent, 0).toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Budget</p>
            <p className="text-lg font-semibold text-green-600">
              ₱{chartData.reduce((sum, item) => sum + item.budget, 0).toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Savings</p>
            <p className="text-lg font-semibold text-purple-600">
              ₱{chartData.reduce((sum, item) => sum + item.savings, 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
