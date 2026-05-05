"""Tests for AI Pipeline endpoints."""
from unittest.mock import patch, AsyncMock
import pytest


class TestRunPipeline:
    """POST /api/v1/pipeline/run"""

    async def test_run_pipeline_success(self, client):
        # Create an enquiry first
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Pipeline Client", "industry": "Tech"})
        enquiry_id = create_resp.json()["id"]

        with patch("backend.app.api.routes.pipeline.DraftingAgent.run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = {
                "status": "completed",
                "draft": "Mock proposal draft for Pipeline Client.",
                "classification": {"category": "standard", "risk_level": "low"},
                "rules_output": {"min_margin_pct": 20.0, "policy_violations": [], "suggested_template": "standard"},
            }
            response = await client.post("/api/v1/pipeline/run", json={"enquiry_id": enquiry_id})
            assert response.status_code == 200
            data = response.json()
            assert data["enquiry_id"] == enquiry_id
            assert data["status"] == "completed"
            assert "draft" in data
            mock_run.assert_called_once()

    async def test_run_pipeline_enquiry_not_found(self, client):
        response = await client.post("/api/v1/pipeline/run", json={"enquiry_id": 99999})
        assert response.status_code == 404

    async def test_run_pipeline_mock_gemini(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={
            "client_name": "Gemini Client",
            "estimated_value": 100000,
            "estimated_cost": 80000,
        })
        enquiry_id = create_resp.json()["id"]

        with patch("backend.app.services.gemini.GeminiService.draft_proposal", new_callable=AsyncMock) as mock_draft, \
             patch("backend.app.services.gemini.GeminiService.classify_enquiry", new_callable=AsyncMock) as mock_classify:
            mock_draft.return_value = "Mocked proposal from Gemini"
            mock_classify.return_value = {"category": "premium", "risk_level": "medium"}
            response = await client.post("/api/v1/pipeline/run", json={"enquiry_id": enquiry_id})
            assert response.status_code == 200
            data = response.json()
            assert "draft" in data
            mock_draft.assert_called_once()
            mock_classify.assert_called_once()


class TestExecutePipeline:
    """POST /api/v1/pipeline/execute/{id}"""

    async def test_execute_pipeline_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Execute Client"})
        enquiry_id = create_resp.json()["id"]
        await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")

        with patch("backend.app.api.routes.pipeline.ExecuteAgent.run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = {"status": "executed", "message": "Done"}
            response = await client.post(f"/api/v1/pipeline/execute/{enquiry_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["enquiry_id"] == enquiry_id
            mock_run.assert_called_once()

    async def test_execute_pipeline_not_approved(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Not Approved"})
        enquiry_id = create_resp.json()["id"]
        response = await client.post(f"/api/v1/pipeline/execute/{enquiry_id}")
        assert response.status_code == 400
        assert "approved" in response.json()["detail"].lower()

    async def test_execute_pipeline_enquiry_not_found(self, client):
        response = await client.post("/api/v1/pipeline/execute/99999")
        assert response.status_code == 404
