"""Disputes router per API_SPEC.md (ADV scope)."""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.entities import User, Dispute, Shipment
from app.schemas import (
    DisputeItem,
    DisputesListResponse,
    DISPUTE_REASON_NAMES,
    RESOLUTION_NAMES,
)
from app.services.auth import get_current_user
from app.routers.shipments import check_shipment_visibility

router = APIRouter(prefix="/disputes", tags=["disputes"])


def dispute_to_item(d: Dispute) -> DisputeItem:
    res_name = RESOLUTION_NAMES.get(d.resolution) if d.resolution is not None else None
    return DisputeItem(
        id=d.id,
        shipmentId=d.shipment_id,
        reason=d.reason,
        reasonName=DISPUTE_REASON_NAMES.get(d.reason, "Other"),
        notes=d.notes,
        raisedBy=d.raised_by,
        isResolved=d.is_resolved,
        resolution=d.resolution,
        resolutionName=res_name,
        adminNotes=d.admin_notes,
        resolvedBy=d.resolved_by,
        raisedAt=d.raised_at,
        resolvedAt=d.resolved_at,
        txHash=d.tx_hash,
    )


@router.get("", response_model=DisputesListResponse)
def list_disputes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    shipment_id: Optional[int] = Query(None, alias="shipmentId"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List disputes with role-based access filtering.
    Admin sees all disputes; normal users only see disputes for shipments they are involved in.
    """
    query = db.query(Dispute).join(Shipment, Dispute.shipment_id == Shipment.shipment_id)

    if shipment_id is not None:
        query = query.filter(Dispute.shipment_id == shipment_id)

    # Role visibility filtering
    if user.role != 1:  # Not Admin
        addr = user.wallet_address.lower()
        query = query.filter(
            or_(
                Shipment.shipper == addr,
                Shipment.transporter == addr,
                Shipment.receiver == addr,
                Shipment.warehouse == addr,
                Shipment.inspector == addr,
            )
        )

    total = query.count()
    disputes = query.order_by(Dispute.raised_at.desc()).offset(skip).limit(limit).all()

    return DisputesListResponse(
        items=[dispute_to_item(d) for d in disputes],
        total=total,
        limit=limit,
        offset=skip,
    )


@router.get("/{id}", response_model=DisputeItem)
def get_dispute(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve detailed dispute information by dispute ID."""
    dispute = db.query(Dispute).filter(Dispute.id == id).first()
    if not dispute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "DISPUTE_NOT_FOUND", "message": f"Dispute {id} not found"}},
        )

    # Check caller has visibility to the underlying shipment
    shipment = db.query(Shipment).filter(Shipment.shipment_id == dispute.shipment_id).first()
    if shipment:
        check_shipment_visibility(user, shipment)

    return dispute_to_item(dispute)
