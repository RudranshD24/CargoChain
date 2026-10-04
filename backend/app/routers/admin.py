"""Admin endpoints: audit logs and projection rebuild / reindexing."""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import User, ChainEvent
from app.schemas import AuditEventItem, AuditListResponse
from app.services.auth import require_roles
from app.services.indexer import EventIndexer

router = APIRouter(tags=["admin"])


@router.get("/audit", response_model=AuditListResponse)
def get_audit_trail(
    contract: Optional[str] = Query(None),
    event: Optional[str] = Query(None),
    shipment_id: Optional[int] = Query(None, alias="shipmentId"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_roles(1, 5)),  # Admin or Inspector
    db: Session = Depends(get_db),
):
    """Retrieve raw decoded on-chain event audit trail (Admin and Inspector only)."""
    query = db.query(ChainEvent)

    if contract:
        query = query.filter(ChainEvent.contract_name == contract)
    if event:
        query = query.filter(ChainEvent.event_name == event)
    if shipment_id is not None:
        query = query.filter(ChainEvent.shipment_id == shipment_id)

    total = query.count()
    events = (
        query.order_by(ChainEvent.block_number.desc(), ChainEvent.log_index.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        AuditEventItem(
            id=e.id,
            contractName=e.contract_name,
            eventName=e.event_name,
            shipmentId=e.shipment_id,
            blockNumber=e.block_number,
            blockTime=e.block_time,
            txHash=e.tx_hash,
            logIndex=e.log_index,
            args=e.args_json,
        )
        for e in events
    ]

    return AuditListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/admin/reindex")
def trigger_reindex(
    admin: User = Depends(require_roles(1)),  # Admin only
    db: Session = Depends(get_db),
):
    """Rebuild all chain-derived projections from contract logs (Admin only, FR-IDX-02).
    Wipes projection tables and replays from deployment block while preserving off-chain profiles and nonces.
    """
    indexer = EventIndexer(db)
    result = indexer.reindex_all()
    return result


@router.post("/admin/sync")
def trigger_sync(
    admin: User = Depends(require_roles(1)),  # Admin only
    db: Session = Depends(get_db),
):
    """Synchronize latest blocks into the indexer (Admin only)."""
    indexer = EventIndexer(db)
    processed = indexer.sync_events()
    return {"status": "synced", "processedEvents": processed}
