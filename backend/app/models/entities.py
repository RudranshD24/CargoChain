"""SQLAlchemy models for CargoChain per DATABASE.md §3–§4."""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Boolean,
    DateTime,
    Numeric,
    ForeignKey,
    JSON,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    """Registered participants. Roles are mirrored from chain, profiles are off-chain."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    role = Column(Integer, nullable=False, default=0)  # 0=None, 1=Admin, 2=Shipper, 3=Transporter, 4=Warehouse, 5=Inspector, 6=Receiver, 7=Oracle
    display_name = Column(String(100), nullable=True)
    org_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    registered_block = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class AuthNonce(Base):
    """Single-use login nonces with expiration."""
    __tablename__ = "auth_nonces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    nonce = Column(String(64), unique=True, nullable=False, index=True)
    message = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Shipment(Base):
    """Current projection of on-chain shipment records."""
    __tablename__ = "shipments"

    shipment_id = Column(BigInteger, primary_key=True)  # From contract nextId
    external_ref = Column(String(66), unique=True, nullable=False, index=True)
    product_description = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    origin = Column(Text, nullable=False)
    destination = Column(Text, nullable=False)
    dest_lat = Column(Integer, nullable=False, default=0)
    dest_lon = Column(Integer, nullable=False, default=0)
    geofence_radius_m = Column(Integer, nullable=False, default=1000)
    shipper = Column(String(42), nullable=False, index=True)
    transporter = Column(String(42), nullable=False, index=True)
    receiver = Column(String(42), nullable=False, index=True)
    warehouse = Column(String(42), nullable=True, index=True)
    inspector = Column(String(42), nullable=True, index=True)
    current_custodian = Column(String(42), nullable=False, index=True)
    status = Column(Integer, nullable=False, default=0)  # 0=Created..6=Completed..9=Cancelled
    delivery_condition = Column(Integer, nullable=True)  # 0=Intact, 1=Damaged, 2=Partial
    expected_delivery = Column(BigInteger, nullable=False)
    delivered_at = Column(BigInteger, nullable=True)
    payment_amount = Column(Numeric(78, 0), nullable=False, default=0)
    created_block = Column(BigInteger, nullable=False)
    created_tx_hash = Column(String(66), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    milestones = relationship("Milestone", back_populates="shipment", cascade="all, delete-orphan", order_by="Milestone.block_time")
    custody_events = relationship("CustodyEvent", back_populates="shipment", cascade="all, delete-orphan", order_by="CustodyEvent.block_time")
    documents = relationship("Document", back_populates="shipment", cascade="all, delete-orphan", order_by="Document.doc_index")
    escrow_events = relationship("EscrowEvent", back_populates="shipment", cascade="all, delete-orphan", order_by="EscrowEvent.block_time")
    disputes = relationship("Dispute", back_populates="shipment", cascade="all, delete-orphan", order_by="Dispute.raised_at")
    oracle_events = relationship("OracleEvent", back_populates="shipment", cascade="all, delete-orphan", order_by="OracleEvent.block_time")


class Milestone(Base):
    """Ordered tracking milestones and provenance (chain-derived)."""
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False, index=True)
    milestone_index = Column(Integer, nullable=False)
    milestone_type = Column(Integer, nullable=False)  # 0=Dispatched, 1=InTransit, 2=WarehouseArrival, 3=Arrived, 4=Delivered
    location = Column(Text, nullable=False)
    lat = Column(Integer, nullable=True, default=0)
    lon = Column(Integer, nullable=True, default=0)
    note = Column(Text, nullable=True)
    submitter = Column(String(42), nullable=False)
    submitter_role = Column(Integer, nullable=False)
    source = Column(String(20), nullable=False, default="manual")  # manual or oracle
    block_number = Column(BigInteger, nullable=False)
    block_time = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("tx_hash", "log_index", name="uq_milestone_tx_log"),
    )

    shipment = relationship("Shipment", back_populates="milestones")


class CustodyEvent(Base):
    """Custody transfer events for a shipment."""
    __tablename__ = "custody_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False, index=True)
    from_address = Column(String(42), nullable=False)
    to_address = Column(String(42), nullable=False)
    block_number = Column(BigInteger, nullable=False)
    block_time = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("tx_hash", "log_index", name="uq_custody_tx_log"),
    )

    shipment = relationship("Shipment", back_populates="custody_events")


class Document(Base):
    """Anchored document metadata, hashes, and IPFS CIDs."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False, index=True)
    doc_index = Column(Integer, nullable=False)
    doc_type = Column(Integer, nullable=False)  # 0=Invoice, 1=BillOfLading, 2=PackingList, 3=InspectionCertificate, 4=Other
    content_hash = Column(String(66), nullable=False, index=True)
    cid = Column(String(128), nullable=False, index=True)
    filename = Column(String(255), nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    uploader = Column(String(42), nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    verified_by = Column(String(42), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    block_number = Column(BigInteger, nullable=False)
    block_time = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("shipment_id", "doc_index", name="uq_doc_shipment_index"),
        UniqueConstraint("tx_hash", "log_index", name="uq_doc_tx_log"),
    )

    shipment = relationship("Shipment", back_populates="documents")


class EscrowEvent(Base):
    """Escrow lifecycle event projection."""
    __tablename__ = "escrow_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(30), nullable=False)  # EscrowFunded, PaymentEligible, PaymentReleased, EscrowRefunded
    amount = Column(Numeric(78, 0), nullable=False, default=0)
    counterparty = Column(String(42), nullable=True)
    block_number = Column(BigInteger, nullable=False)
    block_time = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("tx_hash", "log_index", name="uq_escrow_tx_log"),
    )

    shipment = relationship("Shipment", back_populates="escrow_events")


class ChainEvent(Base):
    """Raw decoded on-chain events audit log."""
    __tablename__ = "chain_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_name = Column(String(50), nullable=False, index=True)
    event_name = Column(String(50), nullable=False, index=True)
    shipment_id = Column(BigInteger, nullable=True, index=True)
    block_number = Column(BigInteger, nullable=False, index=True)
    block_time = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)
    args_json = Column(JSON, nullable=False)

    __table_args__ = (
        UniqueConstraint("tx_hash", "log_index", name="uq_chain_event_tx_log"),
    )


