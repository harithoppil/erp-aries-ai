"use client";

import { useState, useEffect } from "react";

/**
 * Media query hook — clean mobile/desktop conditional rendering.
 *
 * Use instead of Tailwind responsive prefixes (sm:, md:, lg:) for
 * component-level splits: {isMobile ? <MobileView /> : <DesktopView />}
 *
 * Source: grantflux/app/hooks/use-media-query.tsx pattern
 */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  // Return false during SSR to avoid hydration mismatch
  return mounted ? matches : false;
}
