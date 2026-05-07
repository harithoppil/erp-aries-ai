"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
 * Three-tier responsive hook — Nautical bridge layout
 *
 * Desktop (≥1024px): Full sidebar with collapsible toggle
 * Tablet (768–1023px): Icon-only sidebar, no toggle
 * Mobile (<768px): Split nav — top bar + bottom tabs
 *
 * Breakpoints aligned with shadcn/ui defaults (768px mobile)
 * ═══════════════════════════════════════════════════════════ */

type Breakpoint = "desktop" | "tablet" | "mobile";

export function useResponsive() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) setBreakpoint("desktop");
      else if (w >= 768) setBreakpoint("tablet");
      else setBreakpoint("mobile");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    breakpoint,
    isDesktop: mounted ? breakpoint === "desktop" : true,  // SSR-safe default
    isTablet: mounted ? breakpoint === "tablet" : false,
    isMobile: mounted ? breakpoint === "mobile" : false,
    mounted,
  };
}

/* Dark mode hook — persists to localStorage */
export function useDarkMode() {
  const [dark, setDark] = useState(false); // Default light mode

  useEffect(() => {
    const stored = localStorage.getItem("aries-dark-mode");
    if (stored !== null) {
      setDark(stored === "true");
    }
    // Apply class immediately
    document.documentElement.classList.toggle("dark", stored !== null ? stored === "true" : false);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("aries-dark-mode", String(next));
      return next;
    });
  }, []);

  return { dark, toggle };
}

/* Legacy compat — used by pages still importing from use-mobile */
export function useIsMobile() {
  const { isMobile } = useResponsive();
  return isMobile;
}
