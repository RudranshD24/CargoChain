"""Document upload, verification, and authorized retrieval endpoints."""

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.entities import User, Shipment, Document
from app.schemas import DocumentUploadResponse, DocumentVerifyResponse
from app.services.auth import get_current_user, require_roles
from app.services.ipfs import upload_to_ipfs, fetch_from_ipfs, verify_file_integrity
from app.routers.shipments import check_shipment_visibility

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    shipment_id: int = Form(..., alias="shipmentId"),
    doc_type: int = Form(..., alias="docType"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload document to IPFS and return hash + CID (Shipper or Inspector only).
    Does NOT write to blockchain — on-chain anchoring is user-signed via MetaMask.
    """
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {shipment_id} not found"}},
        )

    # Only Shipper or assigned Inspector (or Admin) can upload
    addr = user.wallet_address.lower()
    is_shipper = addr == shipment.shipper.lower()
    is_inspector = shipment.inspector and addr == shipment.inspector.lower()
    is_admin = user.role == 1

    if not (is_shipper or is_inspector or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only the assigned Shipper or Inspector may upload documents"}},
        )

    file_bytes = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "VALIDATION_ERROR", "message": f"File size exceeds maximum {settings.max_upload_mb} MB limit"}},
        )

    result = await upload_to_ipfs(file_bytes, file.filename or "document.bin")
    return DocumentUploadResponse(
        cid=result["cid"],
        sha256=result["sha256"],
        size=result["size"],
        filename=result["filename"],
    )


@router.post("/verify", response_model=DocumentVerifyResponse)
async def verify_document(
    file: UploadFile = File(...),
    shipment_id: int = Form(..., alias="shipmentId"),
    doc_index: int = Form(..., alias="docIndex"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify raw file integrity against on-chain anchored hash (Involved parties / Admin only)."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {shipment_id} not found"}},
        )

    check_shipment_visibility(user, shipment)

    doc = (
        db.query(Document)
        .filter(Document.shipment_id == shipment_id, Document.doc_index == doc_index)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Document index {doc_index} not anchored for shipment {shipment_id}"}},
        )

    file_bytes = await file.read()
    match, computed = verify_file_integrity(file_bytes, doc.content_hash)

    return DocumentVerifyResponse(
        match=match,
        expectedHash=doc.content_hash,
        computedHash=computed,
        cid=doc.cid,
    )


@router.get("/{cid}")
async def get_document_by_cid(
    cid: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authorized IPFS proxy download. Verifies caller is involved with the associated shipment."""
    # Admin can download any document
    is_admin = user.role == 1
    if not is_admin:
        docs = db.query(Document).filter(Document.cid == cid).all()
        if not docs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": f"Document with CID {cid} not found or not anchored to any accessible shipment"}},
            )
        authorized = False
        for doc in docs:
            shipment = db.query(Shipment).filter(Shipment.shipment_id == doc.shipment_id).first()
            if shipment:
                try:
                    check_shipment_visibility(user, shipment)
                    authorized = True
                    break
                except HTTPException:
                    continue
        if not authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "Caller is not authorized to access documents for this shipment"}},
            )

    data = await fetch_from_ipfs(cid)
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{cid}"'},
    )
