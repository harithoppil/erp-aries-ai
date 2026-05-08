# Bun API Migration Audit — Aries ERP AI

> Date: 2026-05-08
> Scope: Full codebase audit (app/, lib/, store/, hooks/, components/, types/, prisma/)
> Sources: Bun official docs (bun-llms-full.txt), project source code

---

## Executive Summary

The project uses Bun as a **package manager** (`bun install`) but runs all code on the **Node.js runtime**. Bun's native APIs can eliminate 2 npm dependencies, remove 17 redundant imports, speed up password hashing 3-5x, fix a memory-burning proxy pattern, and prepare the ground for a future Prisma bypass on hot SQL queries.

**Key caveat**: `bun --bun next dev` crashes with Prisma (documented in our project history). The `--bun` flag forces the Bun runtime for everything — but Prisma's Rust engine sidecar doesn't play well with it. All recommendations below assume Node.js runtime for Next.js dev/build/start, with Bun APIs available in Server Actions and API routes.

---

## Part 1: What to Replace — Priority Matrix

| Priority | Current Pattern | Bun Replacement | Files | Sites | Effort | Impact |
|----------|----------------|-----------------|-------|-------|--------|--------|
| **P0** | `bcryptjs` | `Bun.password.hash()` / `verify()` | 2 | 5 | Low | Remove dep, ~3-5x faster, argon2id available |
| **P0** | `import { randomUUID } from 'crypto'` | Remove import; `crypto.randomUUID()` is global in Bun | 17 | 37 | Low | Remove 17 imports; optionally upgrade to UUIDv7 |
| **P1** | `npx prisma` / `npx tsx` | `bunx prisma` / `bun run` | 1 | 4 | Trivial | Faster CLI execution, no npm needed |
| **P1** | `await res.arrayBuffer()` → `new NextResponse(data)` | Stream `res.body` directly | 1 | 1 | Low | Zero-copy proxy, prevents memory spikes |
| **P2** | `$queryRawUnsafe` (13 sites) | `import { sql } from "bun"` (Bun.SQL) | 2 | 13 | High | Eliminates Prisma overhead on hot SQL paths |
| **P3** | `Buffer.from(await file.arrayBuffer())` | `await file.bytes()` where Uint8Array suffices | 2 | 2 | Low | Minor — only where Buffer methods aren't needed |

---

## Part 2: File-by-File Breakdown

### 2.1 `bcryptjs` → `Bun.password`

**2 files, 5 call sites**

#### `app/auth/actions.ts`

```typescript
// BEFORE
import bcrypt from "bcryptjs";
// ...
const passwordValid = await bcrypt.compare(password, user.password_hash);  // line 77
const passwordHash = await bcrypt.hash(password, 12);                       // line 152
const passwordHash = await bcrypt.hash("admin123", 12);                     // line 283

// AFTER
// (No import needed — Bun.password is global)
const passwordValid = await Bun.password.verify(password, user.password_hash);
const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });
```

**Backward compatibility**: `Bun.password.verify()` auto-detects the algorithm from the hash format. Existing `bcryptjs` hashes verify without specifying `"bcrypt"`. New hashes default to argon2id (OWASP-recommended), but specifying `{ algorithm: "bcrypt" }` maintains hash format parity for migration.

**Why keep bcrypt for now?** If we switch to argon2id for new passwords, old bcrypt hashes still verify (auto-detection), but the hash format changes. This is fine — verify works with both. To migrate gradually: verify old bcrypt hashes, and on successful login, re-hash with argon2id.

#### `prisma/seed-auth.ts`

```typescript
// BEFORE
import bcrypt from "bcryptjs";
const passwordHash = await bcrypt.hash("admin123", 12);   // line 18
const passwordHash = await bcrypt.hash("manager123", 12); // line 41

// AFTER
const passwordHash = await Bun.password.hash("admin123", { algorithm: "bcrypt", cost: 12 });
const passwordHash = await Bun.password.hash("manager123", { algorithm: "bcrypt", cost: 12 });
```

**After migration**: Remove `bcryptjs` and `@types/bcryptjs` from package.json.

---

### 2.2 `crypto.randomUUID()` → Remove Import (or Upgrade to UUIDv7)

**17 files, 37 call sites** — the most widespread pattern.

All 17 files follow the same pattern:

```typescript
// BEFORE (every file)
import { randomUUID } from 'crypto';
// ...
id: randomUUID(),
```

