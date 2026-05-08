"use client";

import { Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TrialBalanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
          <Scale className="h-6 w-6 text-[#0ea5e9]" />
          Trial Balance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Opening balances, period movements, and closing balances per account</p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-lg font-semibold text-destructive">Failed to load Trial Balance</p>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={reset} className="mt-4 bg-[#1e3a5f] hover:bg-[#2d5a87]">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
