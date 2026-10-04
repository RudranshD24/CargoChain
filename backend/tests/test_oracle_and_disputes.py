"""Tests for Oracle Service endpoints, Dispute endpoints, and Event Indexer integration (FR-ORC-01..03, FR-DSP-01)."""

import pytest
from datetime import datetime, timezone
from app.models.entities import Shipment, Dispute, OracleEvent, OracleScenario, Milestone
from app.services.indexer import EventIndexer
from tests.conftest import auth_header_for


def seed_test_shipment(db_session, wallets, shipment_id: int = 1001) -> Shipment:
    """Helper to create a shipment with involved participants."""
    shipment = Shipment(
        shipment_id=shipment_id,
        external_ref=f"0x{shipment_id:064x}",
        product_description="Industrial Components",
        quantity=5,
        origin="Mumbai",
        destination="Delhi",
        dest_lat=28613900,
        dest_lon=77209000,
        geofence_radius_m=1000,
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        warehouse=wallets["warehouse"].address.lower(),
        inspector=wallets["inspector"].address.lower(),
        current_custodian=wallets["shipper"].address.lower(),
        status=2,  # InTransit
        expected_delivery=int(datetime.now(timezone.utc).timestamp()) + 86400 * 3,
        payment_amount=1000000000000000000,
        created_block=10,
        created_tx_hash="0x" + "a" * 64,
    )
    db_session.add(shipment)
    db_session.commit()
    db_session.refresh(shipment)
    return shipment


def test_oracle_status_endpoint(client, db_session, wallets):
    """GET /api/v1/oracle/status returns operational info for authenticated user."""
    auth = auth_header_for(client, db_session, wallets["shipper"], role=2)
    resp = client.get("/api/v1/oracle/status", headers=auth)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "oracleAddress" in data
    assert data["oracleAddress"].startswith("0x")
    assert "activeScenarios" in data


def test_oracle_scenario_permissions(client, db_session, wallets):
    """Only Admin can start an oracle scenario; non-admin receives 403."""
    shipment = seed_test_shipment(db_session, wallets, shipment_id=2001)

    # 1. Non-admin (Shipper) attempt -> 403 Forbidden
    shipper_auth = auth_header_for(client, db_session, wallets["shipper"], role=2)
    resp = client.post(
        "/api/v1/oracle/scenarios",
        json={"shipmentId": shipment.shipment_id, "scenarioType": "normal"},
        headers=shipper_auth,
    )
    assert resp.status_code == 403, resp.text

    # 2. Admin attempt with invalid scenario type -> 400 Bad Request
    admin_auth = auth_header_for(client, db_session, wallets["admin"], role=1)
    resp = client.post(
        "/api/v1/oracle/scenarios",
        json={"shipmentId": shipment.shipment_id, "scenarioType": "teleport"},
        headers=admin_auth,
    )
    assert resp.status_code == 400, resp.text

    # 3. Admin attempt with non-existent shipment -> 404 Not Found
    resp = client.post(
        "/api/v1/oracle/scenarios",
        json={"shipmentId": 999999, "scenarioType": "normal"},
        headers=admin_auth,
    )
    assert resp.status_code == 404, resp.text

    # 4. Admin attempt with valid shipment -> 200 OK (creates scenario)
    resp = client.post(
        "/api/v1/oracle/scenarios",
        json={"shipmentId": shipment.shipment_id, "scenarioType": "normal", "name": "Demo-Run"},
        headers=admin_auth,
    )
    assert resp.status_code == 200, resp.text
    scen_data = resp.json()
    assert scen_data["scenarioType"] == "normal"
    assert scen_data["shipmentId"] == shipment.shipment_id
    assert scen_data["totalSteps"] == 4


def test_oracle_scenario_stop(client, db_session, wallets):
    """Admin can stop an oracle scenario."""
    admin_auth = auth_header_for(client, db_session, wallets["admin"], role=1)
    shipper_auth = auth_header_for(client, db_session, wallets["shipper"], role=2)

    scen = OracleScenario(
        scenario_id="scen-test-01",
        name="Test Stop",
        scenario_type="delayed",
        shipment_id=3001,
        status="running",
        total_steps=4,
        current_step=1,
    )
    db_session.add(scen)
    db_session.commit()

    # Non-admin forbidden
    resp = client.post("/api/v1/oracle/scenarios/scen-test-01/stop", headers=shipper_auth)
    assert resp.status_code == 403

    # Admin stops
    resp = client.post("/api/v1/oracle/scenarios/scen-test-01/stop", headers=admin_auth)
    assert resp.status_code == 200
    assert resp.json()["status"] == "stopped"