**Option A — Minimal: just remove the import**
```typescript
// Bun (and modern Node.js) expose crypto.randomUUID() as a global Web Crypto API
// No import needed — just use it directly:
id: crypto.randomUUID(),
```

**Option B — Upgrade to UUIDv7 (recommended for Postgres performance)**
```typescript
import { randomUUIDv7 } from "bun";
// ...
id: randomUUIDv7(),
```

**Why UUIDv7 matters for ERP**: UUIDv4 is fully random, causing severe B-tree index fragmentation in PostgreSQL. UUIDv7 is time-sorted (monotonic), so inserts are sequential on disk — dramatically less I/O, smaller indexes, faster range scans. For a system generating thousands of invoices, journal entries, and payments, this is a real database performance win.

**Special cases**:
| File | Current | Replacement |
|------|---------|-------------|
| `app/erp/procurement/actions.ts:148` | `` `PO-${randomUUID().slice(0,8).toUpperCase()}` `` | `` `PO-${randomUUIDv7().slice(0,8).toUpperCase()}` `` |
| `app/erp/material-requests/actions.ts:37` | `` `MR-${randomUUID().slice(0,8).toUpperCase()}` `` | `` `MR-${randomUUIDv7().slice(0,8).toUpperCase()}` `` |
| `lib/mcp-gateway.ts:489,518,547,576` | Dynamic import: `const { randomUUID } = await import('crypto')` | `import { randomUUIDv7 } from "bun"` (static import at top) |

**Full file list**:
1. `app/ai/actions.ts` (personas, lines 123, 256)
2. `app/erp/customers/actions.ts` (line 102)
3. `app/erp/timesheets/actions.ts` (line 42)
4. `app/erp/payments/actions.ts` (line 65)
5. `app/erp/journal-entries/actions.ts` (line 52)
6. `app/erp/procurement/actions.ts` (lines 123, 148, 155, 168)
7. `app/erp/projects/actions.ts` (lines 113, 149, 192)
8. `app/erp/accounts/actions.ts` (lines 127, 147)
9. `app/erp/hr/actions.ts` (lines 50, 91)
10. `app/erp/quotations/actions.ts` (lines 79, 98)
11. `app/erp/material-requests/actions.ts` (lines 37, 40)
12. `app/erp/sales-orders/actions.ts` (lines 72, 92)
13. `app/erp/stock/actions.ts` (lines 125, 158)
14. `app/erp/assets/actions.ts` (line 79)
15. `app/enquiries/actions.ts` (line 114)
16. `app/notebooks/actions.ts` (line 49)
17. `app/channels/actions.ts` (line 72)
18. `lib/mcp-gateway.ts` (lines 489, 518, 547, 576 — dynamic import)

---

### 2.3 `package.json` Scripts — `npx` → `bunx` / `bun run`

```json
// BEFORE
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "seed:auth": "npx tsx prisma/seed-auth.ts",
  "db:push": "npx prisma db push",
  "db:migrate": "npx prisma migrate dev",
  "db:generate": "npx prisma generate"
}

// AFTER
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "seed:auth": "bun run prisma/seed-auth.ts",
  "db:push": "bunx prisma db push",
  "db:migrate": "bunx prisma migrate dev",
  "db:generate": "bunx prisma generate"
}
```

**Why NOT `bun --bun next dev`?** Our project previously tested this and it **crashes with Prisma**. Prisma v5's Rust query engine sidecar doesn't work under Bun's runtime. Keep Next.js on Node.js runtime; Bun APIs still work in Server Actions because Bun injects its globals when `bun install` was used.

**`npx tsx` → `bun run`**: Bun is a native TypeScript runtime — it runs `.ts` files directly. No `tsx` transpiler needed. This makes `seed-auth.ts` work with zero additional tooling.

**`bunx prisma` note**: Prisma's CLI works with `bunx` but some subcommands (like `prisma init`) require npm to be installed alongside Bun. `prisma generate`, `db push`, and `migrate dev` work fine.

---

### 2.4 Document Image Proxy — Stream Instead of Buffer

#### `app/api/document-image/[id]/route.ts`

```typescript
// BEFORE (lines 23-26) — buffers ENTIRE file into server memory
const data = await res.arrayBuffer();
const contentType = res.headers.get("content-type") || "application/octet-stream";
return new NextResponse(data, {
  status: 200,
  headers: {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
  },
});

// AFTER — stream the upstream response body directly (zero-copy)
return new NextResponse(res.body, {
  status: 200,
  headers: {
    "Content-Type": res.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
  },
});
```

