import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppLayout } from '@/components/app-layout';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

/*
 * Aries ERP — Nautical Industrial AI Presales Consultant
 *
 * Fonts:  Geist (modern, precise — instrument readout feel)
 *         Geist Mono (data displays, code blocks)
 * Theme:  Light default, dark mode toggle
 * Stack:  Next.js 16 App Router + FastAPI backend
 */

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono'
});

export const viewport: Viewport = {
  themeColor: '#0f172a', // slate-900 — nautical navy
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
};

export const metadata: Metadata = {
  // --- Core Metadata ---
  title: {
    default: 'Aries ERP — AI-Powered Marine Enterprise Platform',
    template: '%s | Aries ERP'
  },
  description:
    'AI-powered Enterprise Resource Planning for the marine industry. Gemini-driven presales consulting, document intelligence, and full ERP — from accounting to procurement.',
  applicationName: 'Aries ERP',

  // --- Author and Publisher ---
  authors: [{ name: 'Aries Marine', url: 'http://localhost:3000' }],
  creator: 'Aries Marine',
  publisher: 'Aries Marine',

  // --- SEO Keywords ---
  keywords: [
    'marine ERP',
    'AI presales consultant',
    'ship management software',
    'marine procurement',
    'vessel maintenance',
    'maritime ERP',
    'AI-powered ERP',
    'Gemini AI',
    'document intelligence',
    'marine industry',
    'chart of accounts',
    'marine invoicing',
    'project management',
    'knowledge base'
  ],

  // --- PWA ---
  manifest: '/site.webmanifest',

  // --- Icons ---
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },

  // --- Open Graph ---
  openGraph: {
    type: 'website',
    url: 'http://localhost:3000',
    title: 'Aries ERP — AI-Powered Marine Enterprise Platform',
    description:
      'AI-powered ERP for the marine industry. Gemini-driven presales consulting, document intelligence, and full business management.',
    siteName: 'Aries ERP',
    images: [
      {
        url: '/aries-logo-large.png',
        width: 512,
        height: 512,
        alt: 'Aries ERP — Nautical AI-Powered Enterprise Platform'
      }
    ]
  },

  // --- Twitter Card ---
  twitter: {
    card: 'summary',
    title: 'Aries ERP — AI-Powered Marine Enterprise Platform',
    description:
      'AI-powered ERP for the marine industry. Gemini-driven presales consulting and full business management.',
    images: ['/aries-logo-large.png']
  },

  // --- Robots ---
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },

  // --- Metadata Base ---
  metadataBase: new URL('http://localhost:3000'),

  // --- App Links (PWA) ---
  appleWebApp: {
    title: 'Aries ERP',
    statusBarStyle: 'black-translucent',
    capable: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn('font-sans', geist.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <TooltipProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
