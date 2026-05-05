import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aries Marine ERP",
  description: "AI-Powered Enterprise Resource Planning for Aries Marine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F7FA] text-[#1A1A2E] font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
