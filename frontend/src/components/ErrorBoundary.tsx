import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In production, send to error tracking service (e.g., Sentry)
    if (import.meta.env.PROD) {
      // TODO: Send to Sentry or other error tracking
      // Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen w-full medical-mesh-bg flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-8 text-center animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white mb-4">Xatolik yuz berdi</h2>
            <p className="text-slate-300 mb-6">
              Kechirasiz, dasturda xatolik yuz berdi. Sahifani yangilab ko'ring.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
            >
              Sahifani yangilash
            </button>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-slate-400 cursor-pointer">Xatolik tafsilotlari (dev)</summary>
                <pre className="mt-2 text-xs text-red-400 overflow-auto p-4 bg-black/20 rounded">
                  {this.state.error.toString()}
                  {this.state.error.stack}
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

export default ErrorBoundary;
