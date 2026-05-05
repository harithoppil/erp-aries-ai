import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { cn } from "@/lib/utils";

/*
 * Aries ERP — Nautical Industrial
 *
 * Fonts: Geist (modern, precise — instrument readout feel)
 *        Geist Mono (data displays, code blocks)
 * Light mode default, dark mode toggle
 */

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Aries ERP — AI Presales Consultant",
  description: "Hybrid AI Presales Consultant — MCP-native, Gemini-powered, Wiki-first",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
