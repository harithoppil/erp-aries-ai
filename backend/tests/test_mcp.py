"""Tests for MCP Gateway endpoints."""
from unittest.mock import patch, AsyncMock
import pytest


class TestListServers:
    """GET /api/v1/mcp/servers"""

    async def test_list_servers(self, client):
        response = await client.get("/api/v1/mcp/servers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "id" in data[0]
        assert "name" in data[0]

    async def test_list_servers_has_expected(self, client):
        response = await client.get("/api/v1/mcp/servers")
        data = response.json()
        names = [s["name"] for s in data]
        assert "crm-server" in names


class TestListTools:
    """GET /api/v1/mcp/tools"""

    async def test_list_tools(self, client):
        response = await client.get("/api/v1/mcp/tools")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "id" in data[0]
        assert "name" in data[0]

    async def test_list_tools_has_expected(self, client):
        response = await client.get("/api/v1/mcp/tools")
        data = response.json()
        names = [t["name"] for t in data]
        assert "create_contact" in names
        assert "get_customer" in names


class TestCallTool:
    """POST /api/v1/mcp/tools/call"""

    async def test_call_tool_success(self, client):
        payload = {"tool_name": "create_contact", "params": {"name": "Alice", "email": "alice@example.com"}}
        with patch("backend.app.mcp_servers.gateway.MCPGateway.call_tool", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"tool": "create_contact", "status": "success", "result": "Contact created"}
            response = await client.post("/api/v1/mcp/tools/call", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            mock_call.assert_called_once_with("create_contact", {"name": "Alice", "email": "alice@example.com"})

    async def test_call_tool_no_name(self, client):
        payload = {"params": {"foo": "bar"}}
        response = await client.post("/api/v1/mcp/tools/call", json=payload)
        assert response.status_code == 200
        assert "error" in response.json()

    async def test_call_tool_unknown_tool(self, client):
        payload = {"tool_name": "unknown_tool_xyz", "params": {}}
        with patch("backend.app.mcp_servers.gateway.MCPGateway.call_tool", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"tool": "unknown_tool_xyz", "status": "success", "result": "Mock result"}
            response = await client.post("/api/v1/mcp/tools/call", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
