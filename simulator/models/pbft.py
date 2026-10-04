"""Practical Byzantine Fault Tolerance (PBFT) educational consensus simulation."""

import hashlib
from typing import List, Tuple
from simulator.models.base import BaseConsensusModel
from simulator.schemas import SimulatedBlock, RoundEvent, SimulationMetrics


class PBFTModel(BaseConsensusModel):
    """Simulates classical 3-phase PBFT consensus (Pre-Prepare, Prepare, Commit)."""

    def __init__(self, config):
        super().__init__(config)
        self.n = self.config.nodes_count
        self.f_max = (self.n - 1) // 3
        self.quorum_size = 2 * self.f_max + 1

    def run_simulation(self) -> Tuple[List[SimulatedBlock], List[RoundEvent], SimulationMetrics]:
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        accepted_blocks = 0
        rejected_blocks = 0
        start_time = self.current_time_ms

        view_number = 0

        for block_idx in range(1, self.config.workload_blocks + 1):
            round_start = self.current_time_ms
            # Primary selection: node index = view % N
            primary_idx = view_number % self.n
            primary = self.nodes[primary_idx]

            self.log_event(
                block_idx,
                "VIEW_START",
                primary.node_id,
                f"View {view_number}: Primary node is {primary.node_id} (Quorum required: {self.quorum_size}/{self.n})",
                {"view": view_number, "quorum": self.quorum_size, "f_max": self.f_max}
            )

            # Phase 1: PRE-PREPARE
            block_data = f"{prev_hash}_{block_idx}_{view_number}_{primary.node_id}"
            digest = hashlib.sha256(block_data.encode()).hexdigest()

            # Message: Primary broadcasts pre-prepare to all N-1 replicas
            pre_prepare_msgs = self.n - 1
            self.current_time_ms += self.rng.uniform(0.9, 1.2) * self.config.network_latency_ms
            self.log_event(
                block_idx,
                "PRE_PREPARE",
                primary.node_id,
                f"Primary {primary.node_id} broadcast PRE-PREPARE for sequence #{block_idx}",
                {"digest": digest, "messages": pre_prepare_msgs}
            )

            # Check if primary is faulty (may drop proposal or send corrupt digest)
            primary_corrupt = primary.is_faulty
            if primary_corrupt:
                self.log_event(
                    block_idx,
                    "FAULT_TRIGGERED",
                    primary.node_id,
                    f"Byzantine primary {primary.node_id} broadcast invalid proposal or withheld message",
                )

            # Phase 2: PREPARE
            # Replicas broadcast PREPARE if proposal is valid
            # Number of honest replicas
            honest_nodes = [node for node in self.nodes if not node.is_faulty]
            faulty_nodes = [node for node in self.nodes if node.is_faulty]

            # Replicas exchange prepares with all other nodes: N * (N-1)
            prepare_msgs = self.n * (self.n - 1)
            self.current_time_ms += self.rng.uniform(1.2, 1.8) * self.config.network_latency_ms

            # Each honest node requires 2f+1 valid prepares
            honest_votes = len(honest_nodes)
            if not primary_corrupt:
                honest_prepares = honest_votes
            else:
                honest_prepares = honest_votes - 1 if primary in honest_nodes else honest_votes

            prepare_quorum = honest_prepares >= self.quorum_size

            # Phase 3: COMMIT
            commit_msgs = self.n * (self.n - 1)
            self.current_time_ms += self.rng.uniform(1.2, 1.8) * self.config.network_latency_ms

            commit_quorum = prepare_quorum and (honest_votes >= self.quorum_size)

            round_msgs = pre_prepare_msgs + prepare_msgs + commit_msgs
            self.total_messages += round_msgs

            # Energy estimate: network and CPU message routing (~40W/node)
            round_duration_sec = (self.current_time_ms - round_start) / 1000.0
            round_energy_joules = round_duration_sec * (self.n * 40.0)
            self.total_energy_joules += round_energy_joules

            is_accepted = commit_quorum and not primary_corrupt
            rejection_reason = None

            if is_accepted:
                accepted_blocks += 1
                prev_hash = digest
                self.log_event(
                    block_idx,
                    "COMMIT_SUCCESS",
                    "network",
                    f"Block #{block_idx} committed across network with instant 100% finality",
                    {"digest": digest, "prepares": honest_prepares, "commits": honest_votes}
                )
            else:
                rejected_blocks += 1
                if primary_corrupt:
                    rejection_reason = f"Primary node {primary.node_id} byzantine fault triggered view-change"
                else:
                    rejection_reason = (
                        f"Byzantine fault threshold exceeded: {len(faulty_nodes)} faulty nodes > "
                        f"max tolerable f={self.f_max}. Quorum ({self.quorum_size}) unattainable."
                    )
                self.log_event(block_idx, "ROUND_FAILED", "network", rejection_reason)
                # View change happens on failure
                view_number += 1

            round_latency = self.current_time_ms - round_start
            self.blocks.append(
                SimulatedBlock(
                    block_number=block_idx,
                    proposer_id=primary.node_id,
                    hash=digest,
                    previous_hash=prev_hash,
                    accepted=is_accepted,
                    transaction_count=self.rng.randint(50, 200),
                    round_latency_ms=round(round_latency, 2),
                    messages_exchanged=round_msgs,
                    energy_joules=round(round_energy_joules, 2),
                    reason=rejection_reason,
                )
            )

        total_sim_time = max(1.0, self.current_time_ms - start_time)
        avg_latency = total_sim_time / self.config.workload_blocks
        throughput = (accepted_blocks / (total_sim_time / 1000.0))

        metrics = SimulationMetrics(
            mechanism="pbft",
            total_blocks_proposed=self.config.workload_blocks,
            total_blocks_accepted=accepted_blocks,
            total_blocks_rejected=rejected_blocks,
            total_messages_exchanged=self.total_messages,
            total_elapsed_simulation_ms=round(total_sim_time, 2),
            average_block_latency_ms=round(avg_latency, 2),
            throughput_blocks_per_sec=round(throughput, 2),
            estimated_energy_joules=round(self.total_energy_joules, 2),
            faulty_nodes_count=self.config.faulty_nodes_count,
            fault_impact_detected=rejected_blocks > 0,
            bft_tolerance_limit=f"f <= (n - 1) / 3 = {self.f_max} faulty nodes out of {self.n}",
            consensus_finality_type="Deterministic Instant (Zero probabilistic fork risk)",
        )
        return self.blocks, self.events, metrics

    def get_limitations(self) -> List[str]:
        return [
            "Message complexity scales quadratically as O(N^2), limiting scalability to ~30-50 nodes.",
            "Requires static known validator set and synchronous/partially-synchronous timing assumptions.",
            "Strictly educational simulation; does not run actual network sockets or Ganache consensus.",
            "Simulates view-change and quorum failures based on byzantine node threshold.",
        ]
