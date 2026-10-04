"""Proof of Authority (PoA) educational consensus simulation."""

import hashlib
from typing import List, Tuple
from simulator.models.base import BaseConsensusModel
from simulator.schemas import SimulatedBlock, RoundEvent, SimulationMetrics


class PoAModel(BaseConsensusModel):
    """Simulates Proof of Authority (e.g. Clique / Aura) with authorized signers."""

    def __init__(self, config):
        super().__init__(config)
        # Authorize first M nodes as designated authorities (default M = 5 or nodes_count)
        self.auth_count = int(self.config.parameters.get("authorities_count", min(5, self.config.nodes_count)))
        self.auth_count = max(3, min(self.auth_count, self.config.nodes_count))
        for i in range(self.config.nodes_count):
            self.nodes[i].authority = (i < self.auth_count)
        self.authorities = [n for n in self.nodes if n.authority]

    def run_simulation(self) -> Tuple[List[SimulatedBlock], List[RoundEvent], SimulationMetrics]:
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        accepted_blocks = 0
        rejected_blocks = 0
        start_time = self.current_time_ms

        for block_idx in range(1, self.config.workload_blocks + 1):
            round_start = self.current_time_ms
            # Round-robin selection among authorities
            auth_idx = (block_idx - 1) % len(self.authorities)
            signer = self.authorities[auth_idx]

            self.log_event(
                block_idx,
                "SIGNER_ASSIGNED",
                signer.node_id,
                f"Designated authority signer for block #{block_idx}: {signer.node_id}",
                {"authority_index": auth_idx, "total_authorities": len(self.authorities)}
            )

            # Block proposal with authority signature
            block_data = f"{prev_hash}_{block_idx}_{signer.node_id}"
            block_hash = hashlib.sha256(block_data.encode()).hexdigest()

            # Propagation delay
            self.current_time_ms += self.rng.uniform(0.7, 1.1) * self.config.network_latency_ms

            # Messages: Signer broadcasts signed block to all N-1 network participants
            round_messages = self.config.nodes_count - 1
            self.total_messages += round_messages

            # Energy estimate: minimal signature check compute (~30W/node)
            round_duration_sec = (self.current_time_ms - round_start) / 1000.0
            round_energy_joules = round_duration_sec * (self.config.nodes_count * 30.0)
            self.total_energy_joules += round_energy_joules

            is_accepted = not signer.is_faulty
            rejection_reason = None

            if is_accepted:
                accepted_blocks += 1
                prev_hash = block_hash
                self.log_event(
                    block_idx,
                    "AUTHORITY_COMMITTED",
                    signer.node_id,
                    f"Block #{block_idx} signed by authority {signer.node_id} accepted with instant finality",
                    {"hash": block_hash, "signer": signer.node_id}
                )
            else:
                rejected_blocks += 1
                rejection_reason = f"Designated authority {signer.node_id} was compromised or failed to sign block"
                self.log_event(block_idx, "SIGNATURE_FAILED", signer.node_id, rejection_reason)

            round_latency = self.current_time_ms - round_start
            self.blocks.append(
                SimulatedBlock(
                    block_number=block_idx,
                    proposer_id=signer.node_id,
                    hash=block_hash,
                    previous_hash=prev_hash,
                    accepted=is_accepted,
                    transaction_count=self.rng.randint(50, 150),
                    round_latency_ms=round(round_latency, 2),
                    messages_exchanged=round_messages,
                    energy_joules=round(round_energy_joules, 2),
                    reason=rejection_reason,
                )
            )

        total_sim_time = max(1.0, self.current_time_ms - start_time)
        avg_latency = total_sim_time / self.config.workload_blocks
        throughput = (accepted_blocks / (total_sim_time / 1000.0))

        metrics = SimulationMetrics(
            mechanism="poa",
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
            bft_tolerance_limit="< 50% of designated authority signers (Majority of Signers)",
            consensus_finality_type="Deterministic Instant upon authority threshold verification",
        )
        return self.blocks, self.events, metrics

    def get_limitations(self) -> List[str]:
        return [
            "Relies on centralized or consortium-governed trusted identity verification.",
            "Lacks censorship resistance against colluding authority quorums.",
            "Educational model; does not integrate with Ganache or actual Clique consensus engine.",
        ]
