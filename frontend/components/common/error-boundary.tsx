'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNative } from '@/lib/platform/native';
import { navigate } from '@/lib/platform/navigation';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  private reset(): void {
    this.setState({ hasError: false, error: null });
  }

  private handleRetry = (): void => {
    if (isNative()) this.reset();
    else window.location.reload();
  };

  private handleGoHome = (): void => {
    if (isNative()) {
      navigate('/', { replace: true });
      this.reset();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-gray-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-600">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 rounded-lg bg-gray-100 p-4 text-left">
                <p className="text-xs font-mono text-red-600">{this.state.error.message}</p>
                <pre className="mt-2 overflow-auto text-xs text-gray-700">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
            <div className="mt-6 flex gap-3 justify-center">
              <Button
                onClick={this.handleRetry}
                variant="primary"
              >
                Refresh Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
