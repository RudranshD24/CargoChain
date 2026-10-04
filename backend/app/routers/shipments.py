"""Shipment query endpoints with role-based visibility filtering."""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models.entities import (
    User,
    Shipment,
    Milestone,
    CustodyEvent,
    Document,
    EscrowEvent,
)
from app.schemas import (
    ShipmentItem,
    ShipmentsListResponse,
    MilestoneItem,
    CustodyItem,
    DocumentItem,
    EscrowStateResponse,
    STATUS_NAMES,
    MILESTONE_NAMES,
    DOC_TYPE_NAMES,
    ROLE_NAMES,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/shipments", tags=["shipments"])


def check_shipment_visibility(user: User, shipment: Shipment):
    """Enforce: Admin can read all; others only if assigned as shipper/transporter/receiver/warehouse/inspector."""
    if user.role == 1:  # Admin
        return
    addr = user.wallet_address.lower()
    involved = {
        shipment.shipper.lower(),
        shipment.transporter.lower(),
        shipment.receiver.lower(),
    }
    if shipment.warehouse:
        involved.add(shipment.warehouse.lower())
    if shipment.inspector:
        involved.add(shipment.inspector.lower())

    if addr not in involved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You are not an authorized party for this shipment"}},
        )


def shipment_to_item(s: Shipment) -> ShipmentItem:
    return ShipmentItem(
        shipmentId=s.shipment_id,
        externalRef=s.external_ref,
        status=s.status,
        statusName=STATUS_NAMES.get(s.status, "Unknown"),
        productDescription=s.product_description,
        quantity=s.quantity,
        origin=s.origin,
        destination=s.destination,
        destLat=s.dest_lat,
        destLon=s.dest_lon,
        geofenceRadiusM=s.geofence_radius_m,
        shipper=s.shipper,
        transporter=s.transporter,
        receiver=s.receiver,
        warehouse=s.warehouse,
        inspector=s.inspector,
        currentCustodian=s.current_custodian,
        expectedDelivery=s.expected_delivery,
        deliveredAt=s.delivered_at,
        paymentAmountWei=str(s.payment_amount),
        createdBlock=s.created_block,
        createdAt=s.created_at.isoformat() if s.created_at else "",
    )


