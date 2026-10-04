"""Tests for shipment listing, role-filtered reads, and sub-resource queries (FR-API-01, FR-SHP-01..05, FR-TRK-01..03, FR-ESC-01..04)."""

from datetime import datetime, timezone
from app.models.entities import (
    Shipment,
    Milestone,
    CustodyEvent,
    Document,
    EscrowEvent,
)
from tests.conftest import auth_header_for


def seed_test_shipments(db_session, wallets):
    s1 = Shipment(
        shipment_id=1,
        external_ref="0x" + "11" * 32,
        product_description="Solar Panels",
        quantity=20,
        origin="Ahmedabad",
        destination="Jaipur",
        dest_lat=26912400,
        dest_lon=75787300,
        geofence_radius_m=1000,
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        warehouse=wallets["warehouse"].address.lower(),
        inspector=wallets["inspector"].address.lower(),
        current_custodian=wallets["shipper"].address.lower(),
        status=0,  # Created
        expected_delivery=1760000000,
        payment_amount=1000000000000000000,
        created_block=10,
        created_tx_hash="0x" + "aa" * 32,
    )

    s2 = Shipment(
        shipment_id=2,
        external_ref="0x" + "22" * 32,
        product_description="Medical Devices",
        quantity=50,
        origin="Bengaluru",
        destination="Chennai",
        dest_lat=13082700,
        dest_lon=80270700,
        geofence_radius_m=500,
        shipper=wallets["outsider"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        warehouse=None,
        inspector=None,
        current_custodian=wallets["outsider"].address.lower(),
        status=2,  # InTransit
        expected_delivery=1760000000,
        payment_amount=2000000000000000000,
        created_block=12,
        created_tx_hash="0x" + "bb" * 32,
    )

    db_session.add(s1)
    db_session.add(s2)

    # Add milestone for s1
    m1 = Milestone(
        shipment_id=1,
        milestone_index=0,
        milestone_type=0,  # Dispatched
        location="Ahmedabad Hub",
        submitter=wallets["transporter"].address.lower(),
        submitter_role=3,
        source="manual",
        block_number=11,
        block_time=1759000000,
        tx_hash="0x" + "cc" * 32,
        log_index=0,
    )
    db_session.add(m1)

    # Add custody event for s1
    c1 = CustodyEvent(
        shipment_id=1,
        from_address=wallets["shipper"].address.lower(),
        to_address=wallets["transporter"].address.lower(),
        block_number=11,
        block_time=1759000000,
        tx_hash="0x" + "cc" * 32,
        log_index=1,
    )
    db_session.add(c1)

    # Add document for s1
    d1 = Document(
        shipment_id=1,
        doc_index=0,
        doc_type=1,  # BillOfLading
        content_hash="0x" + "dd" * 32,
        cid="QmTestCID12345",
        filename="bol.pdf",
        size_bytes=1024,
        uploader=wallets["shipper"].address.lower(),
        is_verified=True,
        verified_by=wallets["receiver"].address.lower(),
        verified_at=datetime.now(timezone.utc),
        block_number=10,
        block_time=1759000000,
        tx_hash="0x" + "dd" * 32,
        log_index=2,
    )
    db_session.add(d1)

    # Add escrow event for s1
    e1 = EscrowEvent(
        shipment_id=1,
        event_type="EscrowFunded",
        amount=1000000000000000000,
        counterparty=wallets["shipper"].address.lower(),
        block_number=10,
        block_time=1759000000,
        tx_hash="0x" + "ee" * 32,
        log_index=3,
    )
    db_session.add(e1)

    db_session.commit()


def test_list_shipments_visibility_filtering(client, wallets, db_session):
    seed_test_shipments(db_session, wallets)

    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)
    shipper_headers = auth_header_for(client, db_session, wallets["shipper"], role=2)
    outsider_headers = auth_header_for(client, db_session, wallets["outsider"], role=2)

    # Admin sees all (2 shipments)
    resp_admin = client.get("/api/v1/shipments", headers=admin_headers)
    assert resp_admin.status_code == 200
    assert resp_admin.json()["total"] == 2

    # Shipper sees only shipment 1
    resp_shipper = client.get("/api/v1/shipments", headers=shipper_headers)
    assert resp_shipper.status_code == 200
    data_shipper = resp_shipper.json()
    assert data_shipper["total"] == 1
    assert data_shipper["items"][0]["shipmentId"] == 1

    # Outsider sees only shipment 2
    resp_outsider = client.get("/api/v1/shipments", headers=outsider_headers)
    assert resp_outsider.status_code == 200
    data_outsider = resp_outsider.json()
    assert data_outsider["total"] == 1
    assert data_outsider["items"][0]["shipmentId"] == 2


