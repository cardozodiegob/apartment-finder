"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="glass-card text-center max-w-md">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Please try refreshing the page.</p>
            <button onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm">
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
