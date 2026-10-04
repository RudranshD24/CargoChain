"""CargoChain Consensus Simulator — Data Schemas.

Defines validated Pydantic models for simulation configurations,
runtime telemetry, round event records, and comparison reports.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, model_validator


class ConsensusProtocolType:
    POW = "pow"
    POS = "pos"
    PBFT = "pbft"
    POA = "poa"
    POET = "poet"
    ALL = [POW, POS, PBFT, POA, POET]


class SimulationNode(BaseModel):
    """Represents a simulated participant in the consensus network."""
    node_id: str
    is_faulty: bool = False
    is_leader: bool = False
    stake: float = 0.0
    authority: bool = False
    reputation: float = 1.0


class RoundEvent(BaseModel):
    """Discrete event emitted during a consensus round."""
    round_number: int
    step: str
    node_id: str
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp_ms: float


class SimulatedBlock(BaseModel):
    """Simulated block proposed and committed during a consensus run."""
    block_number: int
    proposer_id: str
    hash: str
    previous_hash: str
    accepted: bool = True
    transaction_count: int
    round_latency_ms: float
    messages_exchanged: int
    energy_joules: float = 0.0
    reason: Optional[str] = None


class SimulationConfig(BaseModel):
    """Validated configuration for running a consensus simulation."""
    mechanism: str = Field(..., description="Consensus mechanism: pow, pos, pbft, poa, poet")
    nodes_count: int = Field(default=8, ge=3, le=50, description="Total participating nodes")
    faulty_nodes_count: int = Field(default=0, ge=0, description="Number of malicious/byzantine/crashed nodes")
    workload_blocks: int = Field(default=5, ge=1, le=25, description="Number of blocks to simulate")
    network_latency_ms: float = Field(default=50.0, ge=5.0, le=1000.0, description="Average network link latency in ms")
    seed: int = Field(default=42, description="Random seed for deterministic reproducibility")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Protocol-specific parameters")

    @model_validator(mode="after")
    def validate_node_ratios(self):
        mech = self.mechanism.lower()
        if mech not in ConsensusProtocolType.ALL:
            raise ValueError(f"Unsupported mechanism '{self.mechanism}'. Supported: {ConsensusProtocolType.ALL}")
        if self.faulty_nodes_count >= self.nodes_count:
            raise ValueError(f"Faulty nodes ({self.faulty_nodes_count}) must be less than total nodes ({self.nodes_count})")
        if mech == ConsensusProtocolType.PBFT:
            # PBFT requires 3f + 1 <= n (i.e. f <= (n - 1) // 3)
            max_faulty = (self.nodes_count - 1) // 3
            if self.faulty_nodes_count > max_faulty:
                # We allow it to run to demonstrate PBFT liveness failure, but warn in parameters
                self.parameters["byzantine_resilience_violated"] = True
        return self


class SimulationMetrics(BaseModel):
    """Summary metrics calculated from a completed consensus run."""
    mechanism: str
    total_blocks_proposed: int
    total_blocks_accepted: int
    total_blocks_rejected: int
    total_messages_exchanged: int
    total_elapsed_simulation_ms: float
    average_block_latency_ms: float
    throughput_blocks_per_sec: float
    estimated_energy_joules: float
    faulty_nodes_count: int
    fault_impact_detected: bool
    bft_tolerance_limit: str
    consensus_finality_type: str


class SimulationResult(BaseModel):
    """Complete simulation result returned to API and UI."""
    config: SimulationConfig
    nodes: List[SimulationNode]
    blocks: List[SimulatedBlock]
    events: List[RoundEvent]
    metrics: SimulationMetrics
    limitations: List[str]


class ComparisonRequest(BaseModel):
    """Request to run multiple consensus mechanisms on an identical workload."""
    mechanisms: List[str] = Field(default_factory=lambda: ["pow", "pos", "pbft", "poa", "poet"])
    nodes_count: int = Field(default=10, ge=4, le=30)
    faulty_nodes_count: int = Field(default=1, ge=0)
    workload_blocks: int = Field(default=5, ge=1, le=15)
    network_latency_ms: float = Field(default=40.0, ge=5.0, le=500.0)
    seed: int = Field(default=42)


class ComparisonResult(BaseModel):
    """Cross-protocol comparison matrix."""
    workload: Dict[str, Any]
    results: Dict[str, SimulationMetrics]
    analysis: List[str]
