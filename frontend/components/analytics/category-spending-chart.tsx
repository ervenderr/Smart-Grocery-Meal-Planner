'use client';

import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Package } from 'lucide-react';

interface CategorySpendingChartProps {
  data: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function CategorySpendingChart({ data }: CategorySpendingChartProps) {
  // Transform data for chart
  const chartData = data.slice(0, 8).map((item) => ({
    name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
    value: item.totalSpentCents / 100, // Convert to pesos
    percentage: item.percentage,
    count: item.itemCount,
  }));

  const totalSpent = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-1">{data.name}</p>
          <p className="text-sm text-gray-600">
            Amount: <span className="font-semibold text-gray-900">₱{data.value.toFixed(2)}</span>
          </p>
          <p className="text-sm text-gray-600">
            Items: <span className="font-semibold text-gray-900">{data.count}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-semibold text-gray-900">{data.percentage.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 5) return null; // Don't show label for small slices

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${percentage.toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
          <p className="text-sm text-gray-600 mt-1">Spending by category</p>
        </div>
        <div className="rounded-full bg-purple-100 p-2">
          <Package className="h-5 w-5 text-purple-600" />
        </div>
      </div>

      {chartData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-gray-700 truncate">{item.name}</span>
                <span className="text-xs text-gray-500 ml-auto">₱{item.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <p>No category data available</p>
        </div>
      )}
    </Card>
  );
}
