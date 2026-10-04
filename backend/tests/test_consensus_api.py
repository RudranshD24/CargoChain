"""Tests for Consensus Simulator FastAPI endpoints."""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_get_consensus_models():
    """Verify GET /api/v1/consensus/models returns all 5 protocols."""
    resp = client.get("/api/v1/consensus/models")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    ids = [m["id"] for m in data]
    assert "pow" in ids
    assert "pos" in ids
    assert "pbft" in ids
    assert "poa" in ids
    assert "poet" in ids


def test_post_consensus_simulate_pow():
    """Verify POST /api/v1/consensus/simulate executes a PoW simulation."""
    payload = {
        "mechanism": "pow",
        "nodes_count": 6,
        "faulty_nodes_count": 0,
        "workload_blocks": 3,
        "network_latency_ms": 30.0,
        "seed": 42,
        "parameters": {"difficulty": 2},
    }
    resp = client.post("/api/v1/consensus/simulate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["metrics"]["mechanism"] == "pow"
    assert len(data["blocks"]) == 3
    assert len(data["nodes"]) == 6
    assert data["metrics"]["total_blocks_accepted"] == 3


def test_post_consensus_simulate_invalid_config():
    """Verify POST /api/v1/consensus/simulate rejects invalid configuration."""
    payload = {
        "mechanism": "unknown_proto",
        "nodes_count": 5,
        "faulty_nodes_count": 1,
    }
    resp = client.post("/api/v1/consensus/simulate", json=payload)
    assert resp.status_code in [400, 422]


def test_post_consensus_compare():
    """Verify POST /api/v1/consensus/compare compares selected protocols."""
    payload = {
        "mechanisms": ["pow", "pbft", "poa"],
        "nodes_count": 6,
        "faulty_nodes_count": 1,
        "workload_blocks": 2,
        "seed": 99,
    }
    resp = client.post("/api/v1/consensus/compare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "pow" in data["results"]
    assert "pbft" in data["results"]
    assert "poa" in data["results"]
    assert len(data["analysis"]) > 0