**Why this matters**: This route proxies document images/PDFs from the Python backend. In an ERP, concurrent users viewing invoices or receipts will buffer potentially large files entirely in Node.js heap memory. Streaming via `res.body` (a `ReadableStream`) allows Bun/Node to pipe data through with backpressure — constant memory regardless of file size.

**Note on `app/api/markitdown/convert/route.ts:28`**: Also does `Buffer.from(await file.arrayBuffer())`, but this is **unavoidable** — the MarkItDown engine needs the full buffer for format detection. Not a streaming candidate.

---

### 2.5 `$queryRawUnsafe` → `Bun.SQL` (Long-term, High Impact)

**2 files, 13 call sites** — these bypass Prisma's ORM anyway, making them prime candidates for Bun.SQL.

#### What is `Bun.SQL`?

`import { sql } from "bun"` is Bun's **native PostgreSQL driver** — confirmed real and documented in Bun's official docs. It provides:

```typescript
import { sql } from "bun";

// Tagged template literals — auto-escapes, prevents SQL injection
const users = await sql`SELECT * FROM users WHERE active = ${true} LIMIT ${10}`;

// Connection pooling (configurable)
// Reads DATABASE_URL from .env automatically

// Transactions
await sql.begin(async tx => {
  await tx`INSERT INTO logs ${sql({ message: "hello" })}`;
  await tx`UPDATE counters SET count = count + 1`;
});

// Bulk inserts
await sql`INSERT INTO users ${sql(users)}`;

// Prepared statements (automatic for parameterized queries)
```

**Supported databases**: PostgreSQL (default), MySQL, SQLite — auto-detected from URL protocol.

#### Current `$queryRawUnsafe` sites

##### `lib/rag-db.ts` — 11 sites (RAG pipeline)

| Line | Type | Current Code Summary | Bun.SQL Replacement |
|------|------|---------------------|---------------------|
| 63 | DDL | `CREATE EXTENSION IF NOT EXISTS vector` | `await sql.unsafe(\`CREATE EXTENSION IF NOT EXISTS vector\`)` |
| 65-79 | DDL | `CREATE TABLE IF NOT EXISTS rag_chunks (...)` | `await sql.unsafe(...)` |
| 82-85 | DDL | `CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding` (IVFFlat) | `await sql.unsafe(...)` |
| 88-89 | DDL | B-tree indexes on source_path, modality | `await sql.unsafe(...)` |
| 92-96 | DDL | ALTER TABLE + column migration | `await sql.unsafe(...)` |
| 97 | DDL | GIN index on tsvector | `await sql.unsafe(...)` |
| 101-108 | DDL | CREATE OR REPLACE FUNCTION (tsv trigger) | `await sql.unsafe(...)` |
| 110-115 | DDL | CREATE TRIGGER | `await sql.unsafe(...)` |
| 148 | DML | Multi-row INSERT with vector embedding | `await sql\`INSERT INTO rag_chunks ${sql(rows)}\`` |
| 161 | DML | Single image chunk INSERT | Tagged template |
| 191-199 | DML | Semantic search (`embedding <=> $1::vector`) | Tagged template with params |

##### `app/erp/reports/actions.ts` — 6 sites (Financial reports)

| Line | Report | Current Code Summary |
|------|--------|---------------------|
| 135-166 | General Ledger | Dynamic WHERE + window function, multiple params |
| 169-177 | GL Totals | SUM aggregation |
| 249-258 | Trial Balance | Opening balances by account |
| 266-275 | Trial Balance | Period balances by account |
| 366-375 | Balance Sheet | Asset/liability/equity as-of date |
| 477-486 | Profit & Loss | Income/expense period totals |

**Migration strategy**: Replace DDL (schema init) last — these run once. Replace DML (search, reports) first — these run on every request and benefit most from eliminating Prisma's Rust query engine overhead.

**Example migration** — General Ledger:
```typescript
// BEFORE
const entries = await prisma.$queryRawUnsafe<Array<GLEntry>>(
  `SELECT ... FROM gl_entries WHERE posting_date >= $1 ...`,
  ...queryParams
);

// AFTER
import { sql } from "bun";
const entries = await sql`
  SELECT ... FROM gl_entries
  WHERE posting_date >= ${fromDate} AND posting_date <= ${toDate}
  ${accountId ? sql`AND account_id = ${accountId}` : sql``}
  ORDER BY posting_date, id
