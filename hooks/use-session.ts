"use client";

import { useEffect, useState } from "react";
import type { SessionPayload } from "@/app/auth/actions";

interface UserInfo extends SessionPayload {
  avatar_url?: string | null;
}

export function useSession() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  return { user, loading };
}
