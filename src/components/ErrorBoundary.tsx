import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
              <span className="text-3xl">⚠</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2 font-[family-name:var(--font-display)]">Something went wrong</h1>
            <p className="text-slate-600 mb-4">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-900 text-white rounded-xl hover:bg-emerald-800 transition-colors font-bold"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <details className="mt-4 text-left text-sm text-slate-500">
                <summary className="cursor-pointer mb-2">Error Details</summary>
                <pre className="bg-slate-100 p-2 rounded-lg overflow-auto max-h-48">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}