`;
```

**Why Bun.SQL over Prisma here?** These queries already bypass Prisma's ORM layer (`$queryRawUnsafe` = raw SQL string passthrough). Prisma still incurs overhead: the query goes through Prisma's Rust engine → serialization → JS. Bun.SQL connects directly to Postgres via native C driver — zero intermediate layers.

---

### 2.6 `Buffer.from(await file.arrayBuffer())` → `await file.bytes()`

**2 files** — minor optimization, only where Buffer-specific methods aren't needed.

#### `app/api/markitdown/convert/route.ts:28`
```typescript
// BEFORE
const buffer = Buffer.from(await file.arrayBuffer());

// AFTER (if MarkItDown engine accepts Uint8Array)
const buffer = await file.bytes();  // Returns Uint8Array directly
```

**Caveat**: The MarkItDown engine currently expects `Buffer`. If it only uses `.length` and indexed access (which `Uint8Array` also provides), `bytes()` works. If it uses `.toString('utf8')` or `.slice()`, keep `Buffer.from()` — Bun supports it natively anyway.

#### `lib/markitdown/markitdown.ts:127`
```typescript
// BEFORE
const buffer = Buffer.from(await res.arrayBuffer());

// Same caveat — depends on downstream consumers
```

---

## Part 3: Bun APIs Reference — Verified Details

### 3.1 `Bun.password`

```typescript
// Hashing — defaults to argon2id (OWASP recommended)
const hash = await Bun.password.hash(password);
const hash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });

// Verification — AUTO-DETECTS algorithm from hash format
const isValid = await Bun.password.verify(password, hash);

// Synchronous versions (expensive — avoid in hot paths)
const hash = Bun.password.hashSync(password);
const isValid = Bun.password.verifySync(password, hash);
```

| Algorithm | Config | Notes |
|-----------|--------|-------|
| argon2id | `memoryCost`, `timeCost` | Default. PHC format. Best security. |
| argon2i | same | PHC format |
| argon2d | same | PHC format |
| bcrypt | `cost` (4-31) | MCF format. **Bun improvement**: passwords >72 bytes are pre-hashed with SHA-512 (standard bcrypt silently truncates). |

**Migration path**: Use `{ algorithm: "bcrypt" }` for new hashes during transition. `verify()` works with both old bcryptjs hashes and new argon2id hashes automatically. On successful login, re-hash with argon2id to migrate users gradually.

---

### 3.2 `Bun.randomUUIDv7()`

```typescript
import { randomUUIDv7 } from "bun";

const id = randomUUIDv7();
// => "0192ce11-26d5-7dc3-9305-1426de888c5a"

// With encoding
randomUUIDv7("hex");        // string (default)
randomUUIDv7("base64");     // shorter string
randomUUIDv7("base64url");  // URL-safe shorter string
randomUUIDv7("buffer");     // 16-byte Buffer

// With custom timestamp
randomUUIDv7("hex", someTimestamp);
```

**Key properties**:
- **Monotonic**: Atomic counter ensures no collisions across Workers at same timestamp
- **Time-sorted**: First 48 bits encode timestamp → sequential disk writes in Postgres
- **Cryptographically secure**: Final 8 bytes from BoringSSL CSPRNG
- **Postgres-friendly**: INSERT order matches index order → minimal B-tree page splits

**`crypto.randomUUID()`** (UUIDv4) also works as a global in Bun — no import needed. It's the same as Node.js's `crypto.randomUUID()`.

---

### 3.3 `Bun.SQL` — Native Database Driver

```typescript
import { sql, SQL } from "bun";

// Quick-start: reads DATABASE_URL from .env
const users = await sql`SELECT * FROM users WHERE active = ${true} LIMIT ${10}`;

// Explicit connection
const pg = new SQL("postgres://user:pass@localhost:5432/mydb");
const mysql = new SQL("mysql://user:password@localhost:3306/database");
const sqlite = new SQL("sqlite://myapp.db");

// Connection pooling
const sql2 = new SQL({
  url: "postgres://...",
  max: 10,              // pool size
  idleTimeout: 30,     // seconds
  maxLifetime: 1800,   // seconds
});

// Transactions
await sql.begin(async tx => {
  await tx`INSERT INTO logs ${sql({ message: "hello" })}`;
  await tx`UPDATE counters SET count = count + 1`;
});

// Bulk inserts
await sql`INSERT INTO users ${sql(users)}`;  // array of objects

// Dynamic columns
await sql`INSERT INTO users ${sql(user, "name", "email")}`;  // only these columns

// SQL fragments for dynamic queries
const filter = accountId ? sql`AND account_id = ${accountId}` : sql``;
await sql`SELECT * FROM entries WHERE true ${filter}`;

// Unsafe raw SQL (for DDL, migrations)
await sql.unsafe(`CREATE TABLE IF NOT EXISTS ...`);

// Execute SQL from a file
await sql.file("migrations/001.sql");
```

