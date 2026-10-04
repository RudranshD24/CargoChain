"""Blockchain service for reading contract state and loading ABIs/deployments."""

import json
import os
from typing import Dict, Any, Optional
from web3 import Web3
from app.config import settings

# Shared web3 instance with short timeout for responsiveness
w3 = Web3(Web3.HTTPProvider(settings.rpc_url, request_kwargs={"timeout": 0.5}))


def get_deployment_metadata() -> Dict[str, Any]:
    """Load deployment metadata from deployments/local.json."""
    possible_paths = [
        settings.deployment_file,
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "deployments", "local.json"),
        os.path.abspath("deployments/local.json"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    return {"contracts": {}, "deploymentBlock": 0}


def get_contract_abi(contract_name: str) -> Optional[list]:
    """Load ABI for a given contract from contracts/abi/."""
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "contracts", "abi", f"{contract_name}.json"),
        os.path.abspath(f"contracts/abi/{contract_name}.json"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("abi", data)
    return None


def get_contract_instance(contract_name: str, custom_address: Optional[str] = None):
    """Instantiate a Web3 contract using the deployed address and exported ABI."""
    abi = get_contract_abi(contract_name)
    if not abi:
        return None

    address = custom_address
    if not address:
        metadata = get_deployment_metadata()
        address = metadata.get("contracts", {}).get(contract_name)

    if not address:
        return None

    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)
