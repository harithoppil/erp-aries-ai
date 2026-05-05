"""API Key authentication middleware.

Checks for X-API-Key header or api_key query parameter against the configured
settings.api_key. If no API key is configured, authentication is skipped
(development mode).

Skips auth for health check (/health) and docs (/docs, /openapi.json, /redoc).
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.app.core.config import settings

logger = logging.getLogger("aries.auth")

# Paths that never require authentication
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware that validates API key on every request (except public paths)."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # If no API key is configured, skip auth (development mode)
        configured_key = settings.api_key
        if not configured_key:
            return await call_next(request)

        # Check X-API-Key header first, then api_key query parameter
        provided_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")

        if not provided_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "API key required. Provide X-API-Key header or api_key query parameter."},
            )

        if provided_key != configured_key:
            logger.warning("Invalid API key attempt from %s", request.client.host if request.client else "unknown")
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid API key."},
            )

        return await call_next(request)