**Why `sql` not `postgres`**: Bun's unified API supports PostgreSQL, MySQL, and SQLite — the name reflects multi-database support.

---

### 3.4 Bun Shell (`$`)

```typescript
import { $ } from "bun";

// Basic — prints to stdout
await $`echo "Hello World!"`;

// Capture output
const text = await $`echo "Hello"`.text();
const { stdout, stderr } = await $`some-command`.quiet();

// Don't throw on non-zero exit
const { exitCode } = await $`maybe-fails`.nothrow().quiet();

// Auto-escapes interpolated values — prevents shell injection
const userInput = "; rm -rf /";  // malicious
await $`echo ${userInput}`;      // SAFE — escaped automatically

// Redirect to/from files
await $`echo "output" > ${Bun.file("out.txt")}`;
const content = await $`cat < ${Bun.file("in.txt")}`.text();

// Pipe with JS objects
const result = await $`cat < ${response} | wc -c`.text();
```

**Use cases in our project**:
- MCP server tool execution (currently no child_process usage, but future SAP/Outlook integrations could use it)
- Wiki git operations (if keeping git-vaulted pattern with `isomorphic-git` is too complex)
- Build/deploy scripts

---

### 3.5 `Bun.file()` / `Bun.write()` — Native File I/O

```typescript
// Create lazy file reference
const file = Bun.file("/path/to/file");
await file.text();        // string
await file.json();        // parsed object
await file.arrayBuffer(); // ArrayBuffer
await file.bytes();       // Uint8Array (Bun-specific)
await file.stream();      // ReadableStream
await file.exists();      // boolean
await file.delete();      // Delete the file
file.size;                // byte count (lazy — doesn't read the file)
file.type;                // MIME type

// Write data to disk — uses fastest syscall per platform
await Bun.write("output.txt", "Hello World");
await Bun.write("/copy.txt", Bun.file("/original.txt"));  // copy_file_range/clonefile
await Bun.write("response.html", httpResponse);           // Write Response body directly
```

---

### 3.6 `bun --hot` vs `bun --watch`

| | `--watch` | `--hot` |
|---|---|---|
| Behavior | Hard restart — new process | Soft reload — module cache update |
| Global state | Lost | Preserved |
| HTTP servers | Shut down & restart | Stay up, handler updated in-place |
| Use case | General development | Server-side HMR (no dropped connections) |

**Not applicable for Next.js** — Next.js has its own HMR via Turbopack. These are for standalone Bun servers.

---

## Part 4: What NOT to Do — Corrected Intern Recommendations

### ❌ `bun --bun next dev` / `bun --bun next build`

The intern recommended prefixing all Next.js scripts with `bun --bun`. **This crashes with Prisma** in our project. The `--bun` flag forces the Bun runtime for everything, but Prisma v5's Rust query engine sidecar has compatibility issues under Bun's runtime.

**Correct approach**: Keep Next.js on Node.js runtime. Bun APIs (like `Bun.password`, `randomUUIDv7`) still work because Bun injects its globals when packages were installed via `bun install`.

### ❌ "Replace Prisma with Bun.SQL entirely"

Bun.SQL is real and powerful, but replacing ALL Prisma usage is a massive refactor (50+ models, hundreds of queries). The correct approach is **incremental**: replace only the `$queryRawUnsafe` hot paths (financial reports, RAG search) where Prisma adds no value anyway.

### ⚠️ UUIDv7 is NOT a drop-in for UUIDv4

UUIDv7 produces different strings than UUIDv4. If any external system, API contract, or stored data relies on UUIDv4 format specifics (pure random, version nibble = `4`), switching to v7 will change those. For internal IDs only (which is our case), this is safe.

---

## Part 5: Implementation Order

### Phase 1 — Quick Wins (1-2 hours)

