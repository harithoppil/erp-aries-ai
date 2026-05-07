"use client";

export default function CustomersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-5.5rem)] text-[#94a3b8]">
      <p className="text-lg font-medium text-[#0f172a] mb-2">Failed to load customers</p>
      <p className="text-sm mb-4">{error.message || "An unexpected error occurred"}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#152a45] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
