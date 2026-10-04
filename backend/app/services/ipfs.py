"""IPFS Service for document uploading, hash verification, and authorized retrieval."""

import hashlib
import os
from typing import Dict, Any, Tuple, Optional
import httpx
from fastapi import HTTPException, status
from app.config import settings

LOCAL_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "ipfs_cache")
os.makedirs(LOCAL_CACHE_DIR, exist_ok=True)


def compute_sha256(data: bytes) -> str:
    """Return 0x-prefixed 64-char hex SHA-256 string."""
    return "0x" + hashlib.sha256(data).hexdigest()


def generate_mock_cid(data: bytes) -> str:
    """Deterministic fallback CID when IPFS daemon is not running."""
    digest = hashlib.sha256(data).hexdigest()
    # Simple base58-like mock prefix
    return f"QmCargoChain{digest[:40]}"


async def upload_to_ipfs(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Upload document to IPFS daemon or cache locally if IPFS is unreachable."""
    sha256_hash = compute_sha256(file_bytes)
    size = len(file_bytes)

    cid = None
    # 1. Attempt upload to local IPFS API
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            files = {"file": (filename, file_bytes)}
            response = await client.post(
                f"{settings.ipfs_api_url}/api/v0/add",
                files=files,
            )
            if response.status_code == 200:
                data = response.json()
                cid = data.get("Hash")
    except Exception:
        # IPFS daemon offline; proceed with fallback
        pass

    # 2. Fallback to local mock cache
    if not cid:
        cid = generate_mock_cid(file_bytes)

    # Always persist in local cache for offline retrieval resilience
    cache_path = os.path.join(LOCAL_CACHE_DIR, cid)
    with open(cache_path, "wb") as f:
        f.write(file_bytes)

    return {
        "cid": cid,
        "sha256": sha256_hash,
        "size": size,
        "filename": filename,
    }


async def fetch_from_ipfs(cid: str) -> bytes:
    """Retrieve content by CID from IPFS daemon or local cache."""
    # Check local cache first
    cache_path = os.path.join(LOCAL_CACHE_DIR, cid)
    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return f.read()

    # Try IPFS cat
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{settings.ipfs_api_url}/api/v0/cat",
                params={"arg": cid},
            )
            if response.status_code == 200:
                content = response.content
                # Cache it
                with open(cache_path, "wb") as f:
                    f.write(content)
                return content
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": {"code": "NOT_FOUND", "message": f"Document with CID {cid} not found on IPFS or local store"}},
    )


def verify_file_integrity(file_bytes: bytes, expected_hash: str) -> Tuple[bool, str]:
    """Compare computed SHA-256 with stored on-chain hash."""
    computed_hash = compute_sha256(file_bytes)
    match = computed_hash.lower() == expected_hash.lower()
    return match, computed_hash
