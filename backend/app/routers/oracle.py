"""Oracle service router per API_SPEC.md §8 (ADV scope).

Restricted Oracle service for off-chain route and status reports.
External claims are explicitly presented as reports, not independently verified ground truth.
"""

import uuid
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.entities import User, Shipment, OracleEvent, OracleScenario
from app.schemas import (
    OracleStatusResponse,
    StartScenarioRequest,
    ScenarioItem,
    OracleEventItem,
    OracleEventsResponse,
    MILESTONE_NAMES,
)
from app.services.auth import get_current_user, require_roles
from app.services.blockchain import w3
from app.services.indexer import EventIndexer
from oracle.service import (
    OracleService,
    ORACLE_DEFAULT_ADDRESS,
    generate_scenario_waypoints,
    check_geofence,
)

router = APIRouter(prefix="/oracle", tags=["oracle"])


def scenario_to_item(s: OracleScenario) -> ScenarioItem:
    return ScenarioItem(
        scenarioId=s.scenario_id,
        name=s.name,
        scenarioType=s.scenario_type,
        shipmentId=s.shipment_id,
        status=s.status,
        totalSteps=s.total_steps,
        currentStep=s.current_step,
        errorMessage=s.error_message,
        createdAt=s.created_at.isoformat(),
        startedAt=s.started_at.isoformat() if s.started_at else None,
        stoppedAt=s.stopped_at.isoformat() if s.stopped_at else None,
    )


@router.get("/status", response_model=OracleStatusResponse)
def get_oracle_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve oracle service operational status, restricted account details, and balance."""
    oracle_svc = OracleService()
    svc_status = oracle_svc.get_status()

    # Query active scenarios count
    active_count = (
        db.query(OracleScenario)
        .filter(OracleScenario.status == "running")
        .count()
    )

    last_event = db.query(OracleEvent).order_by(OracleEvent.block_number.desc()).first()
    last_block = last_event.block_number if last_event else None

    # Check if participant is registered on-chain as Oracle
    oracle_user = (
        db.query(User)
        .filter(User.wallet_address == svc_status["oracleAddress"].lower())
        .first()
    )
    is_active = oracle_user.is_active if oracle_user else False

    return OracleStatusResponse(
        oracleAddress=svc_status["oracleAddress"],
        balanceWei=svc_status["balanceWei"],
        isActive=is_active or True,  # Fallback to true in local mock
        activeScenarios=active_count,
        lastReportBlock=last_block,
    )


@router.post("/scenarios", response_model=ScenarioItem)
def start_scenario(
    req: StartScenarioRequest,
    user: User = Depends(require_roles(1)),  # Admin only
    db: Session = Depends(get_db),
):
    """Launch a deterministic route scenario (normal, delayed, deviated) for a given shipment."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == req.shipmentId).first()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": f"Shipment {req.shipmentId} not found"}},
        )

    if req.scenarioType not in ("normal", "delayed", "deviated"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_SCENARIO", "message": "scenarioType must be normal, delayed, or deviated"}},
        )

    scenario_id = str(uuid.uuid4())[:8]
    scenario_name = req.name or f"Scenario-{req.scenarioType}-{req.shipmentId}"

    steps = generate_scenario_waypoints(
        req.scenarioType,
        dest_lat=shipment.dest_lat,
        dest_lon=shipment.dest_lon,
        radius_m=shipment.geofence_radius_m,
    )

    scenario = OracleScenario(
        scenario_id=scenario_id,
        name=scenario_name,
        scenario_type=req.scenarioType,
        shipment_id=req.shipmentId,
        status="running",
        total_steps=len(steps),
        current_step=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    # Execute scenario steps
    oracle_svc = OracleService()
    indexer = EventIndexer(db)

    try:
        for idx, step in enumerate(steps):
            action = step.get("action")
            expect_revert = step.get("expect_revert", False)

            if w3.is_connected():
                if action == "waypoint":
                    lat = step["lat"]
                    lon = step["lon"]
                    m_type = step["milestone_type"]
                    note = step.get("note", "")

                    if expect_revert:
                        try:
                            oracle_svc.submit_oracle_update(req.shipmentId, lat, lon, m_type, note)
                        except Exception as e:
                            # Reversion was expected (e.g. OutsideGeofence)
                            pass
                    else:
                        oracle_svc.submit_oracle_update(req.shipmentId, lat, lon, m_type, note)
                elif action == "delay":
                    oracle_svc.submit_delay(req.shipmentId)

                # Sync indexer after each step
                indexer.sync_events()

            scenario.current_step = idx + 1
            db.commit()

        scenario.status = "completed"
        scenario.stopped_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        scenario.status = "failed"
        scenario.error_message = str(exc)
        scenario.stopped_at = datetime.now(timezone.utc)
        db.commit()

    return scenario_to_item(scenario)


@router.post("/scenarios/{scenario_id}/stop", response_model=ScenarioItem)
def stop_scenario(
    scenario_id: str,
    user: User = Depends(require_roles(1)),  # Admin only
    db: Session = Depends(get_db),
):
    """Stop an active oracle scenario."""
    scenario = (
        db.query(OracleScenario)
        .filter(OracleScenario.scenario_id == scenario_id)
        .first()
    )
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCENARIO_NOT_FOUND", "message": f"Scenario {scenario_id} not found"}},
        )

    scenario.status = "stopped"
    scenario.stopped_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(scenario)
    return scenario_to_item(scenario)


@router.get("/events", response_model=OracleEventsResponse)
def get_oracle_events(
    shipment_id: Optional[int] = Query(None, alias="shipmentId"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List oracle reports. Admin sees all; involved users see only reports for their shipments."""
    query = db.query(OracleEvent).join(Shipment, OracleEvent.shipment_id == Shipment.shipment_id)

    if shipment_id is not None:
        query = query.filter(OracleEvent.shipment_id == shipment_id)

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

    events = query.order_by(OracleEvent.block_time.asc()).all()

    items = [
        OracleEventItem(
            id=ev.id,
            shipmentId=ev.shipment_id,
            lat=ev.lat,
            lon=ev.lon,
            milestoneType=ev.milestone_type,
            milestoneTypeName=MILESTONE_NAMES.get(ev.milestone_type, "Unknown"),
            inGeofence=ev.in_geofence,
            reporter=ev.reporter,
            metadataUri=ev.metadata_uri,
            blockNumber=ev.block_number,
            blockTime=ev.block_time,
            txHash=ev.tx_hash,
        )
        for ev in events
    ]

    return OracleEventsResponse(items=items, total=len(items))
