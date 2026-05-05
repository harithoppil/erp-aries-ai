"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);
      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem("aries_token", data.access_token);
      localStorage.setItem("aries_user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-navy rounded-xl flex items-center justify-center">
            <span className="text-gold text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">Aries Marine ERP</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-gold hover:bg-[#B08D2F] text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Demo: admin@ariesmarine.com / admin123
        </p>
      </div>
    </div>
  );
}
