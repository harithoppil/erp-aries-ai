# Aries Agent Schema

## Wiki Structure
- `index.md` — Content catalog, read first on every query
- `log.md` — Chronological append-only log
- `AGENTS.md` — This file: schema and conventions
- `entities/` — One page per client, project, product, contact
- `concepts/` — Pricing patterns, margin policies, scope templates
- `sources/` — One summary page per ingested source document
- `outcomes/` — Post-delivery learnings

## Conventions
- Every page starts with a YAML-style metadata header
- Entity pages: `---\ntype: entity\ncategory: client|project|product|contact\n---\n`
- Source pages: `---\ntype: source\nenquiry_id: <uuid>\nfile: <filename>\ningested: <date>\n---\n`
- Cross-references use `[[page-path]]` wiki-links
- Log entries: `## [YYYY-MM-DD] ingest|query|lint | <title>`
