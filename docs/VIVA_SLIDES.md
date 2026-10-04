# VIVA_SLIDES

Suggested slide structure. Populate results, diagrams and screenshots from the actual implementation; do not invent measurements.

## 1. Title and context
- CargoChain — Smart Contract-Based Logistics and Freight Management
- Blockchain Technology (`702IT0E016`)
- Student: Rudransh Dubey
- State the system is a local academic proof of concept.

## 2. Problem and motivation
- Fragmented logistics records can create reconciliation and traceability challenges.
- Need for shared history, role control and tamper-evident documents.
- Clarify that blockchain does not guarantee truthful input data.

## 3. Objectives and scope
- Shipment lifecycle, roles, document integrity, escrow simulation and audit.
- MVP versus advanced work.
- Out-of-scope items: real payments, real GPS, production deployment.

## 4. Blockchain foundations
- Distributed ledger, blocks, hashes, nodes and permissioned participation.
- Explain what the local EVM demo does and does not represent.

## 5. Architecture
- Frontend, MetaMask, contracts, API/indexer, PostgreSQL and IPFS.
- Blockchain is source of truth; DB is rebuildable index.

## 6. Smart contracts
- Responsibilities of ParticipantRegistry, ShipmentRegistry, TrackingManager, DocumentRegistry, EscrowManager and optional DisputeManager.
- Explain role modifiers, state transitions and emitted events.

## 7. Shipment workflow
- Create → Accept → InTransit → Arrived → Delivered → Completed.
- Show guarded exception paths: reject, cancel, delay and dispute if implemented.

## 8. Document integrity
- Upload to IPFS, compute SHA-256, anchor hash/CID, recompute and compare.
- Hash is integrity evidence, not encryption or proof of document truth.

## 9. Escrow simulation
- Deposit, eligibility, release/refund and optional penalty.
- Test ETH on Ganache only; not a commercial payment rail.

## 10. Oracle and trust boundary
- Simulated route/status source, signer restrictions and provenance.
- Explain that contract code cannot independently prove GPS truth.

## 11. Consensus mechanisms
- Compare PoW, PoS, BFT, PoA and PoET conceptually.
- Show implemented simulator models only; explain PBFT-lite assumptions.
- Mention Algorand and sharding in the context of the supplied syllabus without overstating project implementation.

## 12. Security and privacy
- RBAC, transition validation, replay protection, reentrancy, hash verification and event audit.
- Pseudonymity is not anonymity; public chain data is observable.

## 13. Implementation and demonstration
- Stack, local deployment, actual screenshots and transaction flow.
- Distinguish completed, simulated and proposed features.

## 14. Testing and evaluation
- Real test counts/results, coverage, gas, API latency and simulator metrics.
- State environment, seed, limitations and failed/skipped tests.

## 15. Results, limitations and future work
- Summarize only measured results.
- Limitations: local chain, trusted admin/oracle, synthetic data, IPFS availability and no real settlement.
- Future work: stronger oracle verification, production security review, privacy controls and approved extensions.

## 16. Questions
Be prepared to explain: why blockchain; why DB index; why MetaMask; why IPFS hash; state machine; oracle problem; reentrancy; consensus assumptions; upgrade approach; and what would be required for production.
