'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ChartBoundaryProps {
  title: string;
  children: React.ReactNode;
}

interface ChartBoundaryState {
  hasError: boolean;
}

/**
 * Isolates a single analytics widget: if it throws while rendering, only that
 * card shows a fallback instead of taking down the whole page.
 */
export class ChartBoundary extends React.Component<ChartBoundaryProps, ChartBoundaryState> {
  state: ChartBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChartBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`Analytics widget "${this.props.title}" failed:`, error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Card className="min-w-0 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900">{this.props.title}</h3>
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-gray-500">
          <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />
          <p className="text-sm">This chart could not be displayed.</p>
        </div>
      </Card>
    );
  }
}
