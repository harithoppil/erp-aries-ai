"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Anchor, ArrowRight, BarChart3, Bot, CheckCircle, FileText, Globe, MessageSquare, Shield, ShoppingCart, Sparkles, Users, Wallet, Zap, Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { signoutAction } from "@/app/auth/actions";
import { useRouter } from "next/navigation";

/* ═══════════════════════════════════════════════════════════
 * Aries Marine ERP — Landing Page
 *
 * Beautiful marketing landing with auth-aware header.
 * Shows Dashboard link when logged in, Login/Signup otherwise.
 * ═══════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: Bot,
    title: "AI-Powered Presales",
    description: "Gemini-driven consulting that qualifies leads, drafts proposals, and negotiates terms autonomously.",
  },
  {
    icon: FileText,
    title: "Document Intelligence",
    description: "Upload any document — contracts, specs, drawings — and extract structured data with LLM vision.",
  },
  {
    icon: BarChart3,
    title: "Full ERP Suite",
    description: "Accounts, procurement, HR, projects, stock, and timesheets — all in one marine-focused platform.",
  },
  {
    icon: Globe,
    title: "Multi-Subsidiary",
    description: "Manage Aries Marine LLC, Aries Subsea, Aries Engineering, and Aries Offshore from a single pane.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "JWT-based auth, role-based access control, audit trails, and Row-Level Security in PostgreSQL.",
  },
  {
    icon: Sparkles,
    title: "Knowledge Wiki",
    description: "LLM-maintained knowledge base that compounds with every document, enquiry, and conversation.",
  },
];

const STATS = [
  { value: "12+", label: "ERP Modules" },
  { value: "4", label: "Subsidiaries" },
  { value: "99.9%", label: "Uptime" },
  { value: "<200ms", label: "API Response" },
];

function LandingHeader() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignout() {
    await signoutAction();
    router.refresh();
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/aries-logo-transparent.png" alt="Aries" className="h-8 w-8" />
          <div className="leading-tight">
            <span className="text-sm font-bold text-white">Aries</span>
            <span className="ml-1.5 text-[10px] font-medium text-slate-400">Marine ERP</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-slate-300 transition-colors hover:text-white">
            Features
          </a>
          <a href="#stats" className="text-sm text-slate-300 transition-colors hover:text-white">
            Stats
          </a>
          <a href="#modules" className="text-sm text-slate-300 transition-colors hover:text-white">
            Modules
          </a>

          {!loading &&
            (user ?
              <div className="flex items-center gap-3">
                <Button size="default" className="gap-1.5 bg-[#1e3a5f] hover:bg-[#2a4f7f]" onClick={handleSignout}>
                  <LogOut className="mr-1 h-4 w-4" />
                  Sign Out
                </Button>
                <Link href="/dashboard">
                  <Button size="default" className="gap-1.5 bg-[#1e3a5f] hover:bg-[#2a4f7f]">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              </div>
            : <div className="flex items-center gap-3">
                <Link href="/auth">
                  <Button size="default" className="gap-1.5 bg-[#1e3a5f] hover:bg-[#2a4f7f]">Sign In</Button>
                </Link>
                <Link href="/auth">
                  <Button size="default" className="gap-1.5 bg-[#1e3a5f] hover:bg-[#2a4f7f]">Get Started</Button>
                </Link>
              </div>)}
        </nav>

        {/* Mobile menu button */}
        <button className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ?
            <X size={20} />
          : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="border-b border-white/10 bg-[#0f172a]/95 backdrop-blur-xl px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <a href="#features" className="text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>
              Features
            </a>
            <a href="#stats" className="text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>
              Stats
            </a>
            <a href="#modules" className="text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>
              Modules
            </a>
            <div className="border-t border-slate-800 pt-3">
              {!loading &&
                (user ?
                  <>
                    <Link href="/dashboard" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-1 py-2 text-sm font-medium text-white hover:bg-[#2a4f7f]">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    <Button variant="ghost" className="w-full text-slate-300" onClick={handleSignout}>
                      <LogOut className="mr-1 h-4 w-4" /> Sign Out
                    </Button>
                  </>
                : <>
                    <Link href="/auth" className="inline-flex w-full items-center justify-center rounded-lg bg-[#0ea5e9] px-1 py-2 text-sm font-medium text-white hover:bg-[#0284c7]">
                      Sign In
                    </Link>
                    <Link href="/auth" className="inline-flex w-full items-center justify-center rounded-lg bg-[#0ea5e9] px-1 py-2 text-sm font-medium text-white hover:bg-[#0284c7]">
                      Get Started
                    </Link>
                  </>)}
            </div>
          </div>
        </motion.div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] px-4 pt-32 pb-20 sm:px-6 lg:px-8">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(14,165,233,0.12),transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0ea5e9]/30 bg-[#0ea5e9]/10 px-4 py-1.5 text-sm font-medium text-[#0ea5e9]">
              <Zap className="h-4 w-4" />
              AI-Native Enterprise Platform
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Marine ERP powered by <span className="bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] bg-clip-text text-transparent">Artificial Intelligence</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            From presales consulting to full ERP — Aries Marine streamlines operations across all subsidiaries with Gemini-driven intelligence.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0ea5e9] px-6 text-sm font-medium text-white hover:bg-[#0284c7]">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-6 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
              Sign In
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section id="stats" className="border-y border-slate-800 bg-[#0f172a] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="bg-[#0f172a] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0ea5e9]/30 bg-[#0ea5e9]/10 px-4 py-1.5 text-sm font-medium text-[#0ea5e9]">
              <Sparkles className="h-4 w-4" />
              Built for Modern Marine Operations
            </div>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl font-bold text-white sm:text-4xl">
            Everything you need to scale
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            One platform for enquiries, accounts, procurement, HR, projects, and AI-powered document intelligence.
          </motion.p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-colors hover:border-[#0ea5e9]/30 hover:bg-slate-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e3a5f] text-[#0ea5e9]">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModulesSection() {
  const modules = [
    { icon: FileText, name: "Enquiries", desc: "Lead qualification & pipeline" },
    { icon: Wallet, name: "Accounts", desc: "Invoicing & payments" },
    { icon: Users, name: "Personnel", desc: "HR & timesheets" },
    { icon: ShoppingCart, name: "Procurement", desc: "POs & suppliers" },
    { icon: BarChart3, name: "Reports", desc: "GL, P&L, Balance Sheet" },
    { icon: MessageSquare, name: "AI Chat", desc: "Gemini assistant" },
  ];

  return (
    <section id="modules" className="bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl font-bold text-white sm:text-4xl">
            12+ Integrated Modules
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            From sales to finance to operations — every department covered.
          </motion.p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/30 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-[#0ea5e9]">
                <mod.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium text-white">{mod.name}</div>
                <div className="text-xs text-slate-400">{mod.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="bg-gradient-to-r from-[#1e3a5f] to-[#0f172a] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to transform your marine operations?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">Join Aries Marine Consultancy and experience AI-powered enterprise resource planning.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0ea5e9] px-6 text-sm font-medium text-white hover:bg-[#0284c7]">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-[#0f172a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/aries-logo-transparent.png" alt="Aries" className="h-6 w-6" />
            <span className="text-sm font-semibold text-white">Aries Marine ERP</span>
          </div>
          <p className="text-xs text-slate-500">Aries Marine Consultancy LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      <LandingHeader />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <ModulesSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