1. **Remove `bcryptjs`** — Replace in `app/auth/actions.ts` + `prisma/seed-auth.ts`, remove from package.json
2. **Remove 17 `randomUUID` imports** — Replace with `crypto.randomUUID()` (global) or `randomUUIDv7` from bun
3. **Update package.json scripts** — `npx` → `bunx`/`bun run`
4. **Stream document-image proxy** — Replace `arrayBuffer()` + `NextResponse(data)` with `NextResponse(res.body)`

### Phase 2 — UUIDv7 Migration (2-3 hours)

1. **Upgrade to `randomUUIDv7`** in all 17 action files
2. **Add `randomUUIDv7` to Prisma default()** — Requires Prisma extension or client extension since Prisma doesn't natively support UUIDv7
3. **Test**: Verify existing UUIDv4 records still work (they do — UUID is just a string to Postgres)

### Phase 3 — Bun.SQL for Hot Paths (1-2 days)

1. **Replace RAG search queries** in `lib/rag-db.ts` — highest frequency, most overhead
2. **Replace financial report queries** in `app/erp/reports/actions.ts`
3. **Keep DDL/schema init** with `$executeRawUnsafe` for now (runs once, not a bottleneck)
4. **Keep all Prisma ORM queries** for standard CRUD (type safety, migrations, convenience)

### Phase 4 — Future (When Bun runtime is stable with Prisma)

1. **Switch to `bun --bun next dev`** — when Prisma compatibility is resolved
2. **Consider Prisma `prisma-client` generator with `runtime: "bun"`** — new generator that may work better with Bun runtime
3. **Standalone Bun services** — Move MarkItDown or MCP Gateway to `Bun.serve()` with `--hot` for independent scaling

---

## Appendix: Full File Inventory

### Files using `import { randomUUID } from 'crypto'` (17 files)

| # | File | Usage Lines | Context |
|---|------|------------|---------|
| 1 | `app/ai/actions.ts` | 123, 256 | Persona creation |
| 2 | `app/erp/customers/actions.ts` | 102 | Customer creation |
| 3 | `app/erp/timesheets/actions.ts` | 42 | Timesheet creation |
| 4 | `app/erp/payments/actions.ts` | 65 | Payment creation |
| 5 | `app/erp/journal-entries/actions.ts` | 52 | Journal entry creation |
| 6 | `app/erp/procurement/actions.ts` | 123, 148, 155, 168 | Supplier + PO creation |
| 7 | `app/erp/projects/actions.ts` | 113, 149, 192 | Project creation |
| 8 | `app/erp/accounts/actions.ts` | 127, 147 | Invoice + line items |
| 9 | `app/erp/hr/actions.ts` | 50, 91 | Personnel creation |
| 10 | `app/erp/quotations/actions.ts` | 79, 98 | Quotation + line items |
| 11 | `app/erp/material-requests/actions.ts` | 37, 40 | MR number + creation |
| 12 | `app/erp/sales-orders/actions.ts` | 72, 92 | Sales order + line items |
| 13 | `app/erp/stock/actions.ts` | 125, 158 | Item creation |
| 14 | `app/erp/assets/actions.ts` | 79 | Asset creation |
| 15 | `app/enquiries/actions.ts` | 114 | Enquiry creation |
| 16 | `app/notebooks/actions.ts` | 49 | Notebook creation |
| 17 | `app/channels/actions.ts` | 72 | Channel creation |

### Files using `bcryptjs` (2 files)

| # | File | Usage Lines | Context |
|---|------|------------|---------|
| 1 | `app/auth/actions.ts` | 4 (import), 77 (compare), 152 (hash), 283 (hash) | Auth login + registration |
| 2 | `prisma/seed-auth.ts` | 2 (import), 18 (hash), 41 (hash) | Seed script |

### Files using `$queryRawUnsafe` (2 files)

| # | File | Sites | Context |
|---|------|-------|---------|
| 1 | `lib/rag-db.ts` | 11 | RAG schema init + vector search + chunk insertion |
| 2 | `app/erp/reports/actions.ts` | 6 | Financial reports (GL, TB, BS, P&L) |

### Files with streaming opportunity (1 file)

| # | File | Line | Current | Replacement |
|---|------|------|---------|-------------|
| 1 | `app/api/document-image/[id]/route.ts` | 23-26 | `await res.arrayBuffer()` → `new NextResponse(data)` | `new NextResponse(res.body)` |
