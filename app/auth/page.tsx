"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction, signupAction } from "@/app/auth/actions";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup extra fields
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [subsidiary, setSubsidiary] = useState("");

  const DEPARTMENTS = [
    "Operations",
    "Sales",
    "Engineering",
    "HSE",
    "Finance",
    "Procurement",
    "HR",
    "IT",
  ];

  const SUBSIDIARIES = [
    "Aries Marine LLC",
    "Aries Subsea Ltd",
    "Aries Engineering Services",
    "Aries Offshore Support",
  ];

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginAction({ email, password });
      if (result.success) {
        router.push("/erp/accounts");
      } else {
        setError(result.error || "Login failed");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signupAction({
        name,
        email,
        password,
        role: "user",
        department: department || undefined,
        subsidiary: subsidiary || undefined,
      });
      if (result.success) {
        router.push("/erp/accounts");
      } else {
        setError(result.error || "Signup failed");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[#1e3a5f] shadow-lg">
            <img
              src="/aries-logo-transparent.png"
              alt="Aries"
              className="h-10 w-10"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Aries Marine ERP</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enterprise Resource Planning Platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-sm">
          {/* Tabs */}
          <div className="mb-6 flex rounded-lg bg-slate-900/50 p-1">
            <button
              onClick={() => {
                setIsLogin(true);
                setError("");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                isLogin
                  ? "bg-[#1e3a5f] text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError("");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                !isLogin
                  ? "bg-[#1e3a5f] text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ariesmarine.com"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a4f7f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ariesmarine.com"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Subsidiary
                </label>
                <select
                  value={subsidiary}
                  onChange={(e) => setSubsidiary(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                >
                  <option value="">Select subsidiary</option>
                  {SUBSIDIARIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a4f7f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Aries Marine ERP &mdash; Secure Enterprise Platform
        </p>
      </div>
    </div>
  );
}
