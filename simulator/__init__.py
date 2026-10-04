"""CargoChain Consensus Simulator — educational package.

Simulates PoW, PoS, PBFT, PoA, and PoET models with deterministic seeded execution.
Completely isolated from Ganache local blockchain.
"""

from simulator.schemas import (
    SimulationConfig,
    SimulationResult,
    SimulationMetrics,
    SimulatedBlock,
    RoundEvent,
    ComparisonRequest,
    ComparisonResult,
    ConsensusProtocolType,
)
from simulator.engine import run_simulation, compare_consensus, get_supported_models

__version__ = "0.2.0"

__all__ = [
    "SimulationConfig",
    "SimulationResult",
    "SimulationMetrics",
    "SimulatedBlock",
    "RoundEvent",
    "ComparisonRequest",
    "ComparisonResult",
    "ConsensusProtocolType",
    "run_simulation",
    "compare_consensus",
    "get_supported_models",
]
