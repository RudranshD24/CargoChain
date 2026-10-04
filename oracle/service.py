"""CargoChain Oracle Service — simulated logistics oracle per ARCHITECTURE.md §11 & DEC-008.

Restricted service account for off-chain route/status reports.
Oracle updates are trusted reports, not proof of physical ground truth.
All writes are signed with the designated restricted Oracle account only.
"""

import os
import json
import uuid
import time
from typing import Dict, Any, List, Optional
from web3 import Web3
from eth_account import Account

# Default to deterministic test key for local academic demo
ORACLE_DEFAULT_KEY = os.environ.get(
    "ORACLE_PRIVATE_KEY",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
)
ORACLE_DEFAULT_ADDRESS = Account.from_key(ORACLE_DEFAULT_KEY).address

RPC_URL = os.environ.get("RPC_URL", "http://127.0.0.1:8545")


def get_w3() -> Web3:
    return Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 2.0}))


def get_deployment_info() -> Dict[str, Any]:
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "deployments", "local.json"),
        os.path.abspath("deployments/local.json"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    return {"contracts": {}}


def get_contract_abi(name: str) -> Optional[list]:
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "contracts", "abi", f"{name}.json"),
        os.path.abspath(f"contracts/abi/{name}.json"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("abi", data)
    return None


def check_geofence(lat: int, lon: int, dest_lat: int, dest_lon: int, radius_m: int) -> bool:
    """Check if (lat, lon) is within radius_m of (dest_lat, dest_lon) in microdegrees.
    1 meter ≈ 9 microdegrees.
    """
    if radius_m == 0:
        return True
    d_lat = lat - dest_lat
    d_lon = lon - dest_lon
    allowed_radius_micro = radius_m * 9
    dist_sq = (d_lat * d_lat) + (d_lon * d_lon)
    return dist_sq <= (allowed_radius_micro * allowed_radius_micro)


def generate_scenario_waypoints(
    scenario_type: str,
    dest_lat: int,
    dest_lon: int,
    radius_m: int = 1000,
) -> List[Dict[str, Any]]:
    """Generates deterministic waypoints for normal, delayed, or deviated routes.
    All coordinates in microdegrees (1 deg = 1,000,000 microdegrees).
    """
    # Baseline: route starting ~300km away
    start_lat = dest_lat - 2700000
    start_lon = dest_lon - 2700000

    if scenario_type == "normal":
        return [
            {
                "step": 1,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": int(start_lat + (dest_lat - start_lat) * 0.3),
                "lon": int(start_lon + (dest_lon - start_lon) * 0.3),
                "location": "Highway Waypoint 1 (Normal Transit)",
                "note": "ipfs://QmNormalWp1",
                "expect_revert": False,
            },
            {
                "step": 2,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": int(start_lat + (dest_lat - start_lat) * 0.65),
                "lon": int(start_lon + (dest_lon - start_lon) * 0.65),
                "location": "Regional Hub Waypoint 2",
                "note": "ipfs://QmNormalWp2",
                "expect_revert": False,
            },
            {
                "step": 3,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": int(start_lat + (dest_lat - start_lat) * 0.95),
                "lon": int(start_lon + (dest_lon - start_lon) * 0.95),
                "location": "City Boundary Approach",
                "note": "ipfs://QmNormalWp3",
                "expect_revert": False,
            },
            {
                "step": 4,
                "action": "waypoint",
                "milestone_type": 3,  # Arrived
                "lat": dest_lat + 100,  # ~11 meters away, comfortably within 1000m radius
                "lon": dest_lon + 100,
                "location": "Destination Facility Arrival",
                "note": "ipfs://QmNormalArrived",
                "expect_revert": False,
            },
        ]

    elif scenario_type == "delayed":
        return [
            {
                "step": 1,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": int(start_lat + (dest_lat - start_lat) * 0.3),
                "lon": int(start_lon + (dest_lon - start_lon) * 0.3),
                "location": "Highway Checkpoint Alpha",
                "note": "ipfs://QmDelayWp1",
                "expect_revert": False,
            },
            {
                "step": 2,
                "action": "delay",
                "location": "Mountain Pass Traffic Stoppage",
                "note": "Weather hazard report triggered 24h delay",
                "expect_revert": False,
            },
            {
                "step": 3,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": int(start_lat + (dest_lat - start_lat) * 0.75),
                "lon": int(start_lon + (dest_lon - start_lon) * 0.75),
                "location": "Transit Resumed Checkpoint",
                "note": "ipfs://QmDelayWp2",
                "expect_revert": False,
            },
            {
                "step": 4,
                "action": "waypoint",
                "milestone_type": 3,  # Arrived
                "lat": dest_lat + 150,
                "lon": dest_lon + 150,
                "location": "Delayed Final Arrival",
                "note": "ipfs://QmDelayedArrived",
                "expect_revert": False,
            },
        ]

    elif scenario_type == "deviated":
        return [
            {
                "step": 1,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": int(start_lat + (dest_lat - start_lat) * 0.3),
                "lon": int(start_lon + (dest_lon - start_lon) * 0.3),
                "location": "Normal Departure Corridor",
                "note": "ipfs://QmDeviatedWp1",
                "expect_revert": False,
            },
            {
                "step": 2,
                "action": "waypoint",
                "milestone_type": 1,  # InTransit
                "lat": dest_lat + 900000,  # ~100km off corridor: recorded with inGeofence=False
                "lon": dest_lon + 900000,
                "location": "Deviated Off-Route Waypoint",
                "note": "ipfs://QmDeviatedOffRoute",
                "expect_revert": False,
            },
            {
                "step": 3,
                "action": "waypoint",
                "milestone_type": 3,  # Arrived - Attempt arrival while 50km outside geofence
                "lat": dest_lat + 450000,
                "lon": dest_lon + 450000,
                "location": "Premature False Arrival Attempt",
                "note": "ipfs://QmOutsideGeofenceAttempt",
                "expect_revert": True,  # Will revert on-chain with OutsideGeofence
            },
            {
                "step": 4,
                "action": "waypoint",
                "milestone_type": 3,  # Arrived - Return to destination and arrive cleanly
                "lat": dest_lat + 200,
                "lon": dest_lon + 200,
                "location": "Corrected Route Destination Arrival",
                "note": "ipfs://QmCorrectedArrived",
                "expect_revert": False,
            },
        ]

    raise ValueError(f"Unknown scenario type: {scenario_type}")


class OracleService:
    def __init__(self, private_key: Optional[str] = None):
        self.w3 = get_w3()
        self.private_key = private_key or os.environ.get("ORACLE_PRIVATE_KEY", ORACLE_DEFAULT_KEY)
        self.account = Account.from_key(self.private_key)
        self.address = self.account.address

    def get_status(self) -> Dict[str, Any]:
        """Returns oracle service status and connection info."""
        connected = self.w3.is_connected()
        balance_wei = "0"
        block_number = 0
        if connected:
            try:
                balance_wei = str(self.w3.eth.get_balance(self.address))
                block_number = self.w3.eth.block_number
            except Exception:
                pass

        return {
            "oracleAddress": self.address,
            "balanceWei": balance_wei,
            "connected": connected,
            "currentBlock": block_number,
        }

    def _get_contract(self, name: str):
        metadata = get_deployment_info()
        addr = metadata.get("contracts", {}).get(name)
        if not addr:
            raise RuntimeError(f"Contract {name} not found in deployments/local.json")
        abi = get_contract_abi(name)
        if not abi:
            raise RuntimeError(f"ABI for {name} not found in contracts/abi/")
        return self.w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

    def submit_oracle_update(
        self,
        shipment_id: int,
        lat: int,
        lon: int,
        milestone_type: int,
        metadata_uri: str = "",
    ) -> Dict[str, Any]:
        """Submit route milestone or arrival update signed by the Oracle account."""
        tm = self._get_contract("TrackingManager")
        fn = tm.functions.submitOracleUpdate(shipment_id, lat, lon, milestone_type, metadata_uri)

        nonce = self.w3.eth.get_transaction_count(self.address)
        chain_id = self.w3.eth.chain_id

        tx = fn.build_transaction({
            "from": self.address,
            "nonce": nonce,
            "gas": 300000,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": chain_id,
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=10)

        return {
            "txHash": tx_hash.hex(),
            "blockNumber": receipt.blockNumber,
            "status": receipt.status,
            "gasUsed": receipt.gasUsed,
        }

    def submit_delay(self, shipment_id: int) -> Dict[str, Any]:
        """Mark shipment as delayed via Oracle account."""
        tm = self._get_contract("TrackingManager")
        fn = tm.functions.markDelayed(shipment_id)

        nonce = self.w3.eth.get_transaction_count(self.address)
        chain_id = self.w3.eth.chain_id

        tx = fn.build_transaction({
            "from": self.address,
            "nonce": nonce,
            "gas": 200000,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": chain_id,
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=10)

        return {
            "txHash": tx_hash.hex(),
            "blockNumber": receipt.blockNumber,
            "status": receipt.status,
            "gasUsed": receipt.gasUsed,
        }
