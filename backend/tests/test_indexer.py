"""Tests for blockchain event indexer, idempotency, and reindexing (FR-IDX-01, FR-IDX-02)."""

from hexbytes import HexBytes
from app.models.entities import (
    User,
    Shipment,
    Milestone,
    CustodyEvent,
    Document,
    EscrowEvent,
    ChainEvent,
)
from app.services.indexer import EventIndexer
from tests.conftest import auth_header_for


def test_indexer_idempotent_event_processing(db_session, wallets):
    indexer = EventIndexer(db_session)
    tx_hash = HexBytes(b"\xaa" * 32)
    log_index = 0
    block_num = 100

    log = {
        "transactionHash": tx_hash,
        "logIndex": log_index,
        "blockNumber": block_num,
        "args": {
            "participant": wallets["shipper"].address,
            "role": 2,
            "registeredBy": wallets["admin"].address,
        },
    }

    # First run: processes event
    processed = indexer._process_single_event("ParticipantRegistry", "ParticipantRegistered", log)
    assert processed is True

    # User projected in DB
    user = db_session.query(User).filter(User.wallet_address == wallets["shipper"].address.lower()).first()
    assert user is not None
    assert user.role == 2
    assert user.is_active is True

    # Exactly 1 chain_event recorded
    assert db_session.query(ChainEvent).count() == 1

    # Second run with same tx_hash and log_index: must be safely skipped (idempotency)
    duplicate_processed = indexer._process_single_event("ParticipantRegistry", "ParticipantRegistered", log)
    assert duplicate_processed is False

    # Still exactly 1 chain_event recorded
    assert db_session.query(ChainEvent).count() == 1


def test_indexer_shipment_and_escrow_events_projection(db_session, wallets):
    indexer = EventIndexer(db_session)
    tx1 = HexBytes(b"\x11" * 32)
    tx2 = HexBytes(b"\x22" * 32)
    tx3 = HexBytes(b"\x33" * 32)

    # 1. ShipmentCreated
    log_create = {
        "transactionHash": tx1,
        "logIndex": 0,
        "blockNumber": 101,
        "args": {
            "shipmentId": 42,
            "externalRef": HexBytes(b"\x99" * 32),
            "shipper": wallets["shipper"].address,
            "transporter": wallets["transporter"].address,
            "receiver": wallets["receiver"].address,
            "paymentAmount": 500000000000000000,
        },
    }
    assert indexer._process_single_event("ShipmentRegistry", "ShipmentCreated", log_create) is True

    shipment = db_session.query(Shipment).filter(Shipment.shipment_id == 42).first()
    assert shipment is not None
    assert shipment.status == 0  # Created
    assert shipment.payment_amount == 500000000000000000

    # 2. EscrowFunded
    log_escrow = {
        "transactionHash": tx2,
        "logIndex": 1,
        "blockNumber": 102,
        "args": {
            "shipmentId": 42,
            "depositor": wallets["shipper"].address,
            "amount": 500000000000000000,
        },
    }
    assert indexer._process_single_event("EscrowManager", "EscrowFunded", log_escrow) is True

    escrow_event = db_session.query(EscrowEvent).filter(EscrowEvent.shipment_id == 42).first()
    assert escrow_event is not None
    assert escrow_event.event_type == "EscrowFunded"

    # 3. StatusChanged to InTransit (status = 2)
    log_status = {
        "transactionHash": tx3,
        "logIndex": 0,
        "blockNumber": 103,
        "args": {
            "shipmentId": 42,
            "from": 1,
            "to": 2,
            "changedBy": wallets["transporter"].address,
        },
    }
    assert indexer._process_single_event("ShipmentRegistry", "StatusChanged", log_status) is True

    db_session.refresh(shipment)
    assert shipment.status == 2  # InTransit


def test_reindex_preserves_offchain_profiles(client, wallets, db_session):
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)

    # Pre-populate off-chain profile metadata
    user = User(
        wallet_address=wallets["shipper"].address.lower(),
        role=2,
        display_name="Global Logistics Ltd",
        org_name="Global Cargo Corp",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    # Call admin reindex endpoint
    resp = client.post("/api/v1/admin/reindex", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "reindexed"

    # Verify user profile remains completely intact
    reloaded_user = db_session.query(User).filter(User.wallet_address == wallets["shipper"].address.lower()).first()
    assert reloaded_user is not None
    assert reloaded_user.display_name == "Global Logistics Ltd"
    assert reloaded_user.org_name == "Global Cargo Corp"


def test_audit_trail_endpoint(client, wallets, db_session):
    admin_headers = auth_header_for(client, db_session, wallets["admin"], role=1)

    # Insert a chain event
    ev = ChainEvent(
        contract_name="ShipmentRegistry",
        event_name="ShipmentCreated",
        shipment_id=10,
        block_number=50,
        block_time=1750000000,
        tx_hash="0x" + "55" * 32,
        log_index=0,
        args_json={"shipmentId": 10, "shipper": wallets["shipper"].address},
    )
    db_session.add(ev)
    db_session.commit()

    # Query audit trail
    resp = client.get("/api/v1/audit?contract=ShipmentRegistry", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["contractName"] == "ShipmentRegistry"
    assert data["items"][0]["eventName"] == "ShipmentCreated"
