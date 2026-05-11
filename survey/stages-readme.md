# Next-Stage Reports (Stages 1–4)

> Companion to the DocField-driven frontend already shipped in commit `616cb12`. Each stage is a discrete, mergeable unit of work with its own PR.

| # | Title | Effort | Depends on | Doc |
|---|---|---|---|---|
| 1 | Metadata-driven list view (`ERPListClient` + `ERPFilterBar`) | 1.5–2 days | Nothing new — `loadDocTypeMeta` from commit `616cb12` | [`stage-1-erp-list-client.md`](./stage-1-erp-list-client.md) |
| 2 | Inline child-table editing (`ERPGridClient`) | 1.5–2 days | Stage 1's `list-cell.tsx` helpers (recommended) | [`stage-2-erp-grid-client.md`](./stage-2-erp-grid-client.md) |
| 3 | Migrate 77 custom client components → generic | 2–3 days | Stage 1 + Stage 2 working | [`stage-3-migrate-custom-pages.md`](./stage-3-migrate-custom-pages.md) |
| 4 | HR Prisma port (Leave / Salary / Payroll / Attendance / Appraisal / Job Opening / Shift Type) | 3–4 days | Nothing technically, but better if Stages 1–3 are in | [`stage-4-hr-prisma-port.md`](./stage-4-hr-prisma-port.md) |

**Suggested order**: 1 → 2 → 3 → 4. They can ship as independent PRs.

Each stage report covers:
- Files to create with exact paths
- Files to modify with diffs
- Existing pieces to reuse verbatim and the lines to copy from
- Per-PR breakdown where work is large
- Testing plan (build + E2E + screenshots)
- Risks & mitigations
- Order-of-operations checklist with hourly estimates
- After-state file inventory

The reports are written for a developer (or AI agent) who has read the project once but needs the concrete plan to execute without re-discovering the codebase.
