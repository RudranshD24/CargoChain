"""Base abstract model for consensus simulations."""

import abc
import random
from typing import List, Tuple
from simulator.schemas import (
    SimulationConfig,
    SimulationNode,
    SimulatedBlock,
    RoundEvent,
    SimulationMetrics,
)


class BaseConsensusModel(abc.ABC):
    """Abstract base class that all consensus simulators inherit from."""

    def __init__(self, config: SimulationConfig):
        self.config = config
        self.rng = random.Random(config.seed)
        self.nodes: List[SimulationNode] = []
        self.events: List[RoundEvent] = []
        self.blocks: List[SimulatedBlock] = []
        self.current_time_ms: float = 0.0
        self.total_messages: int = 0
        self.total_energy_joules: float = 0.0
        self._initialize_nodes()

    def _initialize_nodes(self):
        """Default node initialization with deterministic faulty assignment."""
        faulty_indices = set(self.rng.sample(range(self.config.nodes_count), self.config.faulty_nodes_count))
        for i in range(self.config.nodes_count):
            node_id = f"node_{i:02d}"
            is_faulty = i in faulty_indices
            self.nodes.append(
                SimulationNode(
                    node_id=node_id,
                    is_faulty=is_faulty,
                    is_leader=False,
                    stake=100.0 if not is_faulty else 50.0,
                    authority=True if i < 5 else False,
                )
            )

    def log_event(self, round_num: int, step: str, node_id: str, message: str, data: dict = None):
        """Append a discrete simulation event with timestamp."""
        self.events.append(
            RoundEvent(
                round_number=round_num,
                step=step,
                node_id=node_id,
                message=message,
                data=data or {},
                timestamp_ms=round(self.current_time_ms, 2),
            )
        )

    @abc.abstractmethod
    def run_simulation(self) -> Tuple[List[SimulatedBlock], List[RoundEvent], SimulationMetrics]:
        """Execute discrete event rounds and return blocks, events, and metrics."""
        pass

    @abc.abstractmethod
    def get_limitations(self) -> List[str]:
        """Return protocol-specific limitations and educational caveats."""
        pass