def test_oracle_events_visibility(client, db_session, wallets):
    """GET /api/v1/oracle/events filters by user shipment involvement."""
    s1 = seed_test_shipment(db_session, wallets, shipment_id=4001)

    # Seed an oracle event for s1
    ev = OracleEvent(
        shipment_id=s1.shipment_id,
        lat=28613900,
        lon=77209000,
        milestone_type=1,
        in_geofence=True,
        reporter=wallets["admin"].address.lower(),
        metadata_uri="ipfs://QmOracleEvent1",
        block_number=100,
        block_time=1700000000,
        tx_hash="0x" + "b" * 64,
        log_index=1,
    )
    db_session.add(ev)
    db_session.commit()

    admin_auth = auth_header_for(client, db_session, wallets["admin"], role=1)
    shipper_auth = auth_header_for(client, db_session, wallets["shipper"], role=2)
    outsider_auth = auth_header_for(client, db_session, wallets["outsider"], role=2)

    # Admin sees events
    resp = client.get("/api/v1/oracle/events", headers=admin_auth)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1

    # Involved Shipper sees events
    resp = client.get(f"/api/v1/oracle/events?shipmentId={s1.shipment_id}", headers=shipper_auth)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1

    # Uninvolved outsider sees 0 events
    resp = client.get(f"/api/v1/oracle/events?shipmentId={s1.shipment_id}", headers=outsider_auth)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 0


def test_disputes_api_and_visibility(client, db_session, wallets):
    """GET /api/v1/disputes and /api/v1/disputes/{id} enforce role and assignment filtering."""
    s = seed_test_shipment(db_session, wallets, shipment_id=5001)

    dispute = Dispute(
        shipment_id=s.shipment_id,
        reason=0,  # Damaged
        notes="Cargo crushed during transit",
        raised_by=wallets["shipper"].address.lower(),
        is_resolved=False,
        raised_at=1700000000,
        block_number=105,
        tx_hash="0x" + "c" * 64,
        log_index=0,
    )
    db_session.add(dispute)
    db_session.commit()
    db_session.refresh(dispute)

    admin_auth = auth_header_for(client, db_session, wallets["admin"], role=1)
    shipper_auth = auth_header_for(client, db_session, wallets["shipper"], role=2)
    receiver_auth = auth_header_for(client, db_session, wallets["receiver"], role=6)
    outsider_auth = auth_header_for(client, db_session, wallets["outsider"], role=2)

    # Admin sees all disputes
    resp = client.get("/api/v1/disputes", headers=admin_auth)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1

    # Shipper sees their shipment's dispute
    resp = client.get("/api/v1/disputes", headers=shipper_auth)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(d["shipmentId"] == s.shipment_id for d in items)

    # Receiver (also involved) sees the dispute
    resp = client.get(f"/api/v1/disputes/{dispute.id}", headers=receiver_auth)
    assert resp.status_code == 200
    assert resp.json()["reasonName"] == "Damaged"
    assert resp.json()["isResolved"] is False

    # Outsider calling /disputes/{id} is forbidden
    resp = client.get(f"/api/v1/disputes/{dispute.id}", headers=outsider_auth)
    assert resp.status_code == 403

    # Nonexistent dispute returns 404
    resp = client.get("/api/v1/disputes/99999", headers=admin_auth)
    assert resp.status_code == 404


def test_indexer_oracle_and_dispute_handlers(db_session, wallets):
    """Verify EventIndexer handles OracleUpdateRecorded, DisputeRaised, and DisputeResolved."""
    s = seed_test_shipment(db_session, wallets, shipment_id=6001)
    indexer = EventIndexer(db_session)

    # 1. OracleUpdateRecorded event
    oracle_args = {
        "shipmentId": s.shipment_id,
        "lat": 28613900,
        "lon": 77209000,
        "milestoneType": 3,  # Arrived
        "inGeofence": True,
        "reporter": wallets["admin"].address,
        "metadataURI": "ipfs://QmArrivalReport",
    }
    indexer._handle_tracking_event("OracleUpdateRecorded", oracle_args, 200, 1700050000, "0x" + "d" * 64, 0)
    db_session.commit()

    # Check oracle_events table
    o_ev = db_session.query(OracleEvent).filter(OracleEvent.shipment_id == s.shipment_id).first()
    assert o_ev is not None
    assert o_ev.milestone_type == 3
    assert o_ev.in_geofence is True

    # Check milestone was added with source="oracle"
    m = (
        db_session.query(Milestone)
        .filter(Milestone.shipment_id == s.shipment_id, Milestone.source == "oracle")
        .first()
    )
    assert m is not None
    assert m.submitter_role == 7  # Oracle

    # Check shipment status became Arrived (4)
    db_session.refresh(s)
    assert s.status == 4

    # 2. DisputeRaised event
    disp_args = {
        "shipmentId": s.shipment_id,
        "reason": 1,  # Missing
        "notes": "Parts missing from crate",
        "raisedBy": wallets["shipper"].address,
    }
    indexer._handle_dispute_event("DisputeRaised", disp_args, 201, 1700060000, "0x" + "e" * 64, 1)
    db_session.commit()

    d = db_session.query(Dispute).filter(Dispute.shipment_id == s.shipment_id).first()
    assert d is not None
    assert d.reason == 1
    assert d.is_resolved is False

    db_session.refresh(s)
    assert s.status == 8  # Disputed

    # 3. DisputeResolved event
    res_args = {
        "shipmentId": s.shipment_id,
        "resolution": 0,  # ReleaseToTransporter -> Completed
        "adminNotes": "Transporter not liable",
        "resolvedBy": wallets["admin"].address,
    }
    indexer._handle_dispute_event("DisputeResolved", res_args, 202, 1700070000, "0x" + "f" * 64, 2)
    db_session.commit()

    db_session.refresh(d)
    assert d.is_resolved is True
    assert d.resolution == 0

    db_session.refresh(s)
    assert s.status == 6  # Completed
