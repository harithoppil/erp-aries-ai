"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EnquiryDetailError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-5.5rem)] text-[#94a3b8]">
      <AlertTriangle size={48} className="mb-4 text-amber-500" />
      <p className="text-lg font-medium text-[#0f172a]">Failed to load enquiry</p>
      <p className="text-sm mt-1">{error.message}</p>
      <Button onClick={reset} variant="outline" className="mt-4">
        Try Again
      </Button>
    </div>
  );
}