def test_shipment_details_visibility(client, wallets, db_session):
    seed_test_shipments(db_session, wallets)

    shipper_headers = auth_header_for(client, db_session, wallets["shipper"], role=2)
    outsider_headers = auth_header_for(client, db_session, wallets["outsider"], role=2)

    # Authorized: Shipper requests shipment 1
    resp_ok = client.get("/api/v1/shipments/1", headers=shipper_headers)
    assert resp_ok.status_code == 200
    assert resp_ok.json()["shipmentId"] == 1
    assert resp_ok.json()["productDescription"] == "Solar Panels"

    # Unauthorized: Outsider requests shipment 1 -> 403 Forbidden
    resp_forbidden = client.get("/api/v1/shipments/1", headers=outsider_headers)
    assert resp_forbidden.status_code == 403
    assert resp_forbidden.json()["error"]["code"] == "FORBIDDEN"


def test_shipment_filters_status_and_query(client, wallets, db_session):
    seed_test_shipments(db_session, wallets)
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)

    # Filter by status = 2 (InTransit) -> should only match shipment 2
    resp_status = client.get("/api/v1/shipments?status=2", headers=admin_headers)
    assert resp_status.status_code == 200
    assert resp_status.json()["total"] == 1
    assert resp_status.json()["items"][0]["shipmentId"] == 2

    # Query search by description
    resp_q = client.get("/api/v1/shipments?q=Medical", headers=admin_headers)
    assert resp_q.status_code == 200
    assert resp_q.json()["total"] == 1
    assert resp_q.json()["items"][0]["productDescription"] == "Medical Devices"


def test_shipment_milestones_and_custody(client, wallets, db_session):
    seed_test_shipments(db_session, wallets)
    shipper_headers = auth_header_for(client, db_session, wallets["shipper"], role=2)

    # Milestones
    m_resp = client.get("/api/v1/shipments/1/milestones", headers=shipper_headers)
    assert m_resp.status_code == 200
    milestones = m_resp.json()
    assert len(milestones) == 1
    assert milestones[0]["location"] == "Ahmedabad Hub"
    assert milestones[0]["typeName"] == "Dispatched"

    # Custody
    c_resp = client.get("/api/v1/shipments/1/custody", headers=shipper_headers)
    assert c_resp.status_code == 200
    custody = c_resp.json()
    assert len(custody) == 1
    assert custody[0]["toAddress"] == wallets["transporter"].address.lower()


def test_shipment_documents_and_escrow(client, wallets, db_session):
    seed_test_shipments(db_session, wallets)
    shipper_headers = auth_header_for(client, db_session, wallets["shipper"], role=2)

    # Documents
    d_resp = client.get("/api/v1/shipments/1/documents", headers=shipper_headers)
    assert d_resp.status_code == 200
    docs = d_resp.json()
    assert len(docs) == 1
    assert docs[0]["cid"] == "QmTestCID12345"
    assert docs[0]["isVerified"] is True

    # Escrow
    e_resp = client.get("/api/v1/shipments/1/escrow", headers=shipper_headers)
    assert e_resp.status_code == 200
    escrow = e_resp.json()
    assert escrow["isDeposited"] is True
    assert escrow["isReleased"] is False
    assert len(escrow["events"]) == 1
    assert escrow["events"][0]["eventType"] == "EscrowFunded"
