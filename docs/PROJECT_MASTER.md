# PROJECT_MASTER — CargoChain

> **Specification authority:** This file defines the project boundary and canonical vocabulary. If another project document conflicts with it, stop, report the conflict and propose a documented correction. Do not silently choose.

| Field | Definition |
|---|---|
| Project | CargoChain — Smart Contract-Based Logistics and Freight Management |
| Owner | Rudransh |
| Course | Blockchain Technology, course code `702IT0E016` |
| Type | Full-stack dApp proof of concept with an independent consensus simulator |
| Network | Local Ganache, chain ID `1337`; Hardhat node is an approved local fallback |
| Primary purpose | Demonstrate blockchain, smart contracts, access control, traceability and application development |
| Documentation version | 1.1 |

## 1. Problem statement

Logistics workflows can involve several organizations maintaining separate records for shipment status, custody, documents and payment. Discrepancies between those records can create reconciliation delays and disputes. CargoChain explores a shared, append-only transaction history with role-controlled state transitions.

## 2. Proposed solution

CargoChain records shipment creation, lifecycle transitions, custody transfers, milestones, document fingerprints and conditional test-ETH escrow on Ethereum-compatible smart contracts. Participants use a web interface and sign blockchain writes with MetaMask. A FastAPI backend reads and indexes events, serves permitted data and handles document upload to local IPFS. A simulated oracle can submit external route/status reports. An independent Python simulator illustrates consensus models.

## 3. Objectives

| ID | Objective |
|---|---|
| O1 | Represent shipment lifecycle as an explicit on-chain state machine |
| O2 | Enforce role-based permissions on state-changing operations |
| O3 | Make documents tamper-evident through SHA-256 and IPFS content identifiers |
| O4 | Demonstrate conditional payment using local test-ETH escrow |
| O5 | Demonstrate oracle integration and its trust boundary |
| O6 | Compare selected consensus approaches in a reproducible educational simulator |
| O7 | Demonstrate security controls and controlled attack scenarios |
| O8 | Provide operational analytics; ML delay prediction is optional |

## 4. Scope and release boundary

**MVP (P0–P3):** project scaffold; participant registry; shipment creation, acceptance/rejection, cancellation, dispatch, manual milestones, custody and delivery; document upload/hash anchoring/verification; test-ETH escrow; event indexer and rebuildable PostgreSQL read model; wallet-signature authentication; core role-aware dashboard; baseline analytics summary; tests and demo.

**Advanced (P4–P8):** oracle scenarios and geofence checks; disputes, penalties and configurable escrow rules; independent PoW/PoA/PBFT-lite simulator; attack demonstrations; extended analytics and route map; optional ML; final report and viva materials.

**Out of scope:** real-money settlement, public-chain deployment, production custody of private keys, real GPS hardware, legally binding customs integrations, mobile application and production service-level guarantees.

## 5. Participants and roles

Canonical Solidity enum order: `None, Admin, Shipper, Transporter, Warehouse, Inspector, Receiver, Oracle`.

| Role | Responsibilities |
|---|---|
| `Admin` | Register/revoke participants, configure approved rules and resolve disputes |
| `Shipper` | Create shipments, upload/anchor documents, fund escrow and define shipment terms |
| `Transporter` | Accept/reject assigned shipments, dispatch, record milestones and transfer custody |
| `Warehouse` | Confirm warehouse arrival and custody/storage events |
| `Inspector` | Verify documents and record inspection/clearance |
| `Receiver` | Confirm delivery, accept goods or raise a dispute |
| `Oracle` | Restricted service account for simulated external status/location reports |

A role is not proof of a real-world identity or legal authority. Admin registration is an application-level trust decision.

## 6. Canonical shipment statuses

`Created, Accepted, InTransit, Delayed, Arrived, Delivered, Completed, Rejected, Disputed, Cancelled`.

Terminal statuses are `Completed`, `Rejected` and `Cancelled`. `Disputed` is a controlled exception state that may resolve to `Completed` or `Cancelled`. The complete transition matrix is in `ARCHITECTURE.md`.

## 7. Modules

