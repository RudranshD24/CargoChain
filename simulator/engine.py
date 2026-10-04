"""CargoChain Consensus Simulator — Engine & Comparison Coordinator.

Dispatches discrete simulation runs to protocol models and computes
cross-protocol comparison matrices. Isolated from Ganache.
"""

from typing import Dict, Any, List
from simulator.schemas import (
    SimulationConfig,
    SimulationResult,
    ComparisonRequest,
    ComparisonResult,
    ConsensusProtocolType,
)
from simulator.models.pow import PoWModel
from simulator.models.pos import PoSModel
from simulator.models.pbft import PBFTModel
from simulator.models.poa import PoAModel
from simulator.models.poet import PoETModel


MODEL_REGISTRY = {
    ConsensusProtocolType.POW: PoWModel,
    ConsensusProtocolType.POS: PoSModel,
    ConsensusProtocolType.PBFT: PBFTModel,
    ConsensusProtocolType.POA: PoAModel,
    ConsensusProtocolType.POET: PoETModel,
}


def get_supported_models() -> List[Dict[str, Any]]:
    """Return catalog of supported educational consensus mechanisms."""
    return [
        {
            "id": "pow",
            "name": "Proof of Work (PoW)",
            "family": "Nakamoto / Lotteried",
            "description": "Nodes solve computational hash puzzles to propose blocks. Probabilistic finality.",
            "energy_profile": "Very High (Compute-bound)",
            "finality": "Probabilistic (k-blocks)",
            "parameters": [
                {"name": "difficulty", "type": "int", "default": 2, "min": 1, "max": 4, "description": "Mining target leading zeros"}
            ],
        },
        {
            "id": "pos",
            "name": "Proof of Stake (PoS)",
            "family": "Lotteried / Economic",
            "description": "Slot leaders elected proportionally to staked tokens. Attestation committees certify blocks.",
            "energy_profile": "Very Low (Validation-bound)",
            "finality": "Epoch Checkpoints (Casper FFG)",
            "parameters": [],
        },
        {
            "id": "pbft",
            "name": "Practical Byzantine Fault Tolerance (PBFT)",
            "family": "Classical BFT / Quorum",
            "description": "3-phase commit (Pre-Prepare, Prepare, Commit). Tolerates up to f < n/3 byzantine nodes.",
            "energy_profile": "Very Low (Message-bound)",
            "finality": "Deterministic Instant",
            "parameters": [],
        },
        {
            "id": "poa",
            "name": "Proof of Authority (PoA)",
            "family": "Consortium / Identity",
            "description": "Pre-authorized signers take turns generating blocks in round-robin fashion.",
            "energy_profile": "Minimal (Signature-bound)",
            "finality": "Deterministic Instant",
            "parameters": [
                {"name": "authorities_count", "type": "int", "default": 5, "min": 3, "max": 20, "description": "Designated signers count"}
            ],
        },
        {
            "id": "poet",
            "name": "Proof of Elapsed Time (PoET)",
            "family": "TEE / Hardware Lottery",
            "description": "Simulated Intel SGX trusted enclaves award proposal rights to the shortest random timer.",
            "energy_profile": "Minimal (Idle wait)",
            "finality": "Lotteried / Enclave Certified",
            "parameters": [
                {"name": "decay_rate", "type": "float", "default": 0.05, "min": 0.01, "max": 0.5, "description": "Timer distribution lambda"}
            ],
        },
    ]


def run_simulation(config: SimulationConfig) -> SimulationResult:
    """Execute a single consensus simulation run."""
    mech = config.mechanism.lower()
    if mech not in MODEL_REGISTRY:
        raise ValueError(f"Unknown consensus mechanism '{mech}'. Available: {list(MODEL_REGISTRY.keys())}")

    model_cls = MODEL_REGISTRY[mech]
    model = model_cls(config)
    blocks, events, metrics = model.run_simulation()

    return SimulationResult(
        config=config,
        nodes=model.nodes,
        blocks=blocks,
        events=events,
        metrics=metrics,
        limitations=model.get_limitations(),
    )


def compare_consensus(req: ComparisonRequest) -> ComparisonResult:
    """Run an identical workload across multiple consensus mechanisms."""
    results = {}
    analysis = []

    for mech in req.mechanisms:
        cfg = SimulationConfig(
            mechanism=mech,
            nodes_count=req.nodes_count,
            faulty_nodes_count=req.faulty_nodes_count,
            workload_blocks=req.workload_blocks,
            network_latency_ms=req.network_latency_ms,
            seed=req.seed,
        )
        sim_res = run_simulation(cfg)
        results[mech] = sim_res.metrics

    # Produce balanced comparative analytical observations
    analysis.append(f"Workload evaluated: {req.workload_blocks} blocks across {req.nodes_count} nodes with {req.faulty_nodes_count} faulty nodes.")
    analysis.append("PoW exhibits the highest simulated energy footprint due to competitive puzzle solving, whereas PBFT, PoA, and PoS exhibit orders-of-magnitude lower computational energy.")
    analysis.append("PBFT achieves immediate deterministic finality but incurs O(N^2) message overhead, making it best suited for consortiums (<30 nodes).")
    analysis.append("PoA provides the lowest latency and highest throughput, relying on trusted identities rather than open permissionless participation.")
    analysis.append("PoS and PoET provide lottery-based leader selection without PoW's heavy energy expenditure.")

    return ComparisonResult(
        workload={
            "nodes_count": req.nodes_count,
            "faulty_nodes_count": req.faulty_nodes_count,
            "workload_blocks": req.workload_blocks,
            "network_latency_ms": req.network_latency_ms,
            "seed": req.seed,
        },
        results=results,
        analysis=analysis,
    )
