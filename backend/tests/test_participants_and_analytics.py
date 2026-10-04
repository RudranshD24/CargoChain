"""Tests for participant administration and analytics summary (FR-ROL-01, FR-ANL-01)."""

from app.models.entities import User, Shipment
from tests.conftest import auth_header_for


def test_participants_list_admin_only(client, wallets, db_session):
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)
    shipper_headers = auth_header_for(client, db_session, wallets["shipper"], role=2)

    # Admin access -> 200
    resp_admin = client.get("/api/v1/participants", headers=admin_headers)
    assert resp_admin.status_code == 200
    assert len(resp_admin.json()) >= 1

    # Shipper access -> 403 Forbidden
    resp_shipper = client.get("/api/v1/participants", headers=shipper_headers)
    assert resp_shipper.status_code == 403
    assert resp_shipper.json()["error"]["code"] == "FORBIDDEN"


def test_update_participant_profile_admin(client, wallets, db_session):
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)
    shipper_addr = wallets["shipper"].address

    # Pre-create shipper user
    user = User(wallet_address=shipper_addr.lower(), role=2, is_active=True)
    db_session.add(user)
    db_session.commit()

    # Update profile
    patch_resp = client.patch(
        f"/api/v1/participants/{shipper_addr}/profile",
        json={"displayName": "Alice Freight", "orgName": "Alice Corp"},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["displayName"] == "Alice Freight"
    assert data["orgName"] == "Alice Corp"


def test_analytics_summary_kpi(client, wallets, db_session):
    headers = auth_header_for(client, db_session, wallets["admin"], role=1)

    # Seed 3 shipments: 1 completed on time, 1 completed late, 1 in transit
    s1 = Shipment(
        shipment_id=1,
        external_ref="0x" + "01" * 32,
        product_description="Cargo 1",
        quantity=10,
        origin="City A",
        destination="City B",
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        current_custodian=wallets["receiver"].address.lower(),
        status=6,  # Completed
        expected_delivery=2000,
        delivered_at=1900,  # On time
        created_block=1,
        created_tx_hash="0x01",
    )
    s2 = Shipment(
        shipment_id=2,
        external_ref="0x" + "02" * 32,
        product_description="Cargo 2",
        quantity=20,
        origin="City A",
        destination="City C",
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        current_custodian=wallets["receiver"].address.lower(),
        status=6,  # Completed
        expected_delivery=2000,
        delivered_at=2100,  # Late
        created_block=2,
        created_tx_hash="0x02",
    )
    s3 = Shipment(
        shipment_id=3,
        external_ref="0x" + "03" * 32,
        product_description="Cargo 3",
        quantity=30,
        origin="City B",
        destination="City C",
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        current_custodian=wallets["transporter"].address.lower(),
        status=2,  # InTransit
        expected_delivery=3000,
        created_block=3,
        created_tx_hash="0x03",
    )
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    resp = client.get("/api/v1/analytics/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["totalShipments"] == 3
    assert data["activeShipments"] == 1
    assert data["completedShipments"] == 2
    assert data["onTimeRate"] == 50.0  # 1 of 2 on time
    assert data["statusDistribution"]["Completed"] == 2
    assert data["statusDistribution"]["InTransit"] == 1
