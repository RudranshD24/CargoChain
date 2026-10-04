"""0001_init — Initial CargoChain schema.

Revision ID: 0001_init
Revises: 
Create Date: 2026-10-02 18:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("wallet_address", sa.String(length=42), nullable=False),
        sa.Column("role", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("org_name", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("registered_block", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wallet_address"),
    )
    op.create_index(op.f("ix_users_wallet_address"), "users", ["wallet_address"], unique=True)

    # 2. auth_nonces
    op.create_table(
        "auth_nonces",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("wallet_address", sa.String(length=42), nullable=False),
        sa.Column("nonce", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nonce"),
    )
    op.create_index(op.f("ix_auth_nonces_wallet_address"), "auth_nonces", ["wallet_address"], unique=False)
    op.create_index(op.f("ix_auth_nonces_nonce"), "auth_nonces", ["nonce"], unique=True)

    # 3. shipments
    op.create_table(
        "shipments",
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("external_ref", sa.String(length=66), nullable=False),
        sa.Column("product_description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("origin", sa.Text(), nullable=False),
        sa.Column("destination", sa.Text(), nullable=False),
        sa.Column("dest_lat", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dest_lon", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("geofence_radius_m", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("shipper", sa.String(length=42), nullable=False),
        sa.Column("transporter", sa.String(length=42), nullable=False),
        sa.Column("receiver", sa.String(length=42), nullable=False),
        sa.Column("warehouse", sa.String(length=42), nullable=True),
        sa.Column("inspector", sa.String(length=42), nullable=True),
        sa.Column("current_custodian", sa.String(length=42), nullable=False),
        sa.Column("status", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delivery_condition", sa.Integer(), nullable=True),
        sa.Column("expected_delivery", sa.BigInteger(), nullable=False),
        sa.Column("delivered_at", sa.BigInteger(), nullable=True),
        sa.Column("payment_amount", sa.Numeric(precision=78, scale=0), nullable=False, server_default="0"),
        sa.Column("created_block", sa.BigInteger(), nullable=False),
        sa.Column("created_tx_hash", sa.String(length=66), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("shipment_id"),
        sa.UniqueConstraint("external_ref"),
    )
    op.create_index(op.f("ix_shipments_external_ref"), "shipments", ["external_ref"], unique=True)
    op.create_index(op.f("ix_shipments_shipper"), "shipments", ["shipper"], unique=False)
    op.create_index(op.f("ix_shipments_transporter"), "shipments", ["transporter"], unique=False)
    op.create_index(op.f("ix_shipments_receiver"), "shipments", ["receiver"], unique=False)

    # 4. milestones
    op.create_table(
        "milestones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("milestone_index", sa.Integer(), nullable=False),
        sa.Column("milestone_type", sa.Integer(), nullable=False),
        sa.Column("location", sa.Text(), nullable=False),
        sa.Column("lat", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("lon", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("submitter", sa.String(length=42), nullable=False),
        sa.Column("submitter_role", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_time", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.shipment_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_milestone_tx_log"),
    )
    op.create_index(op.f("ix_milestones_shipment_id"), "milestones", ["shipment_id"], unique=False)

    # 5. custody_events
    op.create_table(
        "custody_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("from_address", sa.String(length=42), nullable=False),
        sa.Column("to_address", sa.String(length=42), nullable=False),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_time", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.shipment_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_custody_tx_log"),
    )
    op.create_index(op.f("ix_custody_events_shipment_id"), "custody_events", ["shipment_id"], unique=False)

    # 6. documents
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("doc_index", sa.Integer(), nullable=False),
        sa.Column("doc_type", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=66), nullable=False),
        sa.Column("cid", sa.String(length=128), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("uploader", sa.String(length=42), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("verified_by", sa.String(length=42), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_time", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.shipment_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shipment_id", "doc_index", name="uq_doc_shipment_index"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_doc_tx_log"),
    )
    op.create_index(op.f("ix_documents_shipment_id"), "documents", ["shipment_id"], unique=False)
    op.create_index(op.f("ix_documents_content_hash"), "documents", ["content_hash"], unique=False)
    op.create_index(op.f("ix_documents_cid"), "documents", ["cid"], unique=False)

    # 7. escrow_events
    op.create_table(
        "escrow_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(precision=78, scale=0), nullable=False, server_default="0"),
        sa.Column("counterparty", sa.String(length=42), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_time", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.shipment_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_escrow_tx_log"),
    )
    op.create_index(op.f("ix_escrow_events_shipment_id"), "escrow_events", ["shipment_id"], unique=False)

    # 8. chain_events
    op.create_table(
        "chain_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contract_name", sa.String(length=50), nullable=False),
        sa.Column("event_name", sa.String(length=50), nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_time", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.Column("args_json", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_chain_event_tx_log"),
    )
    op.create_index(op.f("ix_chain_events_contract_name"), "chain_events", ["contract_name"], unique=False)
    op.create_index(op.f("ix_chain_events_event_name"), "chain_events", ["event_name"], unique=False)
    op.create_index(op.f("ix_chain_events_shipment_id"), "chain_events", ["shipment_id"], unique=False)
    op.create_index(op.f("ix_chain_events_block_number"), "chain_events", ["block_number"], unique=False)

    # 9. indexer_state
    op.create_table(
        "indexer_state",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chain_id", sa.Integer(), nullable=False),
        sa.Column("last_processed_block", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chain_id"),
    )


def downgrade() -> None:
    op.drop_table("indexer_state")
    op.drop_table("chain_events")
    op.drop_table("escrow_events")
    op.drop_table("documents")
    op.drop_table("custody_events")
    op.drop_table("milestones")
    op.drop_table("shipments")
    op.drop_table("auth_nonces")
    op.drop_table("users")
