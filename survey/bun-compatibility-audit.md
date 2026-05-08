# Frontend Bun Compatibility Audit

> **Project:** `frontend/` — Aries Marine ERP Next.js 16 app  
> **Current Package Manager:** pnpm (detected `pnpm-lock.yaml`)  
> **Audit Date:** 2026-05-07  
> **Bun Version Reference:** 1.3.x  
> **Status:** AUDIT ONLY — no edits made to `frontend/`

---

## Executive Summary

| Category | Count | Verdict |
|----------|-------|---------|
| Total Dependencies | 63 (54 prod + 9 dev) | — |
| ✅ Fully Compatible | 57 | Will work out of the box |
| ⚠️ Needs Workarounds | 4 | Prisma CLI, Prisma Client, Tailwind v4, ESLint |
| ❌ Known Issues | 2 | Prisma + Next.js 16 + Bun runtime crash |
| **Overall Verdict** | — | **Feasible with config changes** |

**Bottom line:** You can port to Bun, but Prisma is the biggest blocker. Everything else is pure JavaScript and will work. The recommended approach is to use Bun for package management and Node.js for the runtime (via `bun run dev`, not `bun --bun next dev`).

---

## The Full Dependency Matrix

### ✅ GREEN — Fully Compatible (57 packages)

These are pure-JS packages with no postinstall scripts, no native bindings, and no known Bun issues.

| Package | Version | Why It's Safe |
|---------|---------|---------------|
| `@base-ui/react` | ^1.4.1 | Pure React components |
| `@google/genai` | ^1.51.0 | HTTP client, pure JS |
| `@radix-ui/react-avatar` | ^1.1.11 | Pure React primitives |
| `@radix-ui/react-dialog` | ^1.1.15 | Pure React primitives |
| `@radix-ui/react-scroll-area` | ^1.2.10 | Pure React primitives |
| `@radix-ui/react-separator` | ^1.1.8 | Pure React primitives |
| `@radix-ui/react-slot` | ^1.2.4 | Pure React primitives |
| `@radix-ui/react-tabs` | ^1.1.13 | Pure React primitives |
| `@radix-ui/react-tooltip` | ^1.2.8 | Pure React primitives |
| `@tiptap/extension-color` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-font-family` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-highlight` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-image` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-link` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-subscript` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-superscript` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-table` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-table-cell` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-table-header` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-table-row` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-text-align` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-text-style` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/extension-underline` | ^3.22.5 | ProseMirror plugins, pure JS |
| `@tiptap/react` | ^3.22.5 | React wrapper for ProseMirror |
| `@tiptap/starter-kit` | ^3.22.5 | Pure JS |
| `bcryptjs` | ^3.0.3 | **Pure JS** (not `bcrypt` which has native bindings) |
| `class-variance-authority` | ^0.7.1 | Utility library, pure JS |
| `clsx` | ^2.1.1 | String utility, pure JS |
| `cmdk` | ^1.1.1 | Command palette component |
| `date-fns` | ^4.1.0 | Date utility library |
| `embla-carousel-react` | ^8.6.0 | Carousel component |
| `input-otp` | ^1.4.2 | OTP input component |
| `jose` | ^6.2.3 | JWT library, pure JS (WebCrypto API) |
| `lucide-react` | ^1.14.0 | Icon components |
| `motion` | ^12.38.0 | Framer Motion successor, pure JS |
| `next-themes` | ^0.4.6 | Theme provider |
| `react` | 19.2.4 | Core React |
| `react-day-picker` | ^9.14.0 | Date picker component |
| `react-dom` | 19.2.4 | React DOM renderer |
| `react-markdown` | ^10.1.0 | Markdown renderer |
| `react-resizable-panels` | ^4.11.0 | Panel layout component |
| `recharts` | 3.8.0 | Charting library (pure JS, uses SVG) |
| `remark-gfm` | ^4.0.1 | Markdown plugin |
| `shadcn` | ^4.6.0 | CLI tooling (not runtime) |
| `sonner` | ^2.0.7 | Toast notifications |
| `swr` | ^2.4.1 | Data fetching hook |
| `tailwind-merge` | ^3.5.0 | Tailwind class merging utility |
| `tw-animate-css` | ^1.4.0 | Tailwind v4 animation plugin |
| `vaul` | ^1.1.2 | Drawer component |
| `zod` | ^4.4.3 | Schema validation |
| `zustand` | ^5.0.13 | State management |
| `@types/bcryptjs` | ^3.0.0 | Type definitions |
| `@types/node` | ^20 | Type definitions |
| `@types/react` | ^19 | Type definitions |
| `@types/react-dom` | ^19 | Type definitions |
| `eslint-config-next` | 16.2.4 | ESLint config |
| `typescript` | ^5 | TypeScript compiler |

### ⚠️ YELLOW — Needs Workarounds (4 packages)

| Package | Version | Issue | Workaround |
|---------|---------|-------|------------|
| `prisma` | 5.22.0 | Preinstall script checks Node.js version; may fail on Bun. `bunx prisma` CLI commands have ESM/CJS interop issues. | Use `npx prisma` instead of `bunx prisma`. Or add `"trustedDependencies": ["prisma"]` to package.json. |
| `@prisma/client` | 5.22.0 | Generated client. In Next.js 16 + Bun runtime, crashes with `Failed to load chunk` errors during SSR. | Add `serverExternalPackages: ['@prisma/client']` to `next.config.ts`. Use Node.js runtime, not Bun runtime. |
| `tailwindcss` | ^4 | Tailwind v4 is new. Some reports of HMR/watch issues with Next.js 16 + Turbopack requiring dev restarts. | Add `@source` directives for external folders. If issues persist, try `next dev --webpack`. |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin. Should work but v4 is less battle-tested than v3. | Monitor for issues. Fallback to Tailwind v3 if critical. |

### ❌ RED — Known Blockers (2 scenarios)

| Scenario | Error | Root Cause |
|----------|-------|------------|
| **Prisma + Next.js 16 + `bun --bun` runtime** | `Failed to load chunk server/chunks/ssr/[externals]_node:buffer...` | Bun's runtime doesn't handle Prisma's WASM query engine + Next.js 16 SSR bundling correctly. |
| **Prisma v7 preinstall** | `Prisma only supports Node.js versions 20.19+` | Prisma's preinstall script checks `process.version` and Bun reports its own version, not Node's. |

**Note:** Your project uses Prisma 5.22.0 (not v7), so the preinstall check is less strict. The main risk is the SSR chunk loading issue.

---

## Detailed Analysis by Category

### 1. Prisma (The Biggest Risk)

**Your setup:** Prisma 5.22.0 + `@prisma/client` 5.22.0 + Next.js 16.2.4

**What works:**
- `bun install` — installs fine (Prisma 5.x doesn't have strict Node version check)
- `bun run dev` — works IF Bun spawns Node.js runtime (default behavior)

**What breaks:**
- `bun --bun run dev` — forces Bun runtime, Prisma crashes on first query
- `bunx prisma generate` — may fail with ESM/CJS interop errors
- `bunx prisma migrate` — same issue

**Recommended workaround:**

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "db:push": "npx prisma db push",
    "db:migrate": "npx prisma migrate dev",
    "db:generate": "npx prisma generate"
  }
}
```

