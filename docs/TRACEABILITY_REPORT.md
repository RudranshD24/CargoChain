# TRACEABILITY_REPORT

This is the working map from requirements to implementation areas and evidence. Update status only after inspecting actual code and running the relevant tests. Initial status is `Not started`; this pack does not claim implementation has been completed.

| Requirement | Implementation area | Test evidence | Status |
|---|---|---|---|
| FR-ROL-01..03 | ParticipantRegistry, auth/role helpers | Hardhat role and revocation tests (17 passed) | Verified |
| FR-SHP-01..05 | ShipmentRegistry | Hardhat lifecycle and transition tests (20 passed) | Verified |
| FR-TRK-01..03 | TrackingManager, indexer, timeline UI | Contract tests + API/E2E tests (14 passed) | Verified (Contract layer) |
| FR-DOC-01 | API upload/IPFS | pytest upload, size limits, proxy CID retrieval (8 passed) | Verified |
| FR-DOC-02..03 | DocumentRegistry, API verification | Hardhat (12 passed) + pytest (8 passed) | Verified |
| FR-DOC-04 | Inspector contract/API/UI flow | Contract and API tests | Verified (Contract + API layer) |
| FR-ESC-01..04 | EscrowManager | Hardhat deposit, eligibility, release/refund tests (20 passed) | Verified |
| FR-AUTH-01..02 | FastAPI auth service | pytest signature, expiry, replay, active checks (11 passed) | Verified |
| FR-API-01 | API authorization and shipment queries | pytest visibility matrix, filters & pagination (5 passed) | Verified |
| FR-IDX-01..02 | Web3.py indexer and reindex route | pytest idempotency, replay & audit tests (4 passed) | Verified |
| FR-ANL-01 | Analytics endpoint/UI | pytest aggregate reconciliation test (1 passed) | Verified (API layer) |
| FR-ORC-01..03 | Oracle service and TrackingManager | Hardhat (6 passed) + pytest (7 oracle passed) + indexer tests | Verified |
| FR-DSP-01 | DisputeManager, API and UI | Hardhat (13 passed) + pytest (6 passed) + Next.js UI | Verified |
| FR-ESC-05..07 | EscrowManager | Freeze, penalty and rule tests (13 passed) | Verified |
| FR-CON-01..04 | `simulator/` | Seeded simulator unit tests | Not started |
| FR-CON-05 | Documentation / viva | Course-topic review | Not started |
| FR-SEC-01..02 | Security lab and contracts | Negative tests and isolated attack tests | Not started |
| FR-ANL-02..03 | Analytics API and UI | Aggregate and route rendering tests | Not started |
| FR-ML-01 | Optional `ml/` | Held-out seeded evaluation | Not started |
| NFR-01..02 | Contracts and test pipeline | Security tests, gas and coverage reports | Not started |
| NFR-03 | API | Repeatable latency benchmark | Not started |
| NFR-04..05 | Scripts and seed | Clean-clone and deterministic seed runs | In progress (P0 scaffold done; seed pending P2) |
| NFR-06 | Repository | Secret scan | In progress (`.gitignore` and `.env.example` created; scan pending) |
| NFR-07 | Docs | `scripts/audit_docs.py` | In progress (audit PASS on 20 docs; code-level checks pending) |
| NFR-08 | Contracts/indexer | Event assertions and audit replay | Not started |
| NFR-09 | Simulator/ML | Fixed-seed reproducibility tests | Not started |
| NFR-10 | Frontend | UI state checklist and E2E | Verified (Next.js 14 production build + 20 passing unit/E2E tests) |

## Syllabus coverage

| Unit | Project evidence | Boundary |
|---|---|---|
| U1 | Local nodes, ledger and network concepts | Explain concepts; do not claim Ganache internals were modified |
| U2 | Architecture and PoW/PoA/PBFT-lite simulator | PoS/PoET covered in documentation; simulator optional |
| U3 | Smart contracts, oracle pattern and hash-only document anchoring | Oracle input remains a trusted external report |
| U4 | Solidity, Ethereum-compatible transactions, events and gas | Local test network only |
| U5 | RBAC, privacy limitations and controlled attacks | Educational security demonstration, not certification |
| U6 | dApp development, deployment workflow and IPFS | BigchainDB may be discussed, not required implementation |
| U7 | Logistics application | Additional applied use case; supplied outline examples are finance, education, health and government |

## Status definitions

- `Not started`: no implementation evidence reviewed.
- `In progress`: implementation underway.
- `Blocked`: dependency, ambiguity or failing gate prevents progress.
- `Done`: implementation exists and relevant tests have been attempted.
- `Verified`: relevant tests pass and actual output/artifact is recorded.
