import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl text-center space-y-8">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
              <ExclamationTriangleIcon className="w-10 h-10 text-rose-600" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                We encountered an unexpected error. Don't worry - your data is safe.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-50 rounded-2xl p-6 text-left">
                <p className="text-xs font-mono text-slate-600 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
              >
                <ArrowPathIcon className="w-5 h-5" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold hover:border-slate-300 transition-all"
              >
                Reload Application
              </button>
            </div>

            <p className="text-xs text-slate-400">
              If this problem persists, please contact support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
