# CHANGELOG

All notable specification and project changes are recorded here. Dates use ISO `YYYY-MM-DD`. This log does not imply implementation completion.

## [1.8] — 2026-10-04

### P6 — Security Hardening, Advanced Analytics & Production-Readiness Assessment
- Smart Contract Security Hardening (`contracts/test/SecurityAttacks.test.js`):
  - Created dedicated Phase 6 Security Lab with 10 isolated, reproducible attack demonstration tests.
  - Demonstrated and verified Reentrancy protection on both `releasePayment` and `refund` flows via OpenZeppelin `ReentrancyGuard` mutex.
  - Verified state machine invariant enforcement, blocking illegal transition jumps (e.g. Created -> Delivered, Accepted -> Completed) and enforcing terminal state immutability.
  - Verified strict role authorization preventing non-admin participant registration/revocation and escrow rule tampering.
  - Verified physical custody protection rejecting transfers initiated by non-custodians.
  - Verified dispute resolution boundary protection, rejecting basis points split > 10,000 and blocking duplicate resolutions.
  - Verified Oracle role containment, proving the Oracle key cannot execute shipper/transporter/admin contract actions.
  - Hardhat contract test suite increased from 108 to 118 passing tests (100% pass rate).
- Backend Security Hardening (`backend/`):
  - Added OWASP security headers middleware (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-XSS-Protection`).
  - Added request payload size restriction middleware rejecting bodies > 2MB with HTTP `413 PAYLOAD_TOO_LARGE`.
  - Enforced role-based object-level authorization (IDOR protection) on analytics endpoints.
  - Created `backend/tests/test_phase6_security_analytics.py` (5 passing tests).
  - Pytest suite increased from 71 to 76 passing tests (100% pass rate).
- Advanced Analytics & Route Observability:
  - Added `GET /api/v1/analytics/advanced` returning lifecycle duration metrics, transporter SLA compliance rates, and freight corridor delay analytics with synthetic data tagging.
  - Added `GET /api/v1/analytics/route-corridors` returning ordered waypoint progressions with decimal coordinate scaling and geofence indicators.
  - Enhanced frontend Analytics console (`/analytics`) with interactive Route Corridor Waypoint Visualizer, Transporter SLA performance leaderboard, and lifecycle breakdown cards.
  - Verified Next.js 14 production build (14/14 static pages generated).
- Documentation & Audit Deliverables:
  - Created `docs/PHASE_6_REPOSITORY_AUDIT.md`, `docs/SECURITY_THREAT_MODEL.md`, `docs/PHASE_6_IMPLEMENTATION_PLAN.md`, `docs/SECURITY_REVIEW_REPORT.md`, `docs/ADVANCED_ANALYTICS.md`, `docs/PHASE_6_TESTING_AND_ACCEPTANCE.md`, and `docs/PHASE_6_COMPLETION_REPORT.md`.
  - Verified all 20 required canonical documents with `python scripts/audit_docs.py` (0 errors, 0 warnings).

## [1.7] — 2026-10-03

### P5 — Consensus Simulator & ML ETA Delay Prediction
- Module A — Educational Consensus Simulator (`simulator/`):
  - Created standalone in-memory discrete event simulator with deterministic random seeds.
  - Implemented 5 consensus models: Proof of Work (`pow`), Proof of Stake (`pos`), Practical Byzantine Fault Tolerance (`pbft`), Proof of Authority (`poa`), and Proof of Elapsed Time (`poet`).
  - Added configurable parameters (nodes count, faulty count, workload blocks, latency, random seed, mining difficulty, authority counts).
  - Modeled byzantine fault injection and verified PBFT quorum failure when $f > (N-1)//3$.
  - Calculated comparative metrics: block latency, throughput, message complexity ($O(N^2)$ for PBFT), and energy footprints.
  - Strictly isolated from Ganache chain (cannot and does not alter Ganache consensus or state).
  - Implemented FastAPI endpoints (`GET /api/v1/consensus/models`, `POST /api/v1/consensus/simulate`, `POST /api/v1/consensus/compare`).
  - Simulator test suite (`simulator/tests/`): 11 passing tests.
- Module B — ML ETA & Late Delivery Prediction (`ml/`):
  - Created synthetic freight dataset generator producing 1,200 records with controlled noise per `DATASET_PLAN.md` §5.
  - Implemented anti-leakage feature engineering pipeline with one-hot encoding and robust continuous scaling.
  - Trained and evaluated candidate models: Random Forest Regressor achieves $2.14\text{h}$ MAE (vs $11.62\text{h}$ baseline); Random Forest Classifier achieves $91.3\%$ accuracy and $0.962$ ROC-AUC.
  - Serialized model artifacts to `ml/artifacts/` with JSON metadata schema.
  - Implemented decision-support inference engine with 90% confidence intervals and explanatory factor importances.
  - Implemented authenticated FastAPI endpoints (`GET /api/v1/ml/model-info`, `POST /api/v1/ml/predict-eta`).
  - ML test suite (`ml/tests/`): 7 passing tests.
- Backend API Integration (`backend/`):
  - Mounted consensus and ml routers under `/api/v1/`.
  - Added test suites `test_consensus_api.py` and `test_ml_api.py`.
  - Backend test suite: 46 passing pytest tests (+8 new tests).
- Frontend UI & Integration (`frontend/`):
  - Created interactive Consensus Simulator Console (`/consensus`): protocol selection tabs, parameter sliders, discrete event timeline, and multi-protocol comparison matrix.
  - Created `MLEtaPredictionCard`: renders estimated remaining transit hours, arrival date, delay risk badge (Low/Moderate/High), top contributing factors, and explicit decision-support safeguard notice.
  - Embedded `MLEtaPredictionCard` into Shipment Details Overview tab (`/shipments/[id]`).
  - Added Consensus link to top navigation bar.
  - Frontend test suite (`frontend/tests/`): 27 passing tests (+3 new Phase 5 client tests).
  - Next.js production build: 14/14 static and dynamic routes compiled successfully with 0 errors.

## [1.6] — 2026-10-03

### P4 — Oracle Service and Exception Scenarios
- Implemented smart contracts:
  - `CargoChainTypes.sol`: Added `Dispute` struct, `DisputeReason` and `Resolution` enums, custom errors (`OutsideGeofence`, `DisputeAlreadyOpen`, `DisputeNotOpen`, `EscrowIsFrozen`, `DisputeNotAllowed`, `InvalidResolution`).
  - `ShipmentRegistry.sol`: Added `disputeManager` reference, `setDisputeManager`, entrypoints `setDisputed(id)` and `setResolved(id, newStatus)`.
  - `TrackingManager.sol`: Implemented `submitOracleUpdate(id, lat, lon, milestoneType, metadataURI)` with strict `Role.Oracle` role check, microdegree geofence distance check (`checkGeofence`), and `OracleUpdateRecorded` event; permitted Oracle in `markDelayed(id)`.
  - `EscrowManager.sol`: Implemented escrow freeze/unfreeze mechanisms (`freeze`, `unfreeze`, `isFrozen`), resolution payout execution (`resolveDisputePayout`), capped late-delivery penalty calculation (2% per day late, capped at 30% max penalty) with shipper refund, and admin configurable rules via `setRules` emitting `RuleChanged`.
  - `DisputeManager.sol`: Created standalone dispute arbiter contract enforcing role authorization (Shipper/Receiver can raise dispute on active shipments), state transitions to `Disputed`, automatic escrow freeze, and Admin dispute resolution with three payout pathways (`ReleaseToTransporter`, `RefundToShipper`, `Split` with basis points).
  - Deployed all 6 contracts via `deploy.js`, exported ABIs and deployments to `deployments/local.json`, `frontend/src/contracts/`.
  - Hardhat contract test suite: 103 passing tests (+19 new tests for OracleTracking and DisputeEscrow).
- Implemented Oracle Service & Exception Scenarios (`oracle/`):
  - `oracle/service.py`: Restricted `OracleService` with dedicated key (`0x5de4...`), geofence calculation, and deterministic scenario runners (`normal`, `delayed`, `deviated`).
  - Strict distinction maintained: Oracle transactions are recorded as external claims with submitter provenance, not independent on-chain physical facts.
  - Oracle unit tests (`oracle/tests/test_oracle_scenarios.py`): 7 passing tests covering scenario generation, geofence math, and key derivation.
- Backend API & Event Indexer (`backend/`):
  - Added SQLAlchemy models `Dispute`, `OracleEvent`, and `OracleScenario` in `entities.py`.
  - Created and applied Alembic migration `0002_oracle_and_disputes.py` adding `disputes`, `oracle_events`, and `oracle_scenarios` tables to PostgreSQL.
  - Updated `EventIndexer` to track `DisputeManager` logs, process `OracleUpdateRecorded`, `DisputeRaised`, and `DisputeResolved` events, and record milestones with `source="oracle"`.
  - Created routers `backend/app/routers/disputes.py` (`GET /disputes`, `GET /disputes/{id}`) and `backend/app/routers/oracle.py` (`GET /oracle/status`, `POST /oracle/scenarios`, `POST /oracle/scenarios/{id}/stop`, `GET /oracle/events`).
  - Added Pydantic schemas in `schemas.py` and `isFrozen` status in `GET /shipments/{id}/escrow`.
  - Backend test suite: 38 passing pytest tests (+6 new tests for Oracle and Dispute endpoints and indexing).
- Frontend MVP Enhancements (`frontend/`):
  - Created Oracle Management & Simulation Console (`/oracle`): Service status, scenario launcher, events feed, and trust boundary disclaimer banner.
  - Created Dispute Management & Arbitration Console (`/disputes`): Filterable dispute queue, escrow freeze indicators, and Admin on-chain resolution modal supporting release, refund, and split payout with basis-point slider.
  - Updated Shipment Details Console (`/shipments/[id]`): Active dispute banner, "Raise Dispute" action for assigned Shipper/Receiver, distinct "Oracle Reported (External Claim)" badge with trust boundary notice in Timeline, and Escrow frozen callout.
  - Updated navigation bar with links to `/disputes` and `/oracle`.
  - Frontend test suite (`frontend/tests/`): 24 passing unit/E2E tests (+4 new tests covering DisputeManager and Oracle ABI encoding).
  - Next.js production build (`npm run build`): Completed successfully with 0 errors across 13 routes.

## [1.5] — 2026-10-03

### P3 — Frontend MVP
- Implemented responsive, accessible Next.js 14 App Router frontend matching `UI_UX_SPEC.md` and `DEMO_SCRIPT.md`.
- Wallet connection and EIP-191 personal_sign challenge flow via `WalletContext.tsx`, validating Ganache network (Chain ID 1337) with automatic network-switch prompt.
- Sticky navigation bar with live network status indicator, role badges, and role-scoped navigation links.
- Implemented interactive `TxModal` visualizing transaction states: `awaiting_signature`, `broadcasting` (with tx hash), `syncing` (reconciling PostgreSQL read model), `success`, and `error` (parsed revert reason).
- Role-specific dashboard (`/dashboard`): displays active participant identity, quick actions, operational KPI summary cards, and role-permitted recent shipments table.
- Searchable and status-filtered shipments directory (`/shipments`) with pagination and access control boundaries.
- Shipment creation wizard (`/shipments/new`): Shipper/Admin form validating stakeholder EVM addresses, delivery terms, and test-ETH escrow amount; executes `ShipmentRegistry.createShipment` via MetaMask.
- Multi-tab shipment console (`/shipments/[id]`):
  - Overview: Cargo specifications, status lifecycle step bar, and participant roster.
  - Timeline: Chronological milestone tracker with Manual vs Oracle reported provenance badges.
  - Custody: Historical chain of physical custody transfers with custodian addresses and block timestamps.
  - Documents: Anchored documents table with SHA-256 fingerprint, IPFS CID, and proxy download; file upload to IPFS + MetaMask on-chain anchoring; real-time file integrity verifier detecting authentic vs tampered files.
  - Escrow: Clear test-ETH disclaimer banner, funded status, and user-signed actions (`deposit`, `releasePayment`, `refund`).
  - Contextual action bar: Transporter accept/reject/dispatch, warehouse arrival, delivery confirmation, and custody transfers.
- Admin participant management (`/participants`): On-chain registration and revocation via MetaMask, plus off-chain profile metadata editor.
- System audit trail (`/audit`): Chronological indexed event browser with payload inspection, manual event sync, and full read-model reindex trigger.
- Operational analytics dashboard (`/analytics`): Aggregate performance metrics and shipment status distribution.
- Frontend test suite (`frontend/tests/`): 20 passing unit and E2E validation tests covering contract configurations, API exception handling, and `DEMO_SCRIPT` Acts 1–4 transaction encoding.
- Verification: Next.js production build (`npm run build`) succeeded with 0 errors across 11 static and dynamic routes.

## [1.4] — 2026-10-02

### P2 — Backend, indexer and IPFS
- Implemented SQLAlchemy 2 models in `backend/app/models/` (`User`, `AuthNonce`, `Shipment`, `Milestone`, `CustodyEvent`, `Document`, `EscrowEvent`, `ChainEvent`, `IndexerState`).
- Created initial Alembic migration `0001_init.py` covering all database tables, constraints, foreign keys, and indexes per `docs/DATABASE.md`.
- Implemented wallet authentication (`FR-AUTH-01..02`) in `backend/app/services/auth.py` and `backend/app/routers/auth.py`: single-use expiring nonce issuance, EIP-191 personal_sign signature recovery, atomic nonce consumption, active participant verification, and JWT issuance.
- Implemented IPFS service (`FR-DOC-01..03`) in `backend/app/services/ipfs.py` and `backend/app/routers/documents.py`: file upload to IPFS daemon, local persistent cache fallback, SHA-256 computation, file integrity verification against anchored hashes, and authorized proxy download.
- Implemented blockchain event indexer (`FR-IDX-01..02`) in `backend/app/services/indexer.py`: idempotent log processing using `(tx_hash, log_index)` uniqueness, chronological event replay, projection updates across all 5 contracts, reindex wiping chain-derived tables while preserving off-chain profiles, and admin audit trail (`/api/v1/audit`).
- Implemented API endpoints (`API_SPEC.md`): `/health` (multi-component), `/auth/nonce`, `/auth/login`, `/me`, `/participants`, `/participants/{address}/profile`, `/shipments` (with role visibility, status, search, and pagination), `/shipments/{id}` sub-resources (milestones, custody, documents, escrow), `/documents/upload`, `/documents/verify`, `/documents/{cid}`, `/analytics/summary`, `/audit`, `/admin/reindex`, `/admin/sync`.
- Created comprehensive test suite (initially 27, expanded to 32 pytest tests) covering auth, shipments API, IPFS upload/verification, indexer idempotency and reindex, participants admin, and analytics. All 32 tests passing.
- P2 Review Gate fixes:
  - Fixed Alembic connection URL scheme (`postgresql+psycopg2://`) to avoid psycopg v3 fallback error on PostgreSQL 16.
  - Added `python-multipart` to requirements to fix form data ingestion.
  - Resolved missing `w3` import in `auth.py` on-chain participant fallback.
  - Fixed cross-shipment authorization bypass in `GET /documents/{cid}` by enforcing shipment involvement verification and rejecting unanchored CIDs for non-admin callers.
  - Added targeted edge-case tests: token rejection for subsequently revoked participants, expired JWT rejection, upload file size limits (413), unanchored CID rejection (404), and missing IPFS/cache content (404).

## [1.3] — 2026-10-02

### P1 — Contracts MVP
- Implemented `CargoChainTypes.sol` (canonical enums, structs, custom errors).
- Implemented `ParticipantRegistry.sol` (FR-ROL-01..03: admin registration, role enforcement, revocation, isActive).
- Implemented `ShipmentRegistry.sol` (FR-SHP-01..05: sequential IDs, unique externalRef, state machine enforcement, accept/reject, cancel).
- Implemented `TrackingManager.sol` (FR-TRK-01..03: startTransit, recordMilestone, confirmWarehouseArrival, custody transfers, delay handling, pagination).
- Implemented `DocumentRegistry.sol` (FR-DOC-02..03: SHA-256 and IPFS CID anchoring, document integrity verification, global hash uniqueness check, pagination).
- Implemented `EscrowManager.sol` (FR-ESC-01..04: exact deposit, eligibility trigger, pull-style once-only release, refund on cancel/reject, OpenZeppelin ReentrancyGuard).
- Created adversarial test contract `ReentrancyAttacker.sol` for negative security verification.
- Implemented comprehensive Hardhat test suite across 5 test suites (`ParticipantRegistry`, `ShipmentRegistry`, `TrackingManager`, `DocumentRegistry`, `EscrowManager`, and `Lifecycle` integration).
- Verification: 84 tests passing (0 failures, 2s run time) covering happy paths, access control, state machine violations, event emissions, and reentrancy attack protection.
- Created `contracts/scripts/deploy.js` deploying all 5 contracts, wiring managers, saving deployment block and addresses to `deployments/local.json`, and exporting clean ABIs to `contracts/abi/`.

## [1.2] — 2026-10-02

### P0 — Repository scaffold
- Created `.gitignore`, `.env.example` (no secrets), `docker-compose.yml` (PostgreSQL 16, Kubo IPFS).
- Scaffolded `contracts/` — Hardhat 2.29.1, Solidity 0.8.24, OpenZeppelin, Ganache network config.
- Scaffolded `backend/` — FastAPI app with health endpoint, Pydantic v2 settings, Alembic init, pytest config.
- Scaffolded `frontend/` — Next.js 14.2.29, App Router, TypeScript strict, Tailwind CSS, ESLint.
- Scaffolded `simulator/`, `oracle/`, `ml/` — independent Python packages with placeholder tests.
- Created `deployments/local.json` template and `contracts/scripts/deploy.js` placeholder.
- No business logic implemented — P0 scope only.
- Verification: Hardhat compile ✓, Next.js build ✓, pytest discovery ✓ (4 tests, 4 passed), Docker Compose config ✓, docs audit PASS.

## [1.1] — 2026-10-02

### Documentation pack refinement
- Completed the referenced 20-file documentation set and aligned names across the document map.
- Clarified MVP cut-line at P3 and made advanced oracle, consensus, dispute, attack, analytics and ML work conditional.
- Clarified that Hardhat tests cover contracts, while API/IPFS/UI/simulator/ML behavior belongs to its own test layer.
- Added explicit Oracle trust boundary and provenance language.
- Labeled escrow as Ganache test-ETH simulation, not real freight payment.
- Added course-alignment note: logistics is an applied domain beyond the named U7 examples; PoS/PoET are documented and optional to simulate.
- Added consistency audit checklist and a lightweight audit script.

## [1.0] — Initial specification baseline

- Initial CargoChain project concept, architecture and implementation roadmap.
