"""Tests for Enquiry CRUD endpoints."""
import pytest
from unittest.mock import patch, AsyncMock


class TestCreateEnquiry:
    """POST /api/v1/enquiries/"""

    async def test_create_enquiry_success(self, client):
        payload = {
            "client_name": "Acme Corp",
            "industry": "Manufacturing",
            "description": "ERP implementation request",
            "estimated_value": 500000.0,
            "estimated_cost": 350000.0,
        }
        response = await client.post("/api/v1/enquiries/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Acme Corp"
        assert data["status"] == "draft"
        assert "id" in data

    async def test_create_enquiry_minimal(self, client):
        payload = {"client_name": "Minimal Client"}
        response = await client.post("/api/v1/enquiries/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Minimal Client"
        assert data["status"] == "draft"

    async def test_create_enquiry_empty_client_defaults(self, client):
        payload = {}
        response = await client.post("/api/v1/enquiries/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Unknown"


class TestListEnquiries:
    """GET /api/v1/enquiries/"""

    async def test_list_enquiries_empty(self, client):
        response = await client.get("/api/v1/enquiries/")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_enquiries_with_data(self, client):
        for i in range(3):
            await client.post("/api/v1/enquiries/", json={"client_name": f"Client {i}"})
        response = await client.get("/api/v1/enquiries/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert data[0]["client_name"] == "Client 0"


class TestGetEnquiry:
    """GET /api/v1/enquiries/{id}"""

    async def test_get_enquiry_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Get Me"})
        enquiry_id = create_resp.json()["id"]
        response = await client.get(f"/api/v1/enquiries/{enquiry_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == enquiry_id
        assert data["client_name"] == "Get Me"

    async def test_get_enquiry_not_found(self, client):
        response = await client.get("/api/v1/enquiries/99999")
        assert response.status_code == 404
        assert response.json()["detail"] == "Enquiry not found"


class TestUpdateEnquiry:
    """PATCH /api/v1/enquiries/{id}"""

    async def test_update_enquiry_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Old Name"})
        enquiry_id = create_resp.json()["id"]
        response = await client.patch(
            f"/api/v1/enquiries/{enquiry_id}",
            json={"client_name": "New Name", "industry": "Tech"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "New Name"

    async def test_update_enquiry_status(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Status Test"})
        enquiry_id = create_resp.json()["id"]
        response = await client.patch(
            f"/api/v1/enquiries/{enquiry_id}",
            json={"status": "pending"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    async def test_update_enquiry_not_found(self, client):
        response = await client.patch("/api/v1/enquiries/99999", json={"client_name": "Ghost"})
        assert response.status_code == 404


class TestApproveEnquiry:
    """POST /api/v1/enquiries/{id}/approve"""

    async def test_approve_enquiry_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Approve Me"})
        enquiry_id = create_resp.json()["id"]
        response = await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["message"] == "Enquiry approved"

    async def test_approve_enquiry_not_found(self, client):
        response = await client.post("/api/v1/enquiries/99999/approve")
        assert response.status_code == 404

    async def test_approve_already_approved(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Double Approve"})
        enquiry_id = create_resp.json()["id"]
        await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")
        response = await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
