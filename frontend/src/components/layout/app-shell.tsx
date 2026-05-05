"use client";

import { Sidebar } from "./sidebar";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const [user, setUser] = useState<{full_name?: string} | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("aries_user");
    if (u) setUser(JSON.parse(u));
  }, []);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h2 className="text-sm font-semibold text-navy capitalize">
            {pathname.replace(/-/g, " ").replace(/\//g, " ").trim() || "Dashboard"}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{user?.full_name || "User"}</span>
            <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center">
              <span className="text-gold text-xs font-bold">{(user?.full_name || "U")[0]}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
