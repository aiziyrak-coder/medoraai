import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import ErrorFallbackUI from './ErrorFallbackUI';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  // NOTE: `@types/react` is not installed, so the `react` module resolves to
  // `any` and the members React.Component contributes are invisible to TS.
  // These re-state the base-class API so this file is still type-checked.
  // Delete the whole block once @types/react is added to devDependencies.
  declare state: State;
  declare props: Props;
  declare setState: (state: Partial<State> | null) => void;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (import.meta.env.PROD) {
      logger.error('Production error (consider adding Sentry):', error?.message ?? error);
      // To add Sentry: npm i @sentry/react && Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <ErrorFallbackUI
          error={this.state.error}
          onReload={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundaryClass };
export default ErrorBoundaryClass;