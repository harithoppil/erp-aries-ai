"""Tests for AI Persona endpoints."""
import pytest


class TestListPersonas:
    """GET /api/v1/ai/personas"""

    async def test_list_personas_empty(self, client):
        response = await client.get("/api/v1/ai/personas")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_personas_after_seed(self, client):
        await client.post("/api/v1/ai/seed-personas")
        response = await client.get("/api/v1/ai/personas")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        names = [p["name"] for p in data]
        assert "Sales Assistant" in names
        assert "Technical Architect" in names
        assert "Project Manager" in names


class TestCreatePersona:
    """POST /api/v1/ai/personas"""

    async def test_create_persona_success(self, client):
        payload = {
            "name": "Custom Bot",
            "description": "A custom persona",
            "system_prompt": "You are a custom bot.",
            "model": "gemini-1.5-pro",
            "temperature": "0.2",
        }
        response = await client.post("/api/v1/ai/personas", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Bot"
        assert data["model"] == "gemini-1.5-pro"
        assert "id" in data

    async def test_create_persona_defaults(self, client):
        payload = {"name": "Minimal Bot"}
        response = await client.post("/api/v1/ai/personas", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Minimal Bot"
        assert data["model"] == "gemini-1.5-flash"


class TestSeedPersonas:
    """POST /api/v1/ai/seed-personas"""

    async def test_seed_personas_first_time(self, client):
        response = await client.post("/api/v1/ai/seed-personas")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 3
        assert "Sales Assistant" in data["seeded"]
        assert "Technical Architect" in data["seeded"]
        assert "Project Manager" in data["seeded"]

    async def test_seed_personas_idempotent(self, client):
        await client.post("/api/v1/ai/seed-personas")
        response = await client.post("/api/v1/ai/seed-personas")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["seeded"] == []
