import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Render-prop fallback so callers control the recovery UI (and can supply an
  // export/escape-hatch). `reset` clears the caught error to re-attempt a render.
  fallback: (args: { error: Error; reset: () => void }) => ReactNode;
  // Optional hook for logging/telemetry.
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Generic React error boundary (1.4). A render-time exception anywhere in the
// subtree is caught here and turned into the caller's fallback UI, so it can
// never white-screen the whole app. Error boundaries must be class components.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface details for debugging; the user sees the fallback, not this.
    console.error('PathWise caught a render error:', error, info);
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
      });
    }
    return this.props.children;
  }
}
