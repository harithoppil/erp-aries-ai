"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEnquiry } from "@/app/dashboard/enquiries/actions";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-responsive";
import type { EnquiryCreate } from "@/types/api"; // kept for form compatibility

export default function NewEnquiryPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<EnquiryCreate>({
    client_name: "",
    client_email: "",
    channel: "web",
    industry: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createEnquiry({ ...form, client_email: form.client_email || undefined, industry: form.industry || undefined, subdivision: form.subdivision || undefined });
      if (result.success) {
        router.push(`/dashboard/enquiries/${result.enquiry.id}`);
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error("Failed to create enquiry: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={isMobile ? "" : "mx-auto max-w-2xl"}>
      <h2 className="mb-6 text-2xl font-bold">New Enquiry</h2>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Client Name *</label>
          <Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="e.g. Acme Corp" />
        </div>
        <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
          <div>
            <label className="mb-1 block text-sm font-medium">Client Email</label>
            <Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="contact@acme.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Channel</label>
            <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as EnquiryCreate["channel"] })}>
              <option value="web">Web / ERP</option>
              <option value="email">Email / Outlook</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Industry</label>
          <Input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Manufacturing, Maritime, Oil & Gas" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description *</label>
          <textarea required rows={6} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the client's requirements, scope, and any relevant context..." />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent/50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