```typescript
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
};

export default config;
```

**Verdict:** ✅ Use Bun for package management, Node.js for Prisma CLI and runtime.

---

### 2. Next.js 16 + Bun Runtime

**What works:**
- `bun install` — fast, reliable
- `bun run build` — works (spawns Node.js by default)
- `bun run dev` — works (spawns Node.js by default)

**What breaks:**
- `bun --bun run dev` — forces Bun runtime, may crash with:
  - Prisma WASM engine loading
  - Turbopack module resolution edge cases
  - Some native Node.js APIs not fully compatible

**Key insight:** `bun run` (without `--bun`) spawns the Node.js runtime by default for scripts that invoke `node` or `next`. This is the safe path. `bun --bun` forces Bun's own runtime, which is where the incompatibilities lie.

**Verdict:** ✅ Use `bun run dev` (not `bun --bun run dev`).

---

### 3. Tailwind CSS v4

**Your setup:** Tailwind v4 + `@tailwindcss/postcss` + Next.js 16 Turbopack

**What works:**
- Installation via Bun
- Production builds
- Basic dev server

**What has issues:**
- Dev server HMR/watch — some reports of classes not appearing until restart
- This is a Tailwind v4 + Turbopack issue, not specifically a Bun issue

**Workarounds if you hit issues:**
1. Add `@source` directives in CSS for external packages:
   ```css
   @import "tailwindcss";
   @source "../../node_modules/@base-ui/react";
   ```
2. Try `next dev --webpack` instead of Turbopack
3. Downgrade to Tailwind v3 if critical

**Verdict:** ⚠️ Monitor for HMR issues. Likely to improve as Tailwind v4 matures.

---

