# LLM Wiki as RAG Replacement — Design Document

> Aries ERP AI — Architecture proposal
> Date: 2026-05-08
> Sources: "LLM Wiki" concept (unknown author), Andrej Karpathy's personal knowledge base workflow, project codebase audit

---

## 1. The Problem with RAG

Most LLM+document systems work like this:

```
User query → embed query → pgvector search on chunks → return top-20 raw fragments
                ↓
         LLM synthesizes answer from scratch
                ↓
         Answer appears in chat, then DISAPPEARS
```

**This is stateless.** Every query re-derives knowledge from raw fragments. Ask "What's Acme Corp's procurement process?" twice, it chunks+retrieves+synthesizes twice. No accumulation. No cross-referencing. No contradiction detection.

Our current `rag_chunks` table stores document fragments (1000 chars, 200 overlap). The chunks are:
- **Isolated** — no links between related chunks
- **Raw** — not synthesized, not deduplicated
- **Fragile** — overlapping chunks can contradict each other
- **Disposable** — answers derived from chunks vanish into chat history

---

## 2. The LLM Wiki Concept

The core idea (from both the "LLM Wiki" concept document and Karpathy's workflow):

Instead of retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked collection of knowledge pages that sits between you and the raw sources. When you add a new source, the LLM doesn't just index it for later retrieval. It reads it, extracts key information, and **integrates it into the existing wiki** — updating entity pages, revising topic summaries, noting where new data contradicts old claims, strengthening or challenging the evolving synthesis.

**The wiki is a persistent, compounding artifact.** The cross-references are already there. The contradictions have already been flagged. The synthesis already reflects everything you've read. The wiki keeps getting richer with every source you add and every question you ask.

You never (or rarely) write the wiki yourself — the LLM writes and maintains all of it. You're in charge of sourcing, exploration, and asking the right questions. The LLM does the grunt work — summarizing, cross-referencing, filing, and bookkeeping.

---

## 3. Karpathy's Validation at Scale

Andrej Karpathy has been using this pattern with ~100 articles and ~400K words. Key observations from his workflow:

### What He Does
- **Data ingest**: Index source documents into `raw/` directory, use LLM to incrementally "compile" a wiki (.md files in a directory structure). Obsidian Web Clipper converts web articles to .md; hotkey downloads all related images locally.
- **IDE**: Obsidian as the frontend to view raw data, compiled wiki, and derived visualizations. The LLM writes and maintains all wiki data — Karpathy rarely touches it directly.
- **Q&A**: Once the wiki is big enough, he asks complex questions against it. The LLM researches answers using the wiki. **Key insight: he thought he'd need fancy RAG, but the LLM has been pretty good at auto-maintaining index files and brief summaries, and it reads all important related data fairly easily at this ~small scale.**
- **Output**: Renders markdown files, slide shows (Marp format), matplotlib images — all viewable in Obsidian. Outputs often get "filed" back into the wiki, so explorations and queries always "add up" in the knowledge base.
- **Linting**: LLM health checks — find inconsistent data, impute missing data (with web searches), find interesting connections for new article candidates, incrementally clean up and enhance data integrity.
- **Extra tools**: Vibe-coded a small search engine over the wiki, used both in a web UI and as a CLI tool for LLM to use in larger queries.

### What He Hasn't Built (Yet)
> "I think there is room here for an incredible new product instead of a hacky collection of scripts."

He's using scripts + Obsidian + manual index files. No structured schema, no graph queries, no business data integration, no multi-user support, no concurrent writes. The wiki is isolated from everything else.

---

## 4. Elevating to Postgres

Moving the wiki from filesystem to Postgres preserves Karpathy's entire workflow while adding capabilities that are **impossible with files**:

### 4.1 Schema Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     POSTGRES LLM WIKI                           │
├──────────────┬──────────────────────────────────────────────────┤
│              │  id (UUIDv7), path (TEXT, unique),               │
│              │  title (TEXT), content (TEXT — markdown),          │
│  wiki_pages  │  category (TEXT: entity/concept/source/outcome/  │
│              │           synthesis/comparison/analysis/...),      │
│              │  embedding VECTOR(768), tsv TSVECTOR,             │
│              │  metadata_json (JSONB),                          │
│              │  created_at, updated_at                           │
├──────────────┼──────────────────────────────────────────────────┤
│ wiki_page_   │  id, page_id (FK → wiki_pages),                  │
│ versions     │  content (TEXT — full page content at that point),│
│              │  change_type (create/update/delete),              │
│              │  edited_by (TEXT: "llm" | user email),            │
│              │  summary (TEXT — what changed and why),           │
│              │  created_at                                      │
├──────────────┼──────────────────────────────────────────────────┤
│ wiki_links   │  from_page_id (FK → wiki_pages),                │
│              │  to_page_id (FK → wiki_pages),                    │
│              │  link_type (TEXT: references/contradicts/        │
│              │             supersedes/related/derived_from),    │
│              │  context (TEXT — surrounding paragraph)          │
├──────────────┼──────────────────────────────────────────────────┤
│ wiki_sources │  id, filename (TEXT), content_type (TEXT),       │
│ (immutable)  │  raw_text (TEXT — extracted text from document), │
│              │  storage_path (TEXT — GCS/local path),           │
│              │  metadata_json (JSONB),                          │
│              │  ingested_at                                     │
├──────────────┼──────────────────────────────────────────────────┤
│ wiki_source_ │  source_id (FK → wiki_sources),                 │
│ pages        │  page_id (FK → wiki_pages),                      │
│              │  relationship (TEXT — how the page derives        │
│              │                    from this source)             │
├──────────────┼──────────────────────────────────────────────────┤
│ wiki_log     │  id, event_type (TEXT: ingest/query/lint/update/ │
│ (replaces    │          create/delete/link_update),             │
│  log.md)     │  detail (TEXT), pages_affected (TEXT[]),        │
│              │  actor (TEXT: "llm" | user email),              │
│              │  created_at                                      │
└──────────────┴──────────────────────────────────────────────────┘
```

### 4.2 What Each Table Replaces from the Filesystem Version

| Filesystem Concept | Postgres Equivalent | What You Gain |
|---|---|---|
| `wiki/entities/acme-corp.md` | `wiki_pages` row with `category='entity'` | SQL queries, JOINs with ERP data, concurrent access, access control |
| `git log wiki/entities/acme-corp.md` | `wiki_page_versions` rows | Structured version history with `change_type`, `edited_by`, `summary` |
| `[[acme-corp]]` markdown links | `wiki_links` rows with `link_type` | **Graph queries** — find all pages linked TO an entity, find orphans, compute hub scores |
| `index.md` (auto-generated catalog) | `SELECT * FROM wiki_pages WHERE category = $1` | Always current, no regeneration needed, filterable, paginated |
| `log.md` (append-only audit) | `wiki_log` table | Queryable — "what did the LLM change last week?", "which sources were ingested in April?" |
| `grep` / custom CLI search engine | `tsvector` full-text + `pgvector` semantic | Hybrid search with ranking, already working, no vibe-coded tool needed |
| Git for version control | `wiki_page_versions` + `wiki_log` | No git dependency, no repo on disk, works in serverless/cloud, no merge conflicts |
| Manual `index.md` regeneration | No index file needed | `SELECT` is always current — the database IS the index |

### 4.3 The `wiki_links` Table — The Game-Changer

Markdown `[[wikilinks]]` are strings — unqueryable. In Postgres, links become **edges in a directed graph**:

```sql
-- What pages reference "Acme Corp"?
SELECT p.title, l.context, l.link_type
FROM wiki_links l
JOIN wiki_pages p ON p.id = l.from_page_id
WHERE l.to_page_id = 'acme-corp-id';

-- Orphan pages (no inbound links) — candidates for lint/cleanup
SELECT p.title, p.category
FROM wiki_pages p
WHERE NOT EXISTS (
  SELECT 1 FROM wiki_links l WHERE l.to_page_id = p.id
);

-- Hub pages (most linked-to) — your key concepts
SELECT p.title, COUNT(*) as inbound_links
FROM wiki_links l
JOIN wiki_pages p ON p.id = l.to_page_id
GROUP BY p.id, p.title
ORDER BY inbound_links DESC
LIMIT 20;

-- Contradiction detection — pages that link to the same entity with "contradicts" vs "references"
SELECT p1.title as source, p2.title as contradicts, p3.title as references
FROM wiki_links l1
JOIN wiki_links l2 ON l1.to_page_id = l2.to_page_id
JOIN wiki_pages p1 ON p1.id = l1.from_page_id
JOIN wiki_pages p2 ON p2.id = l2.from_page_id
JOIN wiki_pages p3 ON l1.to_page_id = p3.id
WHERE l1.link_type = 'contradicts' AND l2.link_type = 'references';

-- 2-hop graph traversal from "Acme Corp"
WITH RECURSIVE graph AS (
  SELECT to_page_id, 1 as depth
  FROM wiki_links WHERE from_page_id = 'acme-corp-id'
  UNION ALL
  SELECT l.to_page_id, g.depth + 1
  FROM wiki_links l JOIN graph g ON l.from_page_id = g.to_page_id
  WHERE g.depth < 2
)
SELECT DISTINCT p.title, p.category FROM graph g
JOIN wiki_pages p ON p.id = g.to_page_id;

-- Unlinked mentions — pages that NAME an entity but don't LINK to it
-- (This is impossible with filesystem wikis — requires NLP + graph comparison)
SELECT p.id, p.title, e.title as mentioned_entity
FROM wiki_pages p
JOIN wiki_pages e ON e.category = 'entity'
WHERE p.content ILIKE '%' || e.title || '%'
  AND p.id != e.id
  AND NOT EXISTS (
    SELECT 1 FROM wiki_links l
    WHERE l.from_page_id = p.id AND l.to_page_id = e.id
  );
```

---

## 5. How This Replaces RAG

### 5.1 Current RAG Pipeline (what we have)

```
User query → embed query → pgvector search on rag_chunks → return top-20 chunks
                ↓
         LLM synthesizes answer from raw fragments
                ↓
         Answer appears in chat, then DISAPPEARS
```

Problems:
- Fragments may miss context, overlap oddly, or contradict each other
- LLM must detect contradictions between chunks at query time
- No accumulation — every query starts from scratch
- Answers vanish into chat history instead of compounding

### 5.2 LLM Wiki as RAG Replacement

```
User query → embed query → 3-layer search on wiki_PAGES (not chunks)
                ↓
         Layer 1: Semantic search (pgvector on wiki_pages)
         Layer 2: Graph traversal (follow wiki_links for related pages)
         Layer 3: Keyword fallback (tsvector full-text)
                ↓
         Merge + deduplicate → LLM reads pre-compiled, cross-referenced pages
                ↓
         LLM synthesizes answer (from coherent pages, not raw fragments)
                ↓
         Answer appears in chat + gets FILED BACK into wiki as new page
```

### 5.3 Comparison: RAG vs LLM Wiki

| | RAG (chunks) | LLM Wiki (pages) |
|---|---|---|
| **What's stored** | Raw document fragments (1000 chars, 200 overlap) | LLM-synthesized pages (structured, cross-referenced, deduplicated) |
| **Retrieval quality** | Fragments may miss context, overlap oddly, contradict each other | Pages are coherent, self-contained, already resolve contradictions |
| **Compounding** | None — every query starts from scratch | Yes — answers get filed back, wiki grows richer |
| **Cross-references** | None — chunks are isolated | Explicit `wiki_links` with `link_type` — LLM follows links to get related context |
| **Contradiction handling** | LLM must detect at query time | Contradictions already flagged and noted in wiki pages during ingest |
| **Maintenance** | None — just re-chunk when docs change | LLM lint pass — finds orphans, stale claims, missing links, unlinked mentions |
| **Graph navigation** | Impossible | `wiki_links` enables 2-hop, N-hop traversal |
| **ERP integration** | None — chunks are isolated from business data | Wiki pages JOIN with enquiries, invoices, customers |

### 5.4 The 3-Layer Query Strategy

```typescript
async function wikiQuery(question: string) {
  const qEmb = await embed(question);

  // Layer 1: Semantic search on wiki_pages (replaces pgvector chunk search)
  const semantic = await sql`
    SELECT id, title, content, category,
           1 - (embedding <=> ${qEmb}::vector(768)) AS similarity
    FROM wiki_pages
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${qEmb}::vector(768)
    LIMIT 5
  `;

  // Layer 2: Follow wiki_links from top pages (1-2 hops)
  // This is what makes it better than RAG — structured graph navigation
  const topIds = semantic.map(p => p.id);
  const related = await sql`
    SELECT DISTINCT p.id, p.title, p.content, l.link_type
    FROM wiki_links l
    JOIN wiki_pages p ON p.id = l.to_page_id
    WHERE l.from_page_id IN (${sql(topIds)})
      AND l.link_type NOT IN ('contradicts')
    LIMIT 10
  `;

  // Layer 3: Keyword fallback on tsvector
  const keyword = await sql`
    SELECT id, title, content,
           ts_rank_cd(tsv, plainto_tsquery('english', ${question})) AS rank
    FROM wiki_pages
    WHERE tsv @@ plainto_tsquery('english', ${question})
    ORDER BY rank DESC
    LIMIT 5
  `;

  // Merge + deduplicate → give LLM all relevant wiki pages
  const context = mergeAndDedup(semantic, related, keyword);

  // LLM synthesizes answer from pre-compiled pages
  // Then FILES the answer back as a new wiki page (if valuable)
  return { answer: await llmSynthesize(question, context), context };
}
```

Why this is strictly better than RAG:
1. The LLM receives **coherent pages** (not fragmented chunks)
2. It gets **related pages via links** (not just similarity — actual semantic connections, typed: references, contradicts, supersedes)
3. The answer **compounds** — filed back into the wiki for future queries
4. Future queries on the same topic hit the already-synthesized page directly

---

## 6. Karpathy's Filesystem vs Our Postgres — Feature Comparison

| Capability | Karpathy (files + Obsidian) | Our Postgres LLM Wiki |
|---|---|---|
| **Page storage** | `.md` files on disk | `wiki_pages` rows — queryable, joinable, concurrent |
| **Links** | `[[wikilinks]]` — strings, unqueryable | `wiki_links` table — graph queries (orphans, hubs, 2-hop traversal, link_type) |
| **Version history** | `git log` — CLI only | `wiki_page_versions` — SQL queryable, structured change metadata |
| **Search** | Custom vibe-coded CLI search engine | Built-in: `tsvector` full-text + `pgvector` semantic — no extra tool needed |
| **Index/catalog** | `index.md` file — LLM must regenerate after every edit | `SELECT * FROM wiki_pages` — always current, no regeneration |
| **Audit trail** | `log.md` file — `grep "^## \[" log.md \| tail -5` | `wiki_log` table — SQL filterable by event type, actor, date range |
| **Cross-data joins** | Impossible — wiki is isolated from other data | `wiki_pages JOIN enquiries ON ...` — wiki context about a client appears alongside their ERP record |
| **Concurrent writes** | One person at a time (git merge conflicts) | Multi-user — Postgres handles concurrency, row-level locking |
| **Access control** | Filesystem permissions (all or nothing) | Row-level — sales team sees sales wiki, finance sees finance wiki |
| **Scale limit** | ~400K words before needing custom search engine | Postgres handles billions of rows — no practical limit |
| **Output filing** | LLM writes .md files manually | LLM calls `createWikiPage()` Server Action — type-safe, validated, with auto-embedding |
| **Lint queries** | LLM reads all files, finds inconsistencies manually | SQL detects orphans, unlinked mentions, stale pages, contradictions in milliseconds |
| **Contradiction tracking** | LLM notices (or doesn't) at query time | `wiki_links` with `link_type='contradicts'` — explicitly tracked, queryable |
| **Staleness detection** | Manual | Auto-detectable via ERP JOINs (see below) |

---

## 7. The Killer Feature: ERP Integration

Karpathy's wiki is **isolated** — a knowledge island. Our wiki lives in the **same database as the entire ERP**. This enables queries that are impossible with filesystem wikis:

### Auto-Detect Stale Wiki Pages

```sql
-- Entity pages where new business data exists after the wiki was last updated
-- The wiki KNOWS it needs a refresh
SELECT w.id, w.title, w.updated_at,
       COUNT(i.id) as recent_invoices,
       MAX(i.created_at) as latest_invoice
FROM wiki_pages w
JOIN invoices i ON i.client_id IN (
  SELECT c.id FROM customers c
  WHERE c.customer_name ILIKE '%' || w.title || '%'
)
WHERE w.category = 'entity'
  AND i.created_at > w.updated_at  -- invoices newer than the wiki page
GROUP BY w.id, w.title, w.updated_at
ORDER BY recent_invoices DESC;
```

### Wiki Context in Business Workflows

```sql
-- When viewing an enquiry, pull wiki knowledge about the client
SELECT w.title, w.content, w.category
FROM wiki_pages w
WHERE w.category = 'entity'
  AND w.title ILIKE '%' || :client_name || '%'
ORDER BY w.updated_at DESC;

-- When viewing a quotation, pull wiki knowledge about the industry
SELECT w.title, w.content
FROM wiki_pages w
JOIN wiki_links l ON l.from_page_id = w.id
JOIN wiki_pages e ON e.id = l.to_page_id
WHERE e.category = 'concept'
  AND e.title ILIKE '%' || :industry || '%'
  AND l.link_type IN ('references', 'related');
```

### Automated Knowledge Graph for the Entire Business

Every entity in the ERP (customers, suppliers, projects, assets) can have a wiki page that:
- Is **auto-created** when the entity is first added
- Is **auto-updated** when related business events occur (new invoice, payment, stock movement)
- Is **cross-linked** with other entities the LLM discovers connections between
- **Answers questions** that span both structured ERP data and unstructured knowledge

---

## 8. Implementation Phases

### Phase 1: Wiki → Postgres (immediate — same pattern as 14 prior migrations)

1. Add `wiki_pages`, `wiki_page_versions`, `wiki_links`, `wiki_sources`, `wiki_source_pages`, `wiki_log` to Prisma schema
2. Run `bunx --bun prisma db push` to create tables
3. Rewrite `app/wiki/actions.ts` from `apiFetch(API_BASE + /wiki/*)` to direct Prisma calls
4. Update `app/wiki/page.tsx` to use new action signatures (same pattern as enquiries/notebooks)
5. Update MCP gateway wiki tools to use Prisma instead of Python proxy

**Effort**: Low (1-2 hours) — we've done this exact migration 14 times already.

**Result**: Eliminates Python dependency for wiki. Wiki CRUD, search, version history all work from Postgres.

### Phase 2: LLM Wiki Engine (the Karpathy loop, in Postgres)

Add the "LLM as wiki maintainer" intelligence layer:

1. **Ingest hook** — When a document is uploaded → LLM reads it → writes/updates wiki pages → creates `wiki_links` → logs in `wiki_log`
2. **Enquiry hook** — When an enquiry is created → LLM writes/updates entity page for the client → links to industry concepts
3. **Query engine** — The 3-layer search (semantic + graph + keyword) on `wiki_pages`
4. **Filing** — Answer pages get created via `createWikiPage()` with `category='synthesis'` or `category='analysis'`
5. **Lint cron** — Periodic health check using SQL queries:
   - Orphan pages (no inbound links)
   - Unlinked mentions (entity named in content but no `wiki_links` row)
   - Stale pages (ERP data newer than wiki page)
   - Missing entity pages (customers/suppliers with no wiki page)
   - Contradictions (pages linked with `link_type='contradicts'`)

**Effort**: Medium (1-2 days) — the LLM integration is new logic, but the data layer is already built in Phase 1.

**Result**: The wiki maintains itself. Knowledge compounds. The LLM is a disciplined wiki maintainer, not a generic chatbot.

### Phase 3: RAG Replacement

1. Default search goes to `wiki_pages` (pre-compiled) instead of `rag_chunks` (raw fragments)
2. `rag_chunks` becomes **ingest-only** — used during initial document processing, before the LLM has had time to compile wiki pages from the content
3. Eventually `rag_chunks` is only for "I just uploaded this 5 seconds ago and the LLM hasn't compiled it yet"
4. The wiki *is* the RAG — but better, because it's pre-synthesized, cross-referenced, and compounding

**Effort**: Medium (1 day) — swap the search target from `rag_chunks` to `wiki_pages` in the AI chat panel.

**Result**: RAG is replaced by a strictly superior system. Same search UX, better results.

---

## 9. What Karpathy Hasn't Built (That We Will)

> "I think there is room here for an incredible new product instead of a hacky collection of scripts"

| Karpathy's Gap | Our Implementation |
|---|---|
| **Scripts + manual index files** | Structured Prisma schema, typed Server Actions |
| **Unqueryable `[[wikilinks]]`** | `wiki_links` table with `link_type` — graph queries |
| **Isolated knowledge island** | Wiki lives alongside ERP data — cross-data JOINs |
| **Single-user (git repo)** | Multi-user Postgres with concurrent writes |
| **Custom CLI search engine** | Built-in hybrid search (semantic + keyword + graph) |
| **Manual index.md regeneration** | No index file — `SELECT` is always current |
| **No staleness detection** | Auto-detect via ERP JOINs (invoices newer than wiki page) |
| **No structured version metadata** | `wiki_page_versions` with `change_type`, `edited_by`, `summary` |
| **No typed links** | `link_type`: references / contradicts / supersedes / related / derived_from |
| **No contradiction tracking** | Explicit `wiki_links` with `link_type='contradicts'` |
| **No automated ingest** | Hooks: enquiry created → LLM writes entity page |
| **No lint SQL** | Orphans, unlinked mentions, stale pages — one SQL query each |
| **No answer filing** | `createWikiPage({ category: 'synthesis' })` — answers compound |

The product Karpathy is imagining — **a structured, queryable, auto-maintained knowledge engine that replaces both filesystem wikis and traditional RAG, integrated with business operations** — is exactly what this architecture delivers.

---

## 10. API Design — Server Actions

### CRUD (Phase 1 — same pattern as enquiries/notebooks)

```typescript
// app/wiki/actions.ts

export async function listWikiPages(category?: string): Promise<
  { success: true; pages: WikiPage[] } | { success: false; error: string }
>

export async function getWikiPage(id: string): Promise<
  { success: true; page: WikiPage; versions: WikiPageVersion[] } | { success: false; error: string }
>

export async function createWikiPage(data: {
  title: string;
  content: string;
  category: string;
  path?: string;
}): Promise<
  { success: true; page: WikiPage } | { success: false; error: string }
>

export async function updateWikiPage(id: string, data: {
  title?: string;
  content?: string;
  category?: string;
  changeSummary?: string;
}): Promise<
  { success: true; page: WikiPage } | { success: false; error: string }
>

export async function deleteWikiPage(id: string): Promise<
  { success: true } | { success: false; error: string }
>
```

### Search (Phase 1)

```typescript
export async function searchWiki(query: string, options?: {
  category?: string;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  limit?: number;
}): Promise<
  { success: true; results: WikiSearchResult[] } | { success: false; error: string }
>
```

### LLM Engine (Phase 2)

```typescript
export async function ingestDocument(sourceId: string): Promise<
  { success: true; pagesCreated: number; pagesUpdated: number; linksCreated: number }
  | { success: false; error: string }
>

export async function wikiQuery(question: string): Promise<
  { success: true; answer: string; contextPages: WikiPage[]; answerPageId?: string }
  | { success: false; error: string }
>

export async function lintWiki(): Promise<
  { success: true; issues: WikiLintIssue[] } | { success: false; error: string }
>
```

### Graph Operations (Phase 2)

```typescript
export async function getRelatedPages(pageId: string, depth?: number): Promise<
  { success: true; pages: WikiPage[]; links: WikiLink[] } | { success: false; error: string }
>

export async function getPageBacklinks(pageId: string): Promise<
  { success: true; backlinks: WikiLink[] } | { success: false; error: string }
>

export async function createWikiLink(fromId: string, toId: string, linkType: string, context?: string): Promise<
  { success: true } | { success: false; error: string }
>
```

---

## 11. Prisma Schema Addition

```prisma
model wiki_pages {
  id            String    @id @default(autoincrement())
  path          String?  @unique
  title         String
  content       String?
  category      String    @default("concept")
  embedding     Unsupported("vector(768)")?
  tsv           Unsupported("tsvector")?
  metadata_json Json?
  created_at    DateTime  @default(now()) @db.Timestamptz()
  updated_at    DateTime  @default(now()) @updatedAt @db.Timestamptz()

  versions      wiki_page_versions[]
  links_from    wiki_links[]   @relation("WikiLinkFrom")
  links_to      wiki_links[]   @relation("WikiLinkTo")
  source_pages   wiki_source_pages[]
  log_entries   wiki_log[]
}

model wiki_page_versions {
  id          Int      @id @default(autoincrement())
  page_id     String
  content     String
  change_type String   @default("update")  // create, update, delete
  edited_by   String   @default("llm")     // llm | user email
  summary     String?  // what changed and why
  created_at  DateTime @default(now()) @db.Timestamptz()

  page        wiki_pages @relation(fields: [page_id], references: [id], onDelete: Cascade)

  @@index([page_id])
  @@index([created_at])
}

model wiki_links {
  from_page_id String
  to_page_id   String
  link_type    String   @default("references")  // references, contradicts, supersedes, related, derived_from
  context      String?  // surrounding paragraph text

  from_page    wiki_pages @relation("WikiLinkFrom", fields: [from_page_id], references: [id], onDelete: Cascade)
  to_page      wiki_pages @relation("WikiLinkTo", fields: [to_page_id], references: [id], onDelete: Cascade)

  @@id([from_page_id, to_page_id, link_type])
  @@index([from_page_id])
  @@index([to_page_id])
}

model wiki_sources {
  id             String   @id @default(autoincrement())
  filename       String
  content_type   String
  raw_text       String?
  storage_path   String?
  metadata_json  Json?
  ingested_at    DateTime @default(now()) @db.Timestamptz()

  source_pages   wiki_source_pages[]
}

model wiki_source_pages {
  source_id    String
  page_id      String
  relationship String?  // how the page derives from this source

  source       wiki_sources @relation(fields: [source_id], references: [id], onDelete: Cascade)
  page         wiki_pages   @relation(fields: [page_id], references: [id], onDelete: Cascade)

  @@id([source_id, page_id])
}

model wiki_log {
  id              Int      @id @default(autoincrement())
  event_type      String   // ingest, query, lint, update, create, delete, link_update
  detail          String?
  pages_affected  String[]
  actor           String   @default("llm")  // llm | user email
  created_at      DateTime @default(now()) @db.Timestamptz()

  @@index([event_type])
  @@index([created_at])
}
```

---

## 12. Migration of Existing Wiki Content

If the Python wiki has existing content in the git repo, migration is straightforward:

1. Read all `.md` files from the `wiki/` git repo on disk
2. Parse `[[wikilinks]]` from each file → create `wiki_links` rows
3. Parse frontmatter (if any) → populate `metadata_json`
4. Infer `category` from directory structure (entities/ → entity, concepts/ → concept, etc.)
5. Generate embeddings for each page via `lib/rag-embed.ts`
6. Insert into `wiki_pages` + `wiki_links`
7. Create initial `wiki_page_versions` entries with `change_type='create'`, `edited_by='migration'`

This is a one-time script — after it runs, the Python wiki is fully migrated and the git repo can be archived.

---

## 13. Summary

| | Current State | After Phase 3 |
|---|---|---|
| Wiki storage | Python git vault (filesystem) | Postgres (`wiki_pages` + `wiki_links`) |
| Wiki search | Python `/wiki/search` | Hybrid: semantic (pgvector) + keyword (tsvector) + graph (wiki_links) |
| Knowledge retrieval | RAG chunks (`rag_chunks`) | Pre-compiled wiki pages (`wiki_pages`) + graph traversal |
| Knowledge accumulation | None — answers vanish | Answers filed back into wiki, compounding |
| Version history | Git commits | `wiki_page_versions` with structured metadata |
| Cross-referencing | Manual `[[links]]` | Typed graph edges with `link_type` |
| ERP integration | None | Cross-data JOINs, auto-staleness detection |
| Maintenance | Manual | LLM lint cron (orphans, contradictions, stale pages) |
| Python backend dependency | Required for wiki | Eliminated for wiki |

**The product Karpathy is imagining — a structured, queryable, auto-maintained knowledge engine that replaces both filesystem wikis and traditional RAG, integrated with business operations — is exactly what this delivers.**
