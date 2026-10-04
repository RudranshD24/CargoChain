"""Proof of Stake (PoS) educational consensus simulation."""

import hashlib
from typing import List, Tuple
from simulator.models.base import BaseConsensusModel
from simulator.schemas import SimulatedBlock, RoundEvent, SimulationMetrics


class PoSModel(BaseConsensusModel):
    """Simulates Proof of Stake with validator lottery and attestation committees."""

    def __init__(self, config):
        super().__init__(config)
        # Allocate heterogenous stakes for educational demonstration
        for i, node in enumerate(self.nodes):
            # Base stake varies from 50 to 500 ETH-equivalent
            node.stake = 100.0 + (i * 40.0)

    def run_simulation(self) -> Tuple[List[SimulatedBlock], List[RoundEvent], SimulationMetrics]:
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        accepted_blocks = 0
        rejected_blocks = 0
        start_time = self.current_time_ms

        total_stake = sum(n.stake for n in self.nodes)

        for block_idx in range(1, self.config.workload_blocks + 1):
            round_start = self.current_time_ms
            # Slot leader lottery proportional to stake
            rand_val = self.rng.uniform(0, total_stake)
            cumulative = 0.0
            leader = self.nodes[0]
            for n in self.nodes:
                cumulative += n.stake
                if rand_val <= cumulative:
                    leader = n
                    break

            self.log_event(
                block_idx,
                "LEADER_ELECTED",
                leader.node_id,
                f"Slot leader {leader.node_id} selected (Stake: {leader.stake:.0f})",
                {"stake": leader.stake, "share_pct": round(leader.stake / total_stake * 100, 1)}
            )

            # Leader proposals
            block_data = f"{prev_hash}_{block_idx}_{leader.node_id}"
            block_hash = hashlib.sha256(block_data.encode()).hexdigest()

            # Propagation delay from leader to committee
            proposal_time = self.rng.uniform(0.9, 1.3) * self.config.network_latency_ms
            self.current_time_ms += proposal_time

            # Attestation committee votes: honest nodes attest if proposal is valid
            attestations = 0
            attesting_stake = 0.0
            is_valid = not leader.is_faulty
            rejection_reason = None

            for node in self.nodes:
                if node.node_id == leader.node_id:
                    continue
                if node.is_faulty and self.rng.random() < 0.5:
                    # Faulty validator may withhold attestation
                    continue
                attestations += 1
                attesting_stake += node.stake

            # Message overhead: 1 proposal multicast + N-1 attestation votes
            round_messages = (self.config.nodes_count - 1) + attestations
            self.total_messages += round_messages

            # Attestation aggregation latency
            attestation_latency = self.rng.uniform(1.0, 1.5) * self.config.network_latency_ms
            self.current_time_ms += attestation_latency

            # Check if 2/3 stake quorum was met
            stake_quorum = (attesting_stake / total_stake) >= (2.0 / 3.0)

            # Energy estimate: validation compute ~50W per node
            round_duration_sec = (self.current_time_ms - round_start) / 1000.0
            round_energy_joules = round_duration_sec * (self.config.nodes_count * 50.0)
            self.total_energy_joules += round_energy_joules

            if not is_valid:
                rejected_blocks += 1
                rejection_reason = f"Slot leader {leader.node_id} was faulty; committee refused attestation"
                self.log_event(block_idx, "PROPOSAL_REJECTED", leader.node_id, rejection_reason)
            elif not stake_quorum:
                rejected_blocks += 1
                rejection_reason = "Attestation failed to reach 2/3 stake quorum"
                self.log_event(block_idx, "QUORUM_FAILED", "network", rejection_reason)
            else:
                accepted_blocks += 1
                prev_hash = block_hash
                self.log_event(
                    block_idx,
                    "BLOCK_COMMITTED",
                    leader.node_id,
                    f"Block #{block_idx} certified by committee ({attestations} attestations, {attesting_stake:.0f} stake)",
                    {"hash": block_hash, "attesting_stake": attesting_stake}
                )

            round_latency = self.current_time_ms - round_start
            self.blocks.append(
                SimulatedBlock(
                    block_number=block_idx,
                    proposer_id=leader.node_id,
                    hash=block_hash,
                    previous_hash=prev_hash,
                    accepted=(is_valid and stake_quorum),
                    transaction_count=self.rng.randint(25, 100),
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
            mechanism="pos",
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
            bft_tolerance_limit="< 33.3% of total active stake (Liveness/Safety Quorum)",
            consensus_finality_type="Deterministic at epoch checkpoint (Casper FFG style)",
        )
        return self.blocks, self.events, metrics

    def get_limitations(self) -> List[str]:
        return [
            "Simulates stake lottery and attestation committees with fixed in-memory validators.",
            "Does not execute actual EVM staking contract deposits or token slashing on Ganache.",
            "Assumes synchronous slot boundaries for educational clarity.",
            "Energy usage represents lightweight validation compute (~50W/node) without hardware mining.",
        ]
