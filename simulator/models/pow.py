"""Proof of Work (PoW) educational consensus simulation."""

import hashlib
from typing import List, Tuple
from simulator.models.base import BaseConsensusModel
from simulator.schemas import SimulatedBlock, RoundEvent, SimulationMetrics


class PoWModel(BaseConsensusModel):
    """Simulates Nakamoto Proof of Work consensus."""

    def __init__(self, config):
        super().__init__(config)
        self.difficulty = int(self.config.parameters.get("difficulty", 2))
        # Clamp difficulty between 1 and 4 for responsive simulation
        self.difficulty = max(1, min(self.difficulty, 4))
        self.target_prefix = "0" * self.difficulty

    def run_simulation(self) -> Tuple[List[SimulatedBlock], List[RoundEvent], SimulationMetrics]:
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        accepted_blocks = 0
        rejected_blocks = 0
        start_time = self.current_time_ms

        for block_idx in range(1, self.config.workload_blocks + 1):
            round_start = self.current_time_ms
            self.log_event(block_idx, "START_ROUND", "network", f"Mining started for block #{block_idx}")

            # Each node competes to solve the puzzle
            # Honest nodes have base hashrate, faulty nodes may submit invalid blocks
            best_time = float("inf")
            winner_node = None
            winner_nonce = 0
            winner_hash = ""

            for node in self.nodes:
                # Simulated hash tries based on exponential distribution
                # Hashrate: honest node hashrate around 1000 hashes/sec
                hashrate = 1200 if not node.is_faulty else 600
                mining_delay_sec = self.rng.expovariate(1.0 / (2.0 ** (self.difficulty * 2.5)))
                delay_ms = (mining_delay_sec * 1000) / (hashrate / 1000)
                # Add network propagation
                arrival_ms = delay_ms + self.rng.uniform(0.8, 1.2) * self.config.network_latency_ms

                if arrival_ms < best_time:
                    best_time = arrival_ms
                    winner_node = node
                    winner_nonce = self.rng.randint(1000, 999999)
                    candidate = f"{prev_hash}_{block_idx}_{winner_nonce}_{node.node_id}"
                    winner_hash = hashlib.sha256(candidate.encode()).hexdigest()
                    if not winner_hash.startswith(self.target_prefix):
                        winner_hash = self.target_prefix + winner_hash[len(self.target_prefix):]

            self.current_time_ms += best_time
            # Messages: Block broadcast from winner to all N-1 peers
            round_messages = self.config.nodes_count - 1
            self.total_messages += round_messages

            # Energy estimate: simulated ASIC wattage (~1500W per node during hash search)
            round_energy_joules = (best_time / 1000.0) * (self.config.nodes_count * 1200.0)
            self.total_energy_joules += round_energy_joules

            # Faulty node validation check
            is_valid = True
            rejection_reason = None
            if winner_node.is_faulty:
                # Malicious node may attempt invalid block or double proposal
                is_valid = False
                rejection_reason = "Invalid proof-of-work or malicious block rejected by honest majority"
                rejected_blocks += 1
                self.log_event(
                    block_idx,
                    "REJECT_BLOCK",
                    winner_node.node_id,
                    f"Block #{block_idx} by faulty {winner_node.node_id} rejected by peers",
                    {"hash": winner_hash, "reason": rejection_reason}
                )
            else:
                accepted_blocks += 1
                prev_hash = winner_hash
                self.log_event(
                    block_idx,
                    "ACCEPT_BLOCK",
                    winner_node.node_id,
                    f"Block #{block_idx} mined by {winner_node.node_id} and accepted by network",
                    {"hash": winner_hash, "nonce": winner_nonce, "difficulty": self.difficulty}
                )

            round_latency = self.current_time_ms - round_start
            self.blocks.append(
                SimulatedBlock(
                    block_number=block_idx,
                    proposer_id=winner_node.node_id,
                    hash=winner_hash,
                    previous_hash=prev_hash,
                    accepted=is_valid,
                    transaction_count=self.rng.randint(10, 50),
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
            mechanism="pow",
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
            bft_tolerance_limit="< 50% computational hashrate (Honest Majority)",
            consensus_finality_type="Probabilistic (requires depth confirmations, e.g. k=6 blocks)",
        )
        return self.blocks, self.events, metrics

    def get_limitations(self) -> List[str]:
        return [
            "Simulates hash puzzle solution time using stochastic distribution rather than burning real hardware cycles.",
            "Assumes honest nodes validate transactions correctly upon receiving block broadcast.",
            "Energy metric is an educational approximation based on 1.2 kW per node hash wattage.",
            "Does not alter local Ganache blockchain or perform actual EVM mining.",
        ]
