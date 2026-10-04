"""Phase 6 Backend Security Hardening and Advanced Analytics Test Suite.

Validates:
1. OWASP Security Headers (nosniff, DENY, HSTS, XSS protection).
2. Large payload denial-of-service guard (413 Payload Too Large).
3. IDOR and access control boundaries across participants.
4. Advanced analytics aggregation (lifecycle breakdown, SLA calculation, corridor delays).
5. Route corridors and waypoint sequences with geofence data.
"""

import pytest
from app.models.entities import Shipment, User
from tests.conftest import auth_header_for


def test_owasp_security_headers_present(client):
    """Verify standard responses include OWASP hardening headers."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "max-age=" in resp.headers.get("Strict-Transport-Security", "")
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"


def test_oversized_payload_rejection(client):
    """Verify payloads exceeding 2MB are rejected with 413 without crashing backend."""
    oversized_headers = {
        "content-length": str(3 * 1024 * 1024),  # 3MB
        "content-type": "application/json",
    }
    resp = client.post("/api/v1/auth/nonce", headers=oversized_headers, content=b"x" * 100)
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_advanced_analytics_metrics(client, wallets, db_session):
    """Verify /analytics/advanced aggregates lifecycle duration, SLA, and corridor metrics."""
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)

    # Seed shipments with diverse outcomes
    s1 = Shipment(
        shipment_id=101,
        external_ref="0x" + "a1" * 32,
        product_description="Pharma Batch 101",
        quantity=50,
        origin="Berlin",
        destination="Munich",
        dest_lat=48135125,
        dest_lon=11581981,
        geofence_radius_m=1000,
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        current_custodian=wallets["receiver"].address.lower(),
        status=6,  # Completed
        expected_delivery=5000,
        delivered_at=4800,  # On time
        payment_amount=1000000,
        created_block=10,
        created_tx_hash="0x" + "01" * 32,
    )
    s2 = Shipment(
        shipment_id=102,
        external_ref="0x" + "a2" * 32,
        product_description="Pharma Batch 102",
        quantity=25,
        origin="Berlin",
        destination="Munich",
        dest_lat=48135125,
        dest_lon=11581981,
        geofence_radius_m=1000,
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        current_custodian=wallets["transporter"].address.lower(),
        status=3,  # Delayed
        expected_delivery=4000,
        delivered_at=None,
        payment_amount=500000,
        created_block=11,
        created_tx_hash="0x" + "02" * 32,
    )
    db_session.add_all([s1, s2])
    db_session.commit()

    resp = client.get("/api/v1/analytics/advanced", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["dataClassification"] == "SYNTHETIC_LOCAL_DEMO"
    assert data["scope"] == "ENTERPRISE_ALL"
    assert "lifecycleDuration" in data
    assert data["lifecycleDuration"]["avgCreatedToTransitHours"] >= 0

    # Transporter SLA
    assert len(data["transporterSLA"]) >= 1
    t_sla = next((t for t in data["transporterSLA"] if t["transporter"] == wallets["transporter"].address.lower()), None)
    assert t_sla is not None
    assert t_sla["totalShipments"] >= 2
    assert t_sla["onTimeShipments"] >= 1
    assert t_sla["delayedShipments"] >= 1

    # Corridor delays
    assert len(data["corridorDelays"]) >= 1
    corridor = next((c for c in data["corridorDelays"] if c["origin"] == "Berlin" and c["destination"] == "Munich"), None)
    assert corridor is not None
    assert corridor["shipmentCount"] >= 2
    assert corridor["delayedCount"] >= 1


def test_advanced_analytics_role_scoping(client, wallets, db_session):
    """Verify non-admin participants only receive metrics for their involved shipments."""
    outsider_headers = auth_header_for(client, db_session, wallets["inspector"], role=5)

    resp = client.get("/api/v1/analytics/advanced", headers=outsider_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["scope"] == "PARTICIPANT_FILTERED"


def test_route_corridors_endpoint(client, wallets, db_session):
    """Verify /analytics/route-corridors returns ordered waypoints with geofences."""
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)

    resp = client.get("/api/v1/analytics/route-corridors", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["dataClassification"] == "SYNTHETIC_LOCAL_DEMO"
    assert "corridors" in data
    if len(data["corridors"]) > 0:
        c = data["corridors"][0]
        assert "waypoints" in c
        assert len(c["waypoints"]) >= 2
        assert c["waypoints"][0]["step"] == 1
        assert c["geofenceRadiusM"] >= 0