### 4. ESLint

**Your setup:** ESLint 9 + `eslint-config-next` 16.2.4

**What works:**
- `bun run lint` — works (spawns Node.js)

**What might need attention:**
- ESLint 9's flat config is stricter — may need config updates regardless of Bun
- Some plugins may not resolve correctly if they rely on specific pnpm/node_modules layout

**Verdict:** ✅ Should work. Test `bun run lint` after migration.

---

### 5. All Other Dependencies

The remaining 57 packages are pure JavaScript with no native bindings, no postinstall scripts, and no known Bun incompatibilities. They include:

- **UI Components:** Radix UI, Base UI, shadcn/ui, Vaul, Sonner, CMDK
- **Rich Text:** TipTap (full suite) — ProseMirror is pure JS
- **Charts:** Recharts — pure JS, SVG-based
- **State:** Zustand — tiny, pure JS
- **Validation:** Zod — pure JS
- **Auth:** Jose — uses WebCrypto, works in Bun
- **Animation:** Motion (Framer Motion) — pure JS
- **Date:** date-fns, react-day-picker — pure JS
- **Icons:** lucide-react — pure JS
- **Carousels:** embla-carousel-react — pure JS
- **Data Fetching:** SWR — pure JS
- **Markdown:** react-markdown, remark-gfm — pure JS

---

## Migration Path to Bun

### Step 1: Install Bun (if not already)

```bash
curl -fsSL https://bun.sh/install | bash
```

### Step 2: Replace pnpm with Bun

```bash
cd frontend

# Remove pnpm artifacts
rm -rf node_modules pnpm-lock.yaml

# Install with Bun
bun install
```

### Step 3: Update package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "seed:auth": "npx tsx prisma/seed-auth.ts",
    "db:push": "npx prisma db push",
    "db:migrate": "npx prisma migrate dev",
    "db:generate": "npx prisma generate"
  }
}
```

> **Important:** Use `npx` for Prisma and `tsx` commands, not `bunx`.

### Step 4: Update next.config.ts

```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
};

export default config;
```

### Step 5: Trust Prisma's postinstall

Bun blocks postinstall scripts by default. Either:

```bash
# Option A: Trust Prisma specifically
bun pm trust prisma

# Option B: Allow all postinstalls (less secure)
bun install --trusted
```

### Step 6: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 7: Test

```bash
# Dev server (uses Node.js runtime — safe)
bun run dev

# Build (uses Node.js runtime — safe)
bun run build

# Lint
bun run lint
```

> **DO NOT use:** `bun --bun run dev` — forces Bun runtime, will crash with Prisma.

---

## Performance Gains Expected

| Operation | pnpm | Bun | Improvement |
|-----------|------|-----|-------------|
| Cold install | ~30-60s | ~5-10s | **3-6x faster** |
| Lockfile resolution | ~5-10s | ~1-2s | **5x faster** |
| `prisma generate` | same | same | no change (uses Node.js) |
| `next build` | same | same | no change (uses Node.js) |
| Package add | ~3-5s | ~0.5s | **6-10x faster** |
| Disk usage | ~500MB+ | ~500MB+ | similar |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Prisma SSR crash | Medium | High | `serverExternalPackages` + Node.js runtime |
| Prisma CLI issues | Medium | Medium | Use `npx prisma` instead of `bunx prisma` |
| Tailwind v4 HMR | Low | Low | Add `@source` or use `--webpack` |
| ESLint config drift | Low | Low | Test `bun run lint` after migration |
| Turbopack + Bun edge cases | Low | Medium | Use Node.js runtime (default) |
| Lockfile conflicts | Low | Medium | Delete `pnpm-lock.yaml`, regenerate with Bun |

---

## Final Verdict

| Question | Answer |
|----------|--------|
| **Can we migrate to Bun?** | ✅ Yes |
| **Will it be faster?** | ✅ 3-6x faster installs |
| **Any breaking changes?** | ⚠️ Prisma CLI needs `npx` instead of `bunx` |
| **Any runtime changes?** | ❌ No — keep using Node.js runtime for Next.js |
| **Is it worth it?** | ✅ Yes for install speed alone |

**Recommended approach:**
1. Use Bun for package management (`bun install`, `bun add`)
2. Keep Node.js for runtime (`bun run dev` spawns Node.js by default)
3. Use `npx prisma` for all Prisma operations
4. Add `serverExternalPackages: ['@prisma/client']` to `next.config.ts`
5. Monitor Tailwind v4 HMR — address if issues arise
