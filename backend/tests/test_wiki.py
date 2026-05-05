"""Tests for Wiki endpoints."""
import pytest


class TestListPages:
    """GET /api/v1/wiki/pages"""

    async def test_list_pages_empty(self, client):
        response = await client.get("/api/v1/wiki/pages")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_pages_with_content(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "index.md", "content": "# Home"})
        await client.post("/api/v1/wiki/pages", json={"path": "concepts/erp.md", "content": "# ERP"})
        response = await client.get("/api/v1/wiki/pages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        paths = [p["path"] for p in data]
        assert "index.md" in paths
        assert "concepts/erp.md" in paths


class TestCreatePage:
    """POST /api/v1/wiki/pages"""

    async def test_create_page_success(self, client):
        payload = {"path": "test.md", "content": "# Test Page", "message": "Initial commit"}
        response = await client.post("/api/v1/wiki/pages", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "test.md"
        assert data["title"] == "test"

    async def test_create_page_no_path(self, client):
        payload = {"content": "No path here"}
        response = await client.post("/api/v1/wiki/pages", json=payload)
        assert response.status_code == 200
        assert "error" in response.json()

    async def test_create_page_nested_path(self, client):
        payload = {"path": "docs/nested/page.md", "content": "# Nested"}
        response = await client.post("/api/v1/wiki/pages", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "docs/nested/page.md"


class TestReadPage:
    """GET /api/v1/wiki/pages/{path}"""

    async def test_read_page_success(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "readme.md", "content": "# README\nHello world"})
        response = await client.get("/api/v1/wiki/pages/readme.md")
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "readme.md"
        assert "Hello world" in data["content"]

    async def test_read_page_not_found(self, client):
        response = await client.get("/api/v1/wiki/pages/nonexistent.md")
        assert response.status_code == 200
        assert response.json()["error"] == "Page not found"

    async def test_read_page_nested(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "foo/bar/baz.md", "content": "# Baz"})
        response = await client.get("/api/v1/wiki/pages/foo/bar/baz.md")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "baz"


class TestSearchWiki:
    """GET /api/v1/wiki/search?q=..."""

    async def test_search_wiki_found(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "python.md", "content": "# Python\nPython is great"})
        await client.post("/api/v1/wiki/pages", json={"path": "java.md", "content": "# Java\nJava is verbose"})
        response = await client.get("/api/v1/wiki/search?q=python")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any("python" in r["path"].lower() for r in data)

    async def test_search_wiki_not_found(self, client):
        response = await client.get("/api/v1/wiki/search?q=xyz123notfound")
        assert response.status_code == 200
        assert response.json() == []

    async def test_search_wiki_limit(self, client):
        for i in range(5):
            await client.post("/api/v1/wiki/pages", json={"path": f"page{i}.md", "content": f"# Page {i}\ncontent about testing"})
        response = await client.get("/api/v1/wiki/search?q=testing&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2
