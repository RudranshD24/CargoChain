"""Blockchain Event Indexer for CargoChain.

Maintains an off-chain projection in PostgreSQL/SQLite by reading on-chain events.
Implements FR-IDX-01 (idempotent event processing) and FR-IDX-02 (reconciliation & reindex).
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from hexbytes import HexBytes
from web3 import Web3
from sqlalchemy.orm import Session

from app.models.entities import (
    User,
    Shipment,
    Milestone,
    CustodyEvent,
    Document,
    EscrowEvent,
    Dispute,
    OracleEvent,
    ChainEvent,
    IndexerState,
)
from app.services.blockchain import (
    w3,
    get_deployment_metadata,
    get_contract_instance,
    get_contract_abi,
)


def hex_to_str(val) -> str:
    """Format bytes / HexBytes to 0x-hex string."""
    if isinstance(val, (bytes, HexBytes)):
        h = val.hex()
        return h if h.startswith("0x") else "0x" + h
    s = str(val)
    while s.startswith("0x0x"):
        s = s[2:]
    return s


def normalize_addr(val) -> str:
    """Normalize address to lowercased string."""
    return str(val).lower()


class EventIndexer:
    def __init__(self, db: Session):
        self.db = db
        self.metadata = get_deployment_metadata()
        self.chain_id = self.metadata.get("chainId", 1337)
        self.deployment_block = self.metadata.get("deploymentBlock", 0)

        self.contracts = {
            "ParticipantRegistry": get_contract_instance("ParticipantRegistry"),
            "ShipmentRegistry": get_contract_instance("ShipmentRegistry"),
            "TrackingManager": get_contract_instance("TrackingManager"),
            "DocumentRegistry": get_contract_instance("DocumentRegistry"),
            "EscrowManager": get_contract_instance("EscrowManager"),
            "DisputeManager": get_contract_instance("DisputeManager"),
        }

    def get_or_create_state(self) -> IndexerState:
        state = self.db.query(IndexerState).filter(IndexerState.chain_id == self.chain_id).first()
        if not state:
            state = IndexerState(
                chain_id=self.chain_id,
                last_processed_block=max(0, self.deployment_block - 1),
            )
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def sync_events(self, to_block: Optional[int] = None) -> int:
        """Process all new blocks up to to_block (or current chain head). Returns count of processed events."""
        if not w3.is_connected():
            return 0

        current_head = to_block if to_block is not None else w3.eth.block_number
        state = self.get_or_create_state()
        from_block = state.last_processed_block + 1

        if from_block > current_head:
            return 0

        # Collect and decode events from all contracts
        all_logs = []
        for contract_name, contract in self.contracts.items():
            if not contract:
                continue

            try:
                # Query logs across this contract's address
                events = contract.events
                for event_attr_name in dir(events):
                    if event_attr_name.startswith("_"):
                        continue
                    event_fn = getattr(events, event_attr_name)
                    if hasattr(event_fn, "create_filter"):
                        try:
                            # Use get_logs for bounded range
                            logs = event_fn().get_logs(fromBlock=from_block, toBlock=current_head)
                            for log in logs:
                                all_logs.append((contract_name, event_attr_name, log))
                        except Exception:
                            pass
            except Exception:
                continue

        # Sort logs by blockNumber then logIndex for strictly causal processing
        all_logs.sort(key=lambda x: (x[2]["blockNumber"], x[2]["logIndex"]))

        processed_count = 0
        for contract_name, event_name, log in all_logs:
            if self._process_single_event(contract_name, event_name, log):
                processed_count += 1

        state.last_processed_block = current_head
        self.db.commit()
        return processed_count

    def _process_single_event(self, contract_name: str, event_name: str, log: Dict[str, Any]) -> bool:
        """Process single decoded event idempotently."""
        tx_hash = hex_to_str(log["transactionHash"])
        log_index = log["logIndex"]
        block_number = log["blockNumber"]

        # 1. Check idempotency in chain_events table
        existing = (
            self.db.query(ChainEvent)
            .filter(ChainEvent.tx_hash == tx_hash, ChainEvent.log_index == log_index)
            .first()
        )
        if existing:
            return False

        # Get block timestamp
        try:
            block = w3.eth.get_block(block_number)
            block_time = block["timestamp"]
        except Exception:
            block_time = int(datetime.now(timezone.utc).timestamp())

        args = dict(log.get("args", {}))
        # Serialize args for JSON storage
        serializable_args = {}
        for k, v in args.items():
            if isinstance(v, (bytes, HexBytes)):
                serializable_args[k] = hex_to_str(v)
            else:
                serializable_args[k] = v

        shipment_id = args.get("shipmentId")

        # Record raw event
        chain_event = ChainEvent(
            contract_name=contract_name,
            event_name=event_name,
            shipment_id=shipment_id,
            block_number=block_number,
            block_time=block_time,
            tx_hash=tx_hash,
            log_index=log_index,
            args_json=serializable_args,
        )
        self.db.add(chain_event)

        # 2. Update Projections
        if contract_name == "ParticipantRegistry":
            self._handle_participant_event(event_name, args, block_number)
        elif contract_name == "ShipmentRegistry":
            self._handle_shipment_event(event_name, args, block_number, block_time, tx_hash)
        elif contract_name == "TrackingManager":
            self._handle_tracking_event(event_name, args, block_number, block_time, tx_hash, log_index)
        elif contract_name == "DocumentRegistry":
            self._handle_document_event(event_name, args, block_number, block_time, tx_hash, log_index)
        elif contract_name == "EscrowManager":
            self._handle_escrow_event(event_name, args, block_number, block_time, tx_hash, log_index)
        elif contract_name == "DisputeManager":
            self._handle_dispute_event(event_name, args, block_number, block_time, tx_hash, log_index)

        self.db.flush()
        return True

    def _handle_participant_event(self, event_name: str, args: Dict[str, Any], block_number: int):
        participant = normalize_addr(args.get("participant"))
        user = self.db.query(User).filter(User.wallet_address == participant).first()

        if event_name == "ParticipantRegistered":
            role = args.get("role", 0)
            if not user:
                user = User(
                    wallet_address=participant,
                    role=role,
                    is_active=True,
                    registered_block=block_number,
                )
                self.db.add(user)
            else:
                user.role = role
                user.is_active = True
                user.registered_block = block_number
        elif event_name == "ParticipantRevoked":
            if user:
                user.is_active = False

    def _handle_shipment_event(
        self, event_name: str, args: Dict[str, Any], block_number: int, block_time: int, tx_hash: str
    ):
        shipment_id = args.get("shipmentId")
        if not shipment_id:
            return

        shipment = self.db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()

        if event_name == "ShipmentCreated":
            ext_ref = hex_to_str(args.get("externalRef"))
            shipper = normalize_addr(args.get("shipper"))
            transporter = normalize_addr(args.get("transporter"))
            receiver = normalize_addr(args.get("receiver"))
            payment_amount = args.get("paymentAmount", 0)

            # Query contract getter to populate full static fields
            prod_desc = "Cargo"
            qty = 1
            origin = "Origin"
            dest = "Destination"
            dest_lat = 0
            dest_lon = 0
            geofence_m = 1000
            warehouse = None
            inspector = None
            exp_delivery = block_time + 86400 * 7

            sr = self.contracts.get("ShipmentRegistry")
            if sr:
                try:
                    s_data = sr.functions.getShipment(shipment_id).call()
                    # struct Shipment: id, externalRef, productDescription, quantity, origin, destination,
                    # destLat, destLon, geofenceRadiusM, shipper, transporter, receiver, warehouse, inspector,
                    # currentCustodian, status, deliveryCondition, expectedDelivery, deliveredAt, paymentAmount, createdAt
                    prod_desc = s_data[2]
                    qty = s_data[3]
                    origin = s_data[4]
                    dest = s_data[5]
                    dest_lat = s_data[6]
                    dest_lon = s_data[7]
                    geofence_m = s_data[8]
                    w_addr = s_data[12]
                    if w_addr and w_addr != "0x0000000000000000000000000000000000000000":
                        warehouse = normalize_addr(w_addr)
                    i_addr = s_data[13]
                    if i_addr and i_addr != "0x0000000000000000000000000000000000000000":
                        inspector = normalize_addr(i_addr)
                    exp_delivery = s_data[17]
                except Exception:
                    pass

            if not shipment:
                shipment = Shipment(
                    shipment_id=shipment_id,
                    external_ref=ext_ref,
                    product_description=prod_desc,
                    quantity=qty,
                    origin=origin,
                    destination=dest,
                    dest_lat=dest_lat,
                    dest_lon=dest_lon,
                    geofence_radius_m=geofence_m,
                    shipper=shipper,
                    transporter=transporter,
                    receiver=receiver,
                    warehouse=warehouse,
                    inspector=inspector,
                    current_custodian=shipper,
                    status=0,  # Created
                    expected_delivery=exp_delivery,
                    payment_amount=payment_amount,
                    created_block=block_number,
                    created_tx_hash=tx_hash,
                )
                self.db.add(shipment)
        elif shipment:
            if event_name == "ShipmentAccepted":
                shipment.status = 1  # Accepted
            elif event_name == "ShipmentRejected":
                shipment.status = 7  # Rejected
            elif event_name == "ShipmentCancelled":
                shipment.status = 9  # Cancelled
            elif event_name == "StatusChanged":
                shipment.status = args.get("to", shipment.status)
            elif event_name == "DeliveryConfirmed":
                shipment.status = 5  # Delivered
                shipment.delivery_condition = args.get("condition")
                shipment.delivered_at = block_time
            elif event_name == "DeliveryAccepted":
                shipment.status = 6  # Completed

    def _handle_tracking_event(
        self, event_name: str, args: Dict[str, Any], block_number: int, block_time: int, tx_hash: str, log_index: int
    ):
        shipment_id = args.get("shipmentId")
        if not shipment_id:
            return

        if event_name == "MilestoneRecorded":
            m_count = self.db.query(Milestone).filter(Milestone.shipment_id == shipment_id).count()
            milestone = Milestone(
                shipment_id=shipment_id,
                milestone_index=m_count,
                milestone_type=args.get("milestoneType", 0),
                location=args.get("location", ""),
                submitter=normalize_addr(args.get("submitter")),
                submitter_role=args.get("submitterRole", 0),
                source="manual",
                block_number=block_number,
                block_time=block_time,
                tx_hash=tx_hash,
                log_index=log_index,
            )
            self.db.add(milestone)
        elif event_name == "OracleUpdateRecorded":
            lat = args.get("lat", 0)
            lon = args.get("lon", 0)
            m_type = args.get("milestoneType", 1)
            in_geofence = args.get("inGeofence", True)
            reporter = normalize_addr(args.get("reporter"))
            metadata_uri = args.get("metadataURI", "")

            # 1. Oracle event record
            oracle_ev = OracleEvent(
                shipment_id=shipment_id,
                lat=lat,
                lon=lon,
                milestone_type=m_type,
                in_geofence=in_geofence,
                reporter=reporter,
                metadata_uri=metadata_uri,
                block_number=block_number,
                block_time=block_time,
                tx_hash=tx_hash,
                log_index=log_index,
            )
            self.db.add(oracle_ev)

            # 2. Add to milestones with source="oracle"
            m_count = self.db.query(Milestone).filter(Milestone.shipment_id == shipment_id).count()
            milestone = Milestone(
                shipment_id=shipment_id,
                milestone_index=m_count,
                milestone_type=m_type,
                location="Oracle Waypoint",
                lat=lat,
                lon=lon,
                note=metadata_uri,
                submitter=reporter,
                submitter_role=7,  # Oracle role
                source="oracle",
                block_number=block_number,
                block_time=block_time,
                tx_hash=tx_hash,
                log_index=log_index,
            )
            self.db.add(milestone)

            # 3. If Arrived milestone, update shipment status
            if m_type == 3:  # Arrived
                shipment = self.db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
                if shipment:
                    shipment.status = 4  # Arrived
        elif event_name == "CustodyTransferred":
            from_addr = normalize_addr(args.get("from"))
            to_addr = normalize_addr(args.get("to"))

            shipment = self.db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
            if shipment:
                shipment.current_custodian = to_addr

            custody = CustodyEvent(
                shipment_id=shipment_id,
                from_address=from_addr,
                to_address=to_addr,
                block_number=block_number,
                block_time=block_time,
                tx_hash=tx_hash,
                log_index=log_index,
            )
            self.db.add(custody)

    def _handle_dispute_event(
        self, event_name: str, args: Dict[str, Any], block_number: int, block_time: int, tx_hash: str, log_index: int
    ):
        shipment_id = args.get("shipmentId")
        if not shipment_id:
            return

        shipment = self.db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()

        if event_name == "DisputeRaised":
            reason = args.get("reason", 0)
            notes = args.get("notes", "")
            raised_by = normalize_addr(args.get("raisedBy"))

            dispute = self.db.query(Dispute).filter(Dispute.shipment_id == shipment_id).first()
            if not dispute:
                dispute = Dispute(
                    shipment_id=shipment_id,
                    reason=reason,
                    notes=notes,
                    raised_by=raised_by,
                    is_resolved=False,
                    raised_at=block_time,
                    block_number=block_number,
                    tx_hash=tx_hash,
                    log_index=log_index,
                )
                self.db.add(dispute)

            if shipment:
                shipment.status = 8  # Disputed
        elif event_name == "DisputeResolved":
            resolution = args.get("resolution", 0)
            admin_notes = args.get("adminNotes", "")
            resolved_by = normalize_addr(args.get("resolvedBy"))

            dispute = self.db.query(Dispute).filter(Dispute.shipment_id == shipment_id).first()
            if dispute:
                dispute.is_resolved = True
                dispute.resolution = resolution
                dispute.admin_notes = admin_notes
                dispute.resolved_by = resolved_by
                dispute.resolved_at = block_time

            if shipment:
                if resolution in (0, 2):  # ReleaseToTransporter, Split -> Completed
                    shipment.status = 6
                elif resolution == 1:     # RefundToShipper -> Cancelled
                    shipment.status = 9

    def _handle_document_event(
        self, event_name: str, args: Dict[str, Any], block_number: int, block_time: int, tx_hash: str, log_index: int
    ):
        shipment_id = args.get("shipmentId")
        doc_index = args.get("docIndex", 0)

        if event_name == "DocumentRegistered":
            content_hash = hex_to_str(args.get("contentHash"))
            cid = args.get("cid", "")
            doc_type = args.get("docType", 0)
            uploader = normalize_addr(args.get("uploader"))

            doc = (
                self.db.query(Document)
                .filter(Document.shipment_id == shipment_id, Document.doc_index == doc_index)
                .first()
            )
            if not doc:
                doc = Document(
                    shipment_id=shipment_id,
                    doc_index=doc_index,
                    doc_type=doc_type,
                    content_hash=content_hash,
                    cid=cid,
                    uploader=uploader,
                    block_number=block_number,
                    block_time=block_time,
                    tx_hash=tx_hash,
                    log_index=log_index,
                )
                self.db.add(doc)
        elif event_name == "DocumentVerified":
            matched = args.get("matched", False)
            verifier = normalize_addr(args.get("verifier"))

            doc = (
                self.db.query(Document)
                .filter(Document.shipment_id == shipment_id, Document.doc_index == doc_index)
                .first()
            )
            if doc:
                doc.is_verified = matched
                doc.verified_by = verifier
                doc.verified_at = datetime.now(timezone.utc)

    def _handle_escrow_event(
        self, event_name: str, args: Dict[str, Any], block_number: int, block_time: int, tx_hash: str, log_index: int
    ):
        shipment_id = args.get("shipmentId")
        if not shipment_id:
            return

        amount = args.get("amount", 0)
        counterparty = None
        if "depositor" in args:
            counterparty = normalize_addr(args.get("depositor"))
        elif "recipient" in args:
            counterparty = normalize_addr(args.get("recipient"))

        escrow_ev = EscrowEvent(
            shipment_id=shipment_id,
            event_type=event_name,
            amount=amount,
            counterparty=counterparty,
            block_number=block_number,
            block_time=block_time,
            tx_hash=tx_hash,
            log_index=log_index,
        )
        self.db.add(escrow_ev)

    def reindex_all(self) -> Dict[str, Any]:
        """Rebuild chain-derived projection tables (FR-IDX-02).
        Preserves off-chain profiles, auth nonces, etc.
        """
        # Delete chain-derived records
        self.db.query(Milestone).delete()
        self.db.query(CustodyEvent).delete()
        self.db.query(Document).delete()
        self.db.query(EscrowEvent).delete()
        self.db.query(Dispute).delete()
        self.db.query(OracleEvent).delete()
        self.db.query(Shipment).delete()
        self.db.query(ChainEvent).delete()

        # Reset indexer state
        state = self.get_or_create_state()
        state.last_processed_block = max(0, self.deployment_block - 1)
        self.db.commit()

        # Replay logs from deployment_block
        processed_count = self.sync_events()
        return {
            "status": "reindexed",
            "deploymentBlock": self.deployment_block,
            "currentHead": w3.eth.block_number if w3.is_connected() else 0,
            "processedEvents": processed_count,
        }
