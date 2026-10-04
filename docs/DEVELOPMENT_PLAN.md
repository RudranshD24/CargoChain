# DEVELOPMENT_PLAN

The project is implemented in gated phases. MVP is the P0–P3 cut-line. Advanced phases are conditional on MVP completion and available time.

## 1. Phase overview

| Phase | Focus | Gate |
|---|---|---|
| P0 | Repository scaffold and local service checks | Clean structure, configs and hello-world checks |
| P1 | Solidity MVP contracts | Compile, contract tests, deployment and ABI export |
| P2 | API, authentication, indexer and IPFS | API/integration tests and reindex correctness |
| P3 | Frontend MVP and end-to-end gate | Core demo acts pass; MVP accepted |
| P4 | Oracle, disputes and escrow exceptions | Oracle/dispute/penalty tests pass |
| P5 | Independent consensus simulator | Deterministic model tests and comparison |
| P6 | Security lab and advanced analytics | Controlled attacks and integration tests |
| P7 | Optional ML and evaluation | Baseline comparison and reproducible results |
| P8 | Documentation freeze, report and viva | Audit, clean demo, final evidence |

## 2. Phase details

### P0 — Scaffold
Create contracts, backend, frontend, simulator, oracle, optional ML package, Docker Compose, `.env.example`, `.gitignore`, scripts and docs. No business logic. Check Hardhat compile, pytest discovery, frontend build, Docker Compose configuration and audit script where applicable.

### P1 — Contracts MVP
Implement participant registry, shipment state machine, tracking/custody, document anchoring and escrow MVP. Write Hardhat tests before or alongside each requirement group. Deploy to local chain, export ABIs and deployment metadata. Hardhat tests cover Solidity behavior only; API, UI and IPFS behavior are tested in later phases.

### P2 — Backend, indexer and IPFS
Implement wallet nonce/signature auth, API MVP, SQLAlchemy models, migrations, idempotent event indexer, IPFS upload/verify and deterministic seed. Enforce server-side visibility. Do not relay user contract writes.

### P3 — Frontend MVP and acceptance gate
Implement wallet connection, role dashboards, shipment create/detail/timeline, document flow, escrow panel, admin participant management, audit and summary analytics. Run end-to-end MVP demo and resolve blockers before advancing.

### P4 — Oracle and exceptions
Implement restricted oracle signer, route scenarios, provenance, geofence checks, disputes, escrow freeze, configurable rules and late penalties. Keep oracle truth limitations visible.

### P5 — Consensus simulator
Implement independent seeded PoW, PoA and PBFT-lite models. Add common workload, comparison metrics and explanatory PoS/PoET documentation. Optional PoS/PoET prototypes require approval and must not displace MVP.

### P6 — Security lab and advanced analytics
Add isolated attack demos, authorization/transition walkthroughs, advanced analytics and route visualization. Run security tools when available and document exact limitations.

### P7 — Optional ML
Only proceed if core requirements are stable. Generate synthetic data, compare baseline and candidate model, report real held-out metrics and expose prediction with clear synthetic-data caveat.

### P8 — Freeze and presentation
Run full test/audit suite, reconcile docs and code, rehearse clean-clone demo, capture actual screenshots, finalize report/slides and record remaining limitations.

## 3. MVP gate (end of P3)

MVP is accepted only if: contracts compile and core tests pass; role/state rules are enforced; documents can be uploaded, anchored and verified; escrow test-ETH lifecycle works; authentication and role-filtered reads work; indexer is idempotent and reindexable; core UI flow is demonstrated; and known failures are listed. Advanced features are not MVP blockers.

## 4. Scope control

Priority order when time is constrained: (1) correctness/security of contract MVP, (2) indexing and authentication, (3) usable frontend demo, (4) evaluation evidence, (5) advanced features. Do not start ML or elaborate animations before the MVP gate. Any scope reduction requires explicit user approval and a decision log entry.

## 5. Status tracking

Use `Not started`, `In progress`, `Blocked`, `Done`, `Verified`. `Done` means implementation exists; `Verified` means relevant tests/evidence passed. Update `TRACEABILITY_REPORT.md` and `CHANGELOG.md` at each gate.
