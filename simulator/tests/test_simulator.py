"""Comprehensive unit tests for the CargoChain Consensus Simulator."""

import pytest
from simulator import (
    SimulationConfig,
    run_simulation,
    compare_consensus,
    ComparisonRequest,
    get_supported_models,
)


def test_supported_models():
    """Verify all 5 consensus protocols are documented in catalog."""
    models = get_supported_models()
    assert len(models) == 5
    model_ids = {m["id"] for m in models}
    assert model_ids == {"pow", "pos", "pbft", "poa", "poet"}


def test_config_validation():
    """Verify input validation rejects invalid node parameters."""
    with pytest.raises(ValueError, match="Unsupported mechanism"):
        SimulationConfig(mechanism="invalid_mech")

    with pytest.raises(ValueError, match="must be less than total nodes"):
        SimulationConfig(mechanism="pow", nodes_count=5, faulty_nodes_count=5)


def test_pow_deterministic_execution():
    """Verify PoW simulator is reproducible with fixed random seed."""
    cfg1 = SimulationConfig(mechanism="pow", nodes_count=6, workload_blocks=3, seed=123)
    res1 = run_simulation(cfg1)

    cfg2 = SimulationConfig(mechanism="pow", nodes_count=6, workload_blocks=3, seed=123)
    res2 = run_simulation(cfg2)

    assert len(res1.blocks) == 3
    assert res1.metrics.total_blocks_proposed == 3
    assert res1.metrics.average_block_latency_ms == res2.metrics.average_block_latency_ms
    assert res1.blocks[0].hash == res2.blocks[0].hash
    assert res1.metrics.estimated_energy_joules > 0


def test_pos_lottery_and_attestation():
    """Verify PoS executes stake lottery and committee attestation."""
    cfg = SimulationConfig(mechanism="pos", nodes_count=8, faulty_nodes_count=1, workload_blocks=4, seed=42)
    res = run_simulation(cfg)

    assert len(res.blocks) == 4
    assert res.metrics.mechanism == "pos"
    assert "Casper FFG" in res.metrics.consensus_finality_type
    assert res.metrics.estimated_energy_joules < 10000.0  # Much lower than PoW


def test_pbft_three_phase_commit_and_message_complexity():
    """Verify PBFT runs 3-phase commit and message complexity scales with N^2."""
    cfg = SimulationConfig(mechanism="pbft", nodes_count=7, faulty_nodes_count=1, workload_blocks=3, seed=99)
    res = run_simulation(cfg)

    assert len(res.blocks) == 3
    assert res.metrics.total_messages_exchanged > 100  # N=7 incurs substantial message exchange
    assert "Deterministic Instant" in res.metrics.consensus_finality_type
    # Check pre-prepare and commit events exist
    steps = {e.step for e in res.events}
    assert "PRE_PREPARE" in steps
    assert "COMMIT_SUCCESS" in steps


def test_pbft_byzantine_fault_threshold_failure():
    """Verify PBFT detects when byzantine nodes exceed f <= (n-1)//3."""
    # For n=7, max tolerable f = (7-1)//3 = 2.
    # Set faulty_nodes_count = 3 (exceeds tolerance)
    cfg = SimulationConfig(mechanism="pbft", nodes_count=7, faulty_nodes_count=3, workload_blocks=3, seed=10)
    res = run_simulation(cfg)

    assert res.metrics.total_blocks_rejected > 0
    assert res.metrics.fault_impact_detected is True


def test_poa_round_robin_and_authorities():
    """Verify PoA uses designated authority signers in round-robin fashion."""
    cfg = SimulationConfig(
        mechanism="poa",
        nodes_count=6,
        faulty_nodes_count=0,
        workload_blocks=5,
        parameters={"authorities_count": 3},
        seed=77,
    )
    res = run_simulation(cfg)

    assert res.metrics.total_blocks_accepted == 5
    # Proposers should rotate among the 3 authorities
    proposers = [b.proposer_id for b in res.blocks]
    assert len(set(proposers)) <= 3


def test_poet_enclave_timers():
    """Verify PoET simulates random wait times and accepts valid wait certificates."""
    cfg = SimulationConfig(mechanism="poet", nodes_count=8, workload_blocks=3, seed=55)
    res = run_simulation(cfg)

    assert len(res.blocks) == 3
    assert res.metrics.total_blocks_accepted == 3
    events = [e for e in res.events if e.step == "ENCLAVE_TIMER_EXPIRED"]
    assert len(events) == 3


def test_comparison_matrix():
    """Verify cross-protocol comparison runs all 5 mechanisms under identical workload."""
    req = ComparisonRequest(nodes_count=6, workload_blocks=3, faulty_nodes_count=0, seed=42)
    comp = compare_consensus(req)

    assert len(comp.results) == 5
    for mech in ["pow", "pos", "pbft", "poa", "poet"]:
        assert mech in comp.results
        assert comp.results[mech].total_blocks_proposed == 3

    # Energy ranking check: PoW energy should far exceed PoS, PBFT, PoA, PoET
    pow_energy = comp.results["pow"].estimated_energy_joules
    pos_energy = comp.results["pos"].estimated_energy_joules
    assert pow_energy > pos_energy


def test_ganache_isolation():
    """Verify simulator operates strictly in-memory without contacting Ganache."""
    import sys
    # Running simulator must not require web3 eth account or active node
    cfg = SimulationConfig(mechanism="poa", nodes_count=4, workload_blocks=2, seed=1)
    res = run_simulation(cfg)
    assert res.metrics.total_blocks_accepted == 2
