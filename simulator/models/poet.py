"""Proof of Elapsed Time (PoET) educational consensus simulation."""

import hashlib
from typing import List, Tuple
from simulator.models.base import BaseConsensusModel
from simulator.schemas import SimulatedBlock, RoundEvent, SimulationMetrics


class PoETModel(BaseConsensusModel):
    """Simulates Proof of Elapsed Time (PoET) based on Trusted Execution Environment (TEE) timers."""

    def __init__(self, config):
        super().__init__(config)
        self.decay_lambda = float(self.config.parameters.get("decay_rate", 0.05))

    def run_simulation(self) -> Tuple[List[SimulatedBlock], List[RoundEvent], SimulationMetrics]:
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        accepted_blocks = 0
        rejected_blocks = 0
        start_time = self.current_time_ms

        for block_idx in range(1, self.config.workload_blocks + 1):
            round_start = self.current_time_ms
            # Each node requests random wait time from its simulated secure enclave
            enclave_timers = []
            for node in self.nodes:
                # Exponential random wait time in milliseconds
                u = self.rng.uniform(0.01, 0.99)
                wait_time_ms = - (1.0 / self.decay_lambda) * (u ** 0.5) * 50.0
                wait_time_ms = max(10.0, wait_time_ms)
                enclave_timers.append((wait_time_ms, node))

            # Sort by shortest wait time
            enclave_timers.sort(key=lambda x: x[0])
            winner_wait, winner_node = enclave_timers[0]

            self.log_event(
                block_idx,
                "ENCLAVE_TIMER_EXPIRED",
                winner_node.node_id,
                f"Node {winner_node.node_id} enclave timer expired first ({winner_wait:.1f}ms). Claiming proposal rights.",
                {"wait_time_ms": round(winner_wait, 1)}
            )

            # Advance clock by winning wait time + propagation
            self.current_time_ms += winner_wait + (self.rng.uniform(0.8, 1.2) * self.config.network_latency_ms)

            # Messages: Winner broadcasts block + SGX quote certificate to all N-1 peers
            round_messages = self.config.nodes_count - 1
            self.total_messages += round_messages

            # Energy estimate: low-power idle wait + enclave validation (~35W/node)
            round_duration_sec = (self.current_time_ms - round_start) / 1000.0
            round_energy_joules = round_duration_sec * (self.config.nodes_count * 35.0)
            self.total_energy_joules += round_energy_joules

            block_data = f"{prev_hash}_{block_idx}_{winner_node.node_id}_{winner_wait}"
            block_hash = hashlib.sha256(block_data.encode()).hexdigest()

            is_accepted = not winner_node.is_faulty
            rejection_reason = None

            if is_accepted:
                accepted_blocks += 1
                prev_hash = block_hash
                self.log_event(
                    block_idx,
                    "POET_BLOCK_ACCEPTED",
                    winner_node.node_id,
                    f"Block #{block_idx} certified with valid TEE wait certificate",
                    {"hash": block_hash, "wait_time_ms": round(winner_wait, 1)}
                )
            else:
                rejected_blocks += 1
                rejection_reason = f"Node {winner_node.node_id} submitted invalid enclave certificate (SGX spoofing detected)"
                self.log_event(block_idx, "CERTIFICATE_REJECTED", winner_node.node_id, rejection_reason)

            round_latency = self.current_time_ms - round_start
            self.blocks.append(
                SimulatedBlock(
                    block_number=block_idx,
                    proposer_id=winner_node.node_id,
                    hash=block_hash,
                    previous_hash=prev_hash,
                    accepted=is_accepted,
                    transaction_count=self.rng.randint(30, 120),
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
            mechanism="poet",
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
            bft_tolerance_limit="Assumes uncompromised TEE manufacturer root-of-trust (Intel SGX)",
            consensus_finality_type="Probabilistic / Lotteried without computational waste",
        )
        return self.blocks, self.events, metrics

    def get_limitations(self) -> List[str]:
        return [
            "Hardware trust dependency: relies on security of proprietary enclave microcode.",
            "Vulnerable to side-channel timing attacks or compromised enclave keys in production.",
            "Purely educational simulation using synthetic random wait distributions.",
        ]