class IndexerState(Base):
    """Tracks indexer progress and deployment block identity."""
    __tablename__ = "indexer_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chain_id = Column(Integer, unique=True, nullable=False)
    last_processed_block = Column(BigInteger, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class Dispute(Base):
    """Dispute state and resolution (chain-derived)."""
    __tablename__ = "disputes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(Integer, nullable=False)  # 0=Damaged, 1=Missing, 2=Delayed, 3=Other
    notes = Column(Text, nullable=False)
    raised_by = Column(String(42), nullable=False)
    is_resolved = Column(Boolean, nullable=False, default=False)
    resolution = Column(Integer, nullable=True)  # 0=ReleaseToTransporter, 1=RefundToShipper, 2=Split
    admin_notes = Column(Text, nullable=True)
    resolved_by = Column(String(42), nullable=True)
    raised_at = Column(BigInteger, nullable=False)
    resolved_at = Column(BigInteger, nullable=True)
    block_number = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("tx_hash", "log_index", name="uq_dispute_tx_log"),
    )

    shipment = relationship("Shipment", back_populates="disputes")


class OracleEvent(Base):
    """Oracle location/status reports (chain-derived)."""
    __tablename__ = "oracle_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(BigInteger, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False, index=True)
    lat = Column(Integer, nullable=False)
    lon = Column(Integer, nullable=False)
    milestone_type = Column(Integer, nullable=False)
    in_geofence = Column(Boolean, nullable=False, default=True)
    reporter = Column(String(42), nullable=False)
    metadata_uri = Column(Text, nullable=True)
    block_number = Column(BigInteger, nullable=False)
    block_time = Column(BigInteger, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    log_index = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("tx_hash", "log_index", name="uq_oracle_event_tx_log"),
    )

    shipment = relationship("Shipment", back_populates="oracle_events")


class OracleScenario(Base):
    """Local scenario controls (off-chain)."""
    __tablename__ = "oracle_scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    scenario_type = Column(String(30), nullable=False)  # normal, delayed, deviated
    shipment_id = Column(BigInteger, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, stopped, failed
    total_steps = Column(Integer, nullable=False, default=0)
    current_step = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    started_at = Column(DateTime(timezone=True), nullable=True)
    stopped_at = Column(DateTime(timezone=True), nullable=True)

