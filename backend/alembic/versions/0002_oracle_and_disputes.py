"""0002_oracle_and_disputes — Add disputes, oracle_events, and oracle_scenarios tables.

Revision ID: 0002_oracle_and_disputes
Revises: 0001_init
Create Date: 2026-10-03 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "0002_oracle_and_disputes"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. disputes
    op.create_table(
        "disputes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("reason", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("raised_by", sa.String(length=42), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("resolution", sa.Integer(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("resolved_by", sa.String(length=42), nullable=True),
        sa.Column("raised_at", sa.BigInteger(), nullable=False),
        sa.Column("resolved_at", sa.BigInteger(), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.shipment_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_dispute_tx_log"),
    )
    op.create_index("ix_disputes_shipment_id", "disputes", ["shipment_id"], unique=False)

    # 2. oracle_events
    op.create_table(
        "oracle_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("lat", sa.Integer(), nullable=False),
        sa.Column("lon", sa.Integer(), nullable=False),
        sa.Column("milestone_type", sa.Integer(), nullable=False),
        sa.Column("in_geofence", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("reporter", sa.String(length=42), nullable=False),
        sa.Column("metadata_uri", sa.Text(), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_time", sa.BigInteger(), nullable=False),
        sa.Column("tx_hash", sa.String(length=66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.shipment_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_hash", "log_index", name="uq_oracle_event_tx_log"),
    )
    op.create_index("ix_oracle_events_shipment_id", "oracle_events", ["shipment_id"], unique=False)

    # 3. oracle_scenarios
    op.create_table(
        "oracle_scenarios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scenario_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("scenario_type", sa.String(length=30), nullable=False),
        sa.Column("shipment_id", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("total_steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scenario_id"),
    )
    op.create_index("ix_oracle_scenarios_scenario_id", "oracle_scenarios", ["scenario_id"], unique=True)
    op.create_index("ix_oracle_scenarios_shipment_id", "oracle_scenarios", ["shipment_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_oracle_scenarios_shipment_id", table_name="oracle_scenarios")
    op.drop_index("ix_oracle_scenarios_scenario_id", table_name="oracle_scenarios")
    op.drop_table("oracle_scenarios")

    op.drop_index("ix_oracle_events_shipment_id", table_name="oracle_events")
    op.drop_table("oracle_events")

    op.drop_index("ix_disputes_shipment_id", table_name="disputes")
    op.drop_table("disputes")