@router.get("", response_model=ShipmentsListResponse)
def list_shipments(
    status_filter: Optional[int] = Query(None, alias="status"),
    q: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List permitted shipments for the authenticated wallet with optional status and query filtering."""
    query = db.query(Shipment)

    # Visibility filter
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

    # Status filter
    if status_filter is not None:
        query = query.filter(Shipment.status == status_filter)

    # Query search
    if q:
        search_pat = f"%{q}%"
        query = query.filter(
            or_(
                Shipment.external_ref.ilike(search_pat),
                Shipment.product_description.ilike(search_pat),
                Shipment.origin.ilike(search_pat),
                Shipment.destination.ilike(search_pat),
            )
        )

    total = query.count()
    shipments = query.order_by(Shipment.shipment_id.desc()).offset(offset).limit(limit).all()

    return ShipmentsListResponse(
        items=[shipment_to_item(s) for s in shipments],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{id}", response_model=ShipmentItem)
def get_shipment(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get shipment details by ID (Involved parties / Admin only)."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {id} not found"}},
        )

    check_shipment_visibility(user, shipment)
    return shipment_to_item(shipment)


@router.get("/{id}/milestones", response_model=List[MilestoneItem])
def get_shipment_milestones(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get ordered milestones for a shipment (Involved parties / Admin only)."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {id} not found"}},
        )

    check_shipment_visibility(user, shipment)

    milestones = (
        db.query(Milestone)
        .filter(Milestone.shipment_id == id)
        .order_by(Milestone.block_time.asc(), Milestone.log_index.asc())
        .all()
    )

    return [
        MilestoneItem(
            index=m.milestone_index,
            type=m.milestone_type,
            typeName=MILESTONE_NAMES.get(m.milestone_type, "Unknown"),
            location=m.location,
            lat=m.lat,
            lon=m.lon,
            note=m.note,
            source=m.source,
            submittedBy=m.submitter,
            submitterRole=m.submitter_role,
            submitterRoleName=ROLE_NAMES.get(m.submitter_role, "Unknown"),
            blockNumber=m.block_number,
            blockTime=m.block_time,
            txHash=m.tx_hash,
        )
        for m in milestones
    ]


@router.get("/{id}/custody", response_model=List[CustodyItem])
def get_shipment_custody(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get custody transfer history for a shipment (Involved parties / Admin only)."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {id} not found"}},
        )

    check_shipment_visibility(user, shipment)

    custody = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.shipment_id == id)
        .order_by(CustodyEvent.block_time.asc(), CustodyEvent.log_index.asc())
        .all()
    )

    return [
        CustodyItem(
            fromAddress=c.from_address,
            toAddress=c.to_address,
            blockNumber=c.block_number,
            blockTime=c.block_time,
            txHash=c.tx_hash,
        )
        for c in custody
    ]


@router.get("/{id}/documents", response_model=List[DocumentItem])
def get_shipment_documents(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get anchored document metadata for a shipment (Involved parties / Admin only)."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {id} not found"}},
        )

    check_shipment_visibility(user, shipment)

    docs = (
        db.query(Document)
        .filter(Document.shipment_id == id)
        .order_by(Document.doc_index.asc())
        .all()
    )

    return [
        DocumentItem(
            docIndex=d.doc_index,
            docType=d.doc_type,
            docTypeName=DOC_TYPE_NAMES.get(d.doc_type, "Unknown"),
            contentHash=d.content_hash,
            cid=d.cid,
            filename=d.filename,
            sizeBytes=d.size_bytes,
            uploader=d.uploader,
            isVerified=d.is_verified,
            verifiedBy=d.verified_by,
            verifiedAt=d.verified_at.isoformat() if d.verified_at else None,
            blockNumber=d.block_number,
            blockTime=d.block_time,
            txHash=d.tx_hash,
        )
        for d in docs
    ]


@router.get("/{id}/escrow", response_model=EscrowStateResponse)
def get_shipment_escrow(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get escrow lifecycle state and events for a shipment (Involved parties / Admin only)."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == id).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Shipment with ID {id} not found"}},
        )

    check_shipment_visibility(user, shipment)

    events = (
        db.query(EscrowEvent)
        .filter(EscrowEvent.shipment_id == id)
        .order_by(EscrowEvent.block_time.asc(), EscrowEvent.log_index.asc())
        .all()
    )

    is_deposited = any(e.event_type == "EscrowFunded" for e in events)
    is_eligible = any(e.event_type == "PaymentEligible" for e in events)
    is_released = any(e.event_type == "PaymentReleased" for e in events)
    is_refunded = any(e.event_type == "EscrowRefunded" for e in events)
    has_frozen = any(e.event_type == "EscrowFrozen" for e in events)
    has_unfrozen_or_resolved = any(
        e.event_type in ("EscrowUnfrozen", "EscrowRefunded", "PaymentReleased", "DisputePayoutExecuted")
        for e in events
    )
    is_frozen = (has_frozen and not has_unfrozen_or_resolved) or shipment.status == 8

    event_dicts = [
        {
            "eventType": e.event_type,
            "amountWei": str(e.amount),
            "counterparty": e.counterparty,
            "blockNumber": e.block_number,
            "blockTime": e.block_time,
            "txHash": e.tx_hash,
        }
        for e in events
    ]

    return EscrowStateResponse(
        isDeposited=is_deposited,
        isEligible=is_eligible,
        isReleased=is_released,
        isRefunded=is_refunded,
        isFrozen=is_frozen,
        amountWei=str(shipment.payment_amount),
        events=event_dicts,
    )