| ID | Module | Responsibility |
|---|---|---|
| M1 | Shipment Management | Shipment creation, assignment, lifecycle and custody |
| M2 | Tracking | Milestones, timeline and optional oracle updates |
| M3 | Digital Documentation | IPFS storage, hash anchoring, verification and clearance |
| M4 | Escrow | Test-ETH deposit, eligibility, release/refund and optional penalties |
| M5 | Disputes and Security | Dispute workflow, access control and security lab |
| M6 | Consensus Simulator | Independent educational consensus models and comparisons |
| M7 | Analytics | Summary KPIs and optional extended analysis |
| Platform | Identity and Audit | Wallet authentication, participant roles, event indexing and reindexing |

## 8. Pinned technology stack

| Layer | Technology |
|---|---|
| Contracts | Solidity `0.8.24`, OpenZeppelin `ReentrancyGuard`, Hardhat; Remix for manual demonstration |
| Chain | Ganache local RPC `http://127.0.0.1:8545`, chain ID `1337` |
| Backend | Python `3.11`, FastAPI, Web3.py, Pydantic v2, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 16 |
| Frontend | Next.js 14 App Router, React, TypeScript strict, Tailwind CSS, ethers v6 |
| Visualizations | Recharts; Leaflet only for advanced route view |
| Wallet | MetaMask |
| Storage | Local Kubo IPFS, SHA-256 |
| Simulator / Oracle / ML | Python packages; Pandas and scikit-learn; XGBoost or another booster only with approval |
| Orchestration | Docker Compose for PostgreSQL and IPFS; local scripts for app processes |

Do not introduce a replacement framework, cloud service, public RPC or paid API without approval.

## 9. Canonical vocabulary and representations

- `shipmentId`: `uint256`, generated by `ShipmentRegistry`, starts at 1.
- `externalRef`: unique `bytes32` business reference; duplicate creation reverts.
- Currency: on-chain `uint256` wei. UI may display equivalent test ETH. No fiat valuation is implied.
- Coordinates: signed `int32` microdegrees (degrees × 1,000,000).
- Percentages: basis points (`bps`), where 10,000 bps = 100%.
- Document fingerprint: `bytes32` SHA-256 of raw file bytes; CID is an IPFS content identifier.
- Chain of record: blockchain events/state. PostgreSQL is a rebuildable read index.
- “Verified” means a defined contract or hash check passed; it does not mean the physical shipment or source document is truthful.

## 10. Course alignment

The supplied course outline for `702IT0E016` covers: U1 Introduction to Blockchain; U2 Blockchain Architecture and consensus (PoW, PoS, BFT, PoA, PoET); U3 smart contracts, confidentiality and oracles; U4 Ethereum and Solidity; U5 privacy/security, Sybil/selfish-mining/51% attacks, Algorand and sharding; U6 application development, upgrades, IPFS and BigchainDB; U7 use cases including finance, education, health and government.

CargoChain directly demonstrates U2–U6 through architecture, contracts, security and IPFS. Logistics is an applied project domain and should be described as an additional use case rather than a syllabus-listed example. Explain PoS and PoET accurately in documentation; implementation of their simulators is optional unless specifically required by the instructor. The course outline specifies 8–10 programming exercises and a practicum; map the practical work to those expectations in the final submission.

## 11. Repository layout

```text
cargochain/
├── docs/                 # this 20-file specification pack
├── contracts/            # Hardhat; Solidity sources in src/, tests in test/
├── backend/              # FastAPI, indexer, models and Alembic
├── frontend/             # Next.js application
├── simulator/             # independent consensus simulator
├── oracle/                # simulated logistics oracle
├── ml/                    # optional delay prediction
├── scripts/               # dev, seed, audit and helper scripts
├── deployments/            # local.json and generated ABI references
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## 12. Success criteria

1. MVP runs from a clean local checkout using `WORKFLOW.md`.
2. Every accepted requirement maps to implementation and a test in `TRACEABILITY_REPORT.md`.
3. Contract coverage and gas results are measured and reported; targets are in `EVALUATION_PLAN.md`.
4. Simulator comparisons use a common workload and seed and report model assumptions.
5. Documentation audit passes, or remaining exceptions are listed with owners and rationale.
6. Demo steps are reproducible and the student can explain design decisions and limitations.
