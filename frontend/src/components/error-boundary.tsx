"use client";

import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RotateCcw className="h-3 w-3" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
