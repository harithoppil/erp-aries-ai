"""LLM Wiki service — git-versioned markdown knowledge repository (Node 7)."""

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path

import git

from backend.app.core.config import settings
from backend.app.schemas.enquiry import WikiPageRead, WikiSearchResult


class WikiService:
    def __init__(self, wiki_root: Path | None = None):
        self.wiki_root = wiki_root or settings.wiki_root
        self._ensure_repo()

    def _ensure_repo(self):
        """Initialize wiki repo if it doesn't exist."""
        self.wiki_root.mkdir(parents=True, exist_ok=True)

        if not (self.wiki_root / ".git").exists():
            repo = git.Repo.init(self.wiki_root)
            # Create initial structure
            for subdir in ["entities", "concepts", "sources", "outcomes"]:
                (self.wiki_root / subdir).mkdir(exist_ok=True)
                (self.wiki_root / subdir / ".gitkeep").touch()

            self._write_file("index.md", "# Aries Wiki Index\n\n> Auto-generated content catalog.\n\n")
            self._write_file("log.md", "# Aries Change Log\n\n> Append-only log of wiki modifications.\n\n")
            self._write_file(
                "AGENTS.md",
                "# Aries Agent Schema\n\n"
                "## Wiki Structure\n"
                "- `index.md` — Content catalog, read first on every query\n"
                "- `log.md` — Chronological append-only log\n"
                "- `AGENTS.md` — This file: schema and conventions\n"
                "- `entities/` — One page per client, project, product, contact\n"
                "- `concepts/` — Pricing patterns, margin policies, scope templates\n"
                "- `sources/` — One summary page per ingested source document\n"
                "- `outcomes/` — Post-delivery learnings\n\n"
                "## Conventions\n"
                "- Every page starts with a YAML-style metadata header\n"
                "- Entity pages: `---\\ntype: entity\\ncategory: client|project|product|contact\\n---\\n`\n"
                "- Source pages: `---\\ntype: source\\nenquiry_id: <uuid>\\nfile: <filename>\\ningested: <date>\\n---\\n`\n"
                "- Cross-references use `[[page-path]]` wiki-links\n"
                "- Log entries: `## [YYYY-MM-DD] ingest|query|lint | <title>`\n",
            )

            repo.index.add(["index.md", "log.md", "AGENTS.md"])
            for subdir in ["entities", "concepts", "sources", "outcomes"]:
                repo.index.add([f"{subdir}/.gitkeep"])
            repo.index.commit("Initial wiki structure")
        else:
            for subdir in ["entities", "concepts", "sources", "outcomes"]:
                (self.wiki_root / subdir).mkdir(exist_ok=True)

    def _get_repo(self) -> git.Repo:
        return git.Repo(self.wiki_root)

    def _write_file(self, rel_path: str, content: str):
        full_path = self.wiki_root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")

    def _read_file(self, rel_path: str) -> str | None:
        full_path = self.wiki_root / rel_path
        if not full_path.exists():
            return None
        return full_path.read_text(encoding="utf-8")

    def list_pages(self) -> list[str]:
        """List all .md files in the wiki."""
        pages = []
        for p in sorted(self.wiki_root.rglob("*.md")):
            rel = p.relative_to(self.wiki_root)
            if str(rel) == ".git":
                continue
            pages.append(str(rel))
        return pages

    def read_page(self, path: str) -> WikiPageRead | None:
        content = self._read_file(path)
        if content is None:
            return None

        repo = self._get_repo()
        last_commit = None
        last_modified = None
        try:
            commits = list(repo.iter_commits(paths=path, max_count=1))
            if commits:
                last_commit = commits[0].hexsha[:8]
                last_modified = datetime.fromtimestamp(commits[0].committed_time, tz=timezone.utc)
        except Exception:
            pass

        return WikiPageRead(path=path, content=content, last_modified=last_modified, last_commit=last_commit)

    def write_page(self, path: str, content: str, commit_message: str) -> WikiPageRead:
        """Write or update a wiki page with git commit. Append-or-merge semantics."""
        self._write_file(path, content)
        repo = self._get_repo()
        repo.index.add([path])

        # Append to log.md
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        action = "create" if not self._read_file(path) else "update"
        log_entry = f"\n## [{now}] {action} | {path}\n{commit_message}\n"
        log_content = self._read_file("log.md") or ""
        self._write_file("log.md", log_content + log_entry)
        repo.index.add(["log.md"])

        repo.index.commit(commit_message)
        return self.read_page(path)

    def delete_page(self, path: str, commit_message: str):
        full_path = self.wiki_root / path
        if full_path.exists():
            full_path.unlink()
            repo = self._get_repo()
            repo.index.remove([path])

            log_entry = f"\n## [{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] delete | {path}\n{commit_message}\n"
            log_content = self._read_file("log.md") or ""
            self._write_file("log.md", log_content + log_entry)
            repo.index.add(["log.md"])
            repo.index.commit(commit_message)

    def search(self, query: str, limit: int = 10) -> list[WikiSearchResult]:
        """Simple text search across wiki pages. Will be enhanced with BM25 + vector later."""
        results = []
        query_lower = query.lower()
        terms = query_lower.split()

        for page_path in self.list_pages():
            content = self._read_file(page_path)
            if not content:
                continue

            content_lower = content.lower()
            score = sum(1 for term in terms if term in content_lower)

            if score > 0:
                # Extract a snippet around first match
                snippet = ""
                for term in terms:
                    idx = content_lower.find(term)
                    if idx >= 0:
                        start = max(0, idx - 80)
                        end = min(len(content), idx + 120)
                        snippet = content[start:end].replace("\n", " ")
                        break

                title = Path(page_path).stem.replace("-", " ").title()
                results.append(WikiSearchResult(path=page_path, title=title, snippet=snippet, score=float(score)))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    def update_index(self):
        """Regenerate index.md with all current pages."""
        lines = ["# Aries Wiki Index\n\n> Auto-generated content catalog.\n\n"]

        categories = {"entities": [], "concepts": [], "sources": [], "outcomes": [], "root": []}
        for page_path in self.list_pages():
            if page_path in ("index.md", "log.md", "AGENTS.md"):
                continue
            parts = Path(page_path).parts
            if len(parts) > 1 and parts[0] in categories:
                categories[parts[0]].append(page_path)
            else:
                categories["root"].append(page_path)

        for cat, pages in categories.items():
            if not pages:
                continue
            lines.append(f"## {cat.title()}\n\n")
            for p in pages:
                title = Path(p).stem.replace("-", " ").title()
                lines.append(f"- [[{p}|{title}]]\n")
            lines.append("\n")

        self.write_page("index.md", "".join(lines), "Auto-regenerate index.md")

    def append_to_log(self, action: str, title: str, details: str = ""):
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        entry = f"\n## [{now}] {action} | {title}\n{details}\n"
        log_content = self._read_file("log.md") or ""
        self._write_file("log.md", log_content + entry)

        repo = self._get_repo()
        repo.index.add(["log.md"])
        repo.index.commit(f"{action}: {title}")

    # --- Async wrappers (offload blocking I/O to thread pool) ---

    async def async_read_page(self, path: str):
        """Async wrapper for read_page — offloads blocking file/git I/O to a thread."""
        return await asyncio.to_thread(self.read_page, path)

    async def async_search(self, query: str, limit: int = 10):
        """Async wrapper for search — offloads blocking file I/O to a thread."""
        return await asyncio.to_thread(self.search, query, limit)
