"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { useDarkMode } from "@/hooks/use-responsive";
import { Settings as SettingsIcon, Moon, Sun, Key, Database, Cloud, Shield } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const isMobile = useIsMobile();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const handleSaveApiKey = () => {
    // In a real app this would POST to backend; for now store locally
    if (apiKey.trim()) {
      localStorage.setItem("aries-api-key", apiKey.trim());
      setApiKeySaved(true);
      toast.success("API key saved");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">System Settings</h2>
      </div>

      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        {/* Appearance */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            {dark ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-amber" />}
            <h3 className="font-semibold">Appearance</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
            </div>
            <button
              onClick={toggleDark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={dark}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                dark ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  dark ? "translate-x-5.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* API Authentication */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Key className="h-4 w-4 text-amber" />
            <h3 className="font-semibold">API Authentication</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setApiKeySaved(false); }}
                  placeholder="Enter API key..."
                  className="flex-1 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim()}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              {apiKeySaved && <p className="mt-1 text-xs text-sonar">Key saved successfully</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              When set, all API requests require the X-API-Key header. Leave empty for development mode (no auth).
            </p>
          </div>
        </div>

        {/* Database Info */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-sonar" />
            <h3 className="font-semibold">Database</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Engine</dt>
              <dd>SQLite (aiosqlite)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-xs">./aries.db</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ORM</dt>
              <dd>SQLAlchemy 2.0</dd>
            </div>
          </dl>
        </div>

        {/* Cloud Configuration */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Cloud Services</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">AI Provider</dt>
              <dd>Google Vertex AI</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Embedding Model</dt>
              <dd className="text-xs">gemini-embedding-2</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage</dt>
              <dd>GCS (aries-raw-sources)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Wiki</dt>
              <dd>Local filesystem</dd>
            </div>
          </dl>
        </div>

        {/* Security */}
        <div className={isMobile ? "" : "col-span-2"}>
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Security & Compliance</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[
                { label: "SQL Injection", status: "Protected", ok: true },
                { label: "Path Traversal", status: "Protected", ok: true },
                { label: "Upload Cap", status: "50 MB", ok: true },
                { label: "API Auth", status: apiKeySaved ? "Enabled" : "Dev Mode", ok: apiKeySaved },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={`font-medium ${item.ok ? "text-sonar" : "text-amber"}`}>{item.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
