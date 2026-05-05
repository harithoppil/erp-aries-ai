"""Tests for Document upload endpoints."""
from io import BytesIO
import pytest


class TestUploadDocument:
    """POST /api/v1/documents/{enquiry_id}/upload"""

    async def test_upload_document_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Doc Client"})
        enquiry_id = create_resp.json()["id"]
        file_content = b"Hello, this is a test document."
        response = await client.post(
            f"/api/v1/documents/{enquiry_id}/upload",
            files={"file": ("test.txt", BytesIO(file_content), "text/plain")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enquiry_id"] == enquiry_id
        assert data["filename"] == "test.txt"
        assert data["content_type"] == "text/plain"

    async def test_upload_document_not_found(self, client):
        file_content = b"Orphan document"
        response = await client.post(
            "/api/v1/documents/99999/upload",
            files={"file": ("orphan.txt", BytesIO(file_content), "text/plain")},
        )
        assert response.status_code == 404

    async def test_upload_multiple_documents(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Multi Doc"})
        enquiry_id = create_resp.json()["id"]
        for name in ["a.pdf", "b.docx"]:
            response = await client.post(
                f"/api/v1/documents/{enquiry_id}/upload",
                files={"file": (name, BytesIO(b"content"), "application/octet-stream")},
            )
            assert response.status_code == 200


class TestListDocuments:
    """GET /api/v1/documents/{enquiry_id}"""

    async def test_list_documents_empty(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "No Docs"})
        enquiry_id = create_resp.json()["id"]
        response = await client.get(f"/api/v1/documents/{enquiry_id}")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_documents_with_uploads(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Has Docs"})
        enquiry_id = create_resp.json()["id"]
        await client.post(
            f"/api/v1/documents/{enquiry_id}/upload",
            files={"file": ("report.pdf", BytesIO(b"PDF data"), "application/pdf")},
        )
        response = await client.get(f"/api/v1/documents/{enquiry_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["filename"] == "report.pdf"
