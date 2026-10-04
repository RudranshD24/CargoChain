"""CargoChain Backend — FastAPI Application Entry Point.

Implements API_SPEC.md requirements, standard error envelopes, and CORS.
"""

import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
import httpx

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.services.blockchain import w3
from app.routers import (
    auth,
    participants,
    shipments,
    documents,
    analytics,
    admin,
    disputes,
    oracle,
    consensus,
    ml,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist on startup if DB is reachable
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    yield


app = FastAPI(
    title="CargoChain API",
    version="0.1.0",
    description="CargoChain — Smart Contract-Based Logistics and Freight Management API",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BODY_SIZE = 2 * 1024 * 1024  # 2MB limit to mitigate payload-based DoS attacks


@app.middleware("http")
async def security_hardening_middleware(request: Request, call_next):
    # Check Content-Length header to prevent oversized payload DoS
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "error": {
                    "code": "PAYLOAD_TOO_LARGE",
                    "message": f"Request body exceeds 2MB limit (received {content_length} bytes)",
                    "details": {},
                }
            },
        )

    response = await call_next(request)

    # OWASP Recommended Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Standard Error Envelope Handler (API_SPEC.md §1)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        return JSONResponse(status_code=exc.status_code, content=detail)

    code_map = {
        400: "VALIDATION_ERROR",
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        500: "INTERNAL_ERROR",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code_map.get(exc.status_code, "ERROR"),
                "message": str(detail),
                "details": {},
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": jsonable_encoder(exc.errors())},
            }
        },
    )


# Health check endpoint
@app.get("/api/v1/health", tags=["health"])
async def health():
    """Multi-component health check: API, database, blockchain node, and IPFS status."""
    db_status = "ok"
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    chain_status = "ok" if w3.is_connected() else "disconnected"
    current_block = w3.eth.block_number if w3.is_connected() else None

    ipfs_status = "offline"
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            resp = await client.post(f"{settings.ipfs_api_url}/api/v0/version")
            if resp.status_code == 200:
                ipfs_status = "ok"
    except Exception:
        ipfs_status = "local_cache_active"

    all_ok = (db_status == "ok") and (chain_status == "ok")
    return {
        "status": "ok" if all_ok else "degraded",
        "service": "cargochain-api",
        "version": "0.1.0",
        "components": {
            "database": db_status,
            "chain": {
                "status": chain_status,
                "blockNumber": current_block,
                "chainId": settings.chain_id,
            },
            "ipfs": ipfs_status,
        },
    }


# Include Routers with /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(participants.router, prefix="/api/v1")
app.include_router(shipments.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(disputes.router, prefix="/api/v1")
app.include_router(oracle.router, prefix="/api/v1")
app.include_router(consensus.router, prefix="/api/v1")
app.include_router(ml.router, prefix="/api/v1")

