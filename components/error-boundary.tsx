"use client";

import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function DefaultFallback({ error, resetErrorBoundary }: { error: unknown; resetErrorBoundary: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[ErrorBoundary]", error);
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium text-foreground">Something went wrong</p>
      <p className="max-w-md text-center text-xs text-muted-foreground">
        {message || "An unexpected error occurred"}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={resetErrorBoundary}
      >
        <RotateCcw className="h-3 w-3" />
        Try again
      </Button>
    </div>
  );
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  if (fallback) {
    return <ReactErrorBoundary fallback={fallback}>{children}</ReactErrorBoundary>;
  }
  return (
    <ReactErrorBoundary FallbackComponent={DefaultFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
