"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { listEnquiries, type ClientSafeEnquiry } from "@/app/dashboard/enquiries/actions";
import { STATUS_COLORS } from "@/types/api";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function EnquiriesPage() {
  const isMobile = useIsMobile();
  const [enquiries, setEnquiries] = useState<ClientSafeEnquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEnquiries().then((result) => {
      if (result.success) {
        setEnquiries(result.enquiries);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Enquiries</h2>
        <Link href="/dashboard/enquiries/new" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : !enquiries.length ? (
        <div className="py-12 text-center text-muted-foreground">
          No enquiries yet.{" "}
          <Link href="/dashboard/enquiries/new" className="text-primary underline">Create one</Link>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {enquiries.map((e) => (
            <Link key={e.id} href={`/dashboard/enquiries/${e.id}`} className="block rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{e.client_name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[e.status as keyof typeof STATUS_COLORS] || ""}`}>
                  {e.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{e.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Industry</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enquiries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/enquiries/${e.id}`} className="font-medium text-primary hover:underline">{e.client_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{e.industry || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{e.channel}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[e.status as keyof typeof STATUS_COLORS] || ""}`}>
                      {e.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
