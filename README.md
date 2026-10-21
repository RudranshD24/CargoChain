# CargoChain — Smart Contract-Based Logistics and Freight Management

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-120%20Tests%20Passing-yellow?logo=ethereum)](https://hardhat.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![IPFS](https://img.shields.io/badge/IPFS-Kubo%20v0.43+-65C2CB?logo=ipfs)](https://ipfs.tech/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Academic Project**  
> **Course:** Blockchain Technology (`702IT0E016`)  
> **Author / Owner:** Rudransh (`RudranshD24`)  
> **Repository:** [https://github.com/RudranshD24/CargoChain](https://github.com/RudranshD24/CargoChain)  
> **Network:** Ganache Local RPC (`http://127.0.0.1:8545`, Chain ID: `1337`)  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Solution Architecture](#2-problem-statement--solution-architecture)
3. [Key Modules & Technical Capabilities](#3-key-modules--technical-capabilities)
4. [System Architecture Diagram](#4-system-architecture-diagram)
5. [Smart Contract Suite & State Machine](#5-smart-contract-suite--state-machine)
6. [Technology Stack](#6-technology-stack)
7. [Repository Structure](#7-repository-structure)
8. [Setup & Installation Runbook](#8-setup--installation-runbook)
9. [End-to-End Walkthrough & Demonstration](#9-end-to-end-walkthrough--demonstration)
10. [Security Model & Attack Hardening](#10-security-model--attack-hardening)
11. [Consensus Simulator & ML Delay Prediction](#11-consensus-simulator--ml-delay-prediction)
12. [Testing & Verification](#12-testing--verification)
13. [Academic & Viva Presentation Guide](#13-academic--viva-presentation-guide)
14. [License](#14-license)

---

## 1. Executive Summary

**CargoChain** is an end-to-end decentralized logistics and freight management ecosystem. Built on Ethereum-compatible smart contracts, a high-performance Python FastAPI backend, PostgreSQL off-chain projection indexer, IPFS decentralized storage, and a modern Next.js 14 Web3 frontend, CargoChain eliminates trust barriers in global supply chain logistics.

The platform provides:
- **Trustless Multi-Party State Machine**: Enforces strict shipment lifecycle transitions across Shipper, Transporter, Warehouse, Inspector, and Receiver.
- **Cryptographic Document Anchoring**: Tamper-evident Bill of Lading, Customs Clearance, and Inspection Certificate verification via SHA-256 and IPFS Content Identifiers (CIDs).
- **Automated Escrow & Dispute Settlement**: Conditional test-ETH escrow locking, dynamic late-delivery penalty deductions, and multi-party dispute arbitration.
- **IoT & Oracle Milestones**: Simulated GPS tracking, route deviation alerts, and destination geofencing validation.
- **Consensus & ML Research Modules**: Standalone comparative consensus simulator (PoW vs. PoA vs. PBFT) and machine learning models for ETA and delay forecasting.

---

## 2. Problem Statement & Solution Architecture

### Traditional Supply Chain Challenges
- **Information Silos & Discrepancies**: Shippers, carriers, customs authorities, and buyers keep separate relational databases, causing costly reconciliation delays.
- **Documentation Fraud**: Paper or unsecured PDF bills of lading and quality certificates can be forged or backdated.
- **Payment & Cash-Flow Delays**: Freight payments often take 30–90 days to settle due to manual paperwork verification and freight charge audits.
- **Disputed Custody & Blame Shifting**: When cargo arrives damaged, delayed, or spoiled, parties dispute who held physical custody at the time of damage.

### The CargoChain Solution
```
+---------------------------------------------------------------------------------------+
|                                    CARGOCHAIN dApp                                    |
+---------------------------------------------------------------------------------------+
|  1. Immutable Multi-Party Ledger: Single source of truth across all participants.       |
|  2. Strict Role-Based Access Control (RBAC): Every write is authorized on-chain.      |
|  3. Real-Time Physical Custody Handover: Timestamped custody logs on Ethereum.        |
|  4. Cryptographic Proof of Integrity: SHA-256 + IPFS CIDs guarantee document validity.|
|  5. Conditional Smart Contract Escrow: Automated delivery-triggered payment releases.  |
|  6. Oracle Verification Boundary: Cryptographically enforced geofence checkpoints.   |
+---------------------------------------------------------------------------------------+
```

---

## 3. Key Modules & Technical Capabilities

| Module | Core Responsibility | Technologies |
|---|---|---|
| **M1: Shipment Management** | Creation, acceptance, cancellation, and delivery lifecycle enforcement. | Solidity 0.8.24, Hardhat |
| **M2: Tracking & Custody** | Physical handover transfers, chronological milestone logging, and IoT updates. | Solidity, Web3.py, Leaflet |
| **M3: Digital Documentation** | IPFS document upload, SHA-256 hash anchoring, and tamper detection sandbox. | IPFS Kubo, Web3, Python hashlib |
| **M4: Escrow & Settlement** | Conditional test-ETH deposit, release, refund, and capped late-delivery penalties. | Solidity (`ReentrancyGuard`) |
| **M5: Dispute Resolution** | Raising formal disputes, frozen escrow locks, and Admin evidence arbitration. | Solidity, PostgreSQL, FastAPI |
| **M6: Consensus Simulator** | Empirical benchmarking of PoW, PoA, and PBFT-lite under network stress. | Python, NumPy, Matplotlib |
| **M7: Analytics & ML** | Fleet analytics, corridor performance, and Random Forest ETA delay prediction. | Scikit-learn, Recharts |
| **Platform: RBAC & Auth** | EIP-191 wallet signature challenge-response, JWT tokens, and real-time event indexing. | Web3.py, SQLAlchemy, Alembic |

---

## 4. System Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer (Web3)"]
        UI["Next.js 14 Frontend\n(TypeScript + Tailwind + ethers.js)"]
        MM["MetaMask Wallet\n(EIP-191 personal_sign)"]
    end

    subgraph ServiceLayer ["Application & Indexing Layer"]
        API["FastAPI Backend (Port 8000)\n(Auth, REST, IPFS Proxy, Analytics)"]
        IDX["Blockchain Event Indexer\n(Background Sync & Reindex)"]
        DB[("PostgreSQL 16 Database\n(Chain Events & Read Projection)")]
        ORC["Oracle Daemon (Port 8100)\n(Simulated IoT GPS & Geofence)"]
        ML["ML Model Service\n(ETA & Delay Prediction)"]
    end

    subgraph DecentralizedLayer ["Decentralized Infrastructure Layer"]
        GANACHE["Ganache Ethereum Node (Port 8545)\n(Chain ID: 1337)"]
        subgraph SmartContracts ["Smart Contracts Suite"]
            PR["ParticipantRegistry"]
            SR["ShipmentRegistry"]
            TM["TrackingManager"]
            DR["DocumentRegistry"]
            EM["EscrowManager"]
            DM["DisputeManager"]
        end
        IPFS["IPFS Kubo Node (Ports 5001 / 8080)\n(Decentralized Storage)"]
    end

    UI <-->|Web3 RPC / Transactions| GANACHE
    UI <-->|Sign Message| MM
    UI <-->|REST API / JWT| API
    API <-->|SQLAlchemy ORM| DB
    API <-->|Add / Pin Files| IPFS
    IDX <-->|RPC Logs / Events| GANACHE
    IDX <-->|Write Projections| DB
    ORC <-->|Submit Milestones| GANACHE
    GANACHE --- SmartContracts
```

---

## 5. Smart Contract Suite & State Machine

CargoChain implements modular smart contracts compiled under **Solidity `0.8.24`** with EVM target **`paris`** (preventing `PUSH0` opcode incompatibility with Ganache) and optimizer enabled (`runs: 200`).

### Contract Roles (`Role` Enum)
```solidity
enum Role {
    None,        // 0: Unregistered / outsider
    Admin,       // 1: Contract deployer, participant management, dispute arbiter
    Shipper,     // 2: Creates shipments, funds escrow, anchors documents
    Transporter, // 3: Accepts cargo, starts transit, transfers custody, claims payment
    Warehouse,   // 4: Confirms intermediate storage and storage milestones
    Inspector,   // 5: Verifies document integrity, issues inspection clearances
    Receiver,    // 6: Inspects delivery condition, completes shipment, or raises dispute
    Oracle       // 7: Restricted account for automated IoT/geofence reports
}
```

### Shipment Lifecycle Finite State Machine (FSM)
```
          [Created] 
             |
             +---> [Cancelled] (Shipper only, if not accepted)
             |
             v
         [Accepted]
             |
             +---> [Rejected] (Transporter refuses)
             |
             v
        [InTransit] <---------------+
             |                      | (Resume transit)
             +---> [Delayed] -------+
             |
             v
         [Arrived] (Destination Geofence verified)
             |
             v
        [Delivered]
             |
             +-----------------------+
             |                       |
             v                       v
        [Completed]             [Disputed]
      (Escrow Released)              |
                                     +---> [Completed] (Admin resolves to Transporter)
                                     |
                                     +---> [Cancelled] (Admin refunds Shipper)
```

### The 6 Core Smart Contracts
1. **`ParticipantRegistry.sol`** (`FR-ROL-01..03`):
   - Admin-governed registration and revocation of participant addresses.
   - Guard modifiers: `onlyAdmin`, `requireRole`, `requireActiveParticipant`.
2. **`ShipmentRegistry.sol`** (`FR-SHP-01..04`):
   - Owns the canonical shipment state machine.
   - Enforces unique `bytes32 externalRef` keys and immutable participant assignments.
3. **`TrackingManager.sol`** (`FR-TRK-01..03`):
   - Chronological milestone logging (dispatched, in transit, warehouse arrival, arrived).
   - Validates physical custody transfers: only current custodians can transfer custody.
4. **`DocumentRegistry.sol`** (`FR-DOC-01..03`):
   - Anchors document fingerprints (`bytes32 SHA-256` hash and IPFS CID string).
   - Tamper-detection function compares submitted document hash with anchored state.
5. **`EscrowManager.sol`** (`FR-ESC-01..07`):
   - Manages conditional test-ETH locking.
   - Protected against reentrancy via OpenZeppelin's `ReentrancyGuard`.
   - Calculates capped late-delivery penalties (up to configurable 30% max penalty).
6. **`DisputeManager.sol`** (`FR-DIS-01..04`):
   - Freezes escrow upon dispute filing by Receiver or Shipper.
   - Allows Admin arbitration with three verdicts: `ReleaseToTransporter`, `RefundToShipper`, or `SplitBasisPoints`.

---

## 6. Technology Stack

| Layer | Component | Version / Specification |
|---|---|---|
| **Blockchain** | Solidity | `0.8.24` (`evmVersion: "paris"`, 200 optimizer runs) |
| | Development Framework | Hardhat `2.22.x` |
| | Local Testnet | Ganache `v7.9.x` (`chainId: 1337`, Port: `8545`) |
| | Security Libraries | OpenZeppelin Contracts `v5.0` (`ReentrancyGuard`) |
| **Backend** | Language & Runtime | Python `3.11+` |
| | Web Framework | FastAPI `0.110+` (Uvicorn ASGI) |
| | Blockchain Client | Web3.py `v6.15+`, eth-account |
| | Database & ORM | PostgreSQL 16, SQLAlchemy 2.0, Alembic |
| | Storage Client | IPFS Kubo RPC API |
| **Frontend** | Framework | Next.js 14 (App Router, Server & Client Components) |
| | Language | TypeScript strict mode |
| | Styling & UI | Tailwind CSS, Lucide React icons |
| | Web3 Provider | Ethers.js `v6.11+` |
| **Analytics & ML** | Libraries | Scikit-learn, Pandas, NumPy, Recharts |
| **DevOps** | Containerization | Docker & Docker Compose (Postgres 16, Kubo IPFS) |

---

## 7. Repository Structure

```
CargoChain/
├── contracts/                        # Smart Contracts & Blockchain Suite
│   ├── src/                          # Solidity Source Files
│   │   ├── CargoChainTypes.sol       # Shared canonical enums, structs & custom errors
│   │   ├── ParticipantRegistry.sol   # Role-based participant registry
│   │   ├── ShipmentRegistry.sol      # Shipment state machine & metadata
│   │   ├── TrackingManager.sol       # Milestones & custody handovers
│   │   ├── DocumentRegistry.sol      # Document hash anchoring & verification
│   │   ├── EscrowManager.sol         # Conditional test-ETH payment escrow
│   │   └── DisputeManager.sol        # Dispute filing & arbitration
│   ├── scripts/                      # Hardhat Deployment & Seeding
│   │   ├── deploy.js                 # Automated deployment & local.json export
│   │   └── seed_participants.js      # Idempotent Ganache accounts 0-6 registration
│   ├── test/                         # Comprehensive Hardhat Test Suite (120 Tests)
│   ├── hardhat.config.js             # Hardhat network & compiler configuration
│   └── package.json                  # Contract dependencies
│
├── backend/                          # FastAPI Backend & Event Indexer
│   ├── alembic/                      # Database Schema Migrations
│   ├── app/                          # Application Core
│   │   ├── config.py                 # Pydantic v2 Settings (.env loader)
│   │   ├── database.py               # PostgreSQL SQLAlchemy engine & sessions
│   │   ├── models/entities.py        # Relational models & projections
│   │   ├── schemas.py                # Pydantic request/response schemas
│   │   ├── routers/                  # API Routers
│   │   │   ├── auth.py               # Nonce generation & EIP-191 JWT auth
│   │   │   ├── shipments.py          # Shipment CRUD & queries
│   │   │   ├── documents.py          # Document IPFS upload & verification
│   │   │   ├── participants.py       # Participant queries
│   │   │   ├── admin.py              # Sync & reindex triggers
│   │   │   ├── disputes.py           # Dispute status & evidence
│   │   │   ├── oracle.py             # Oracle simulation endpoints
│   │   │   ├── analytics.py          # Summary metrics & route analysis
│   │   │   ├── consensus.py          # Consensus simulator endpoints
│   │   │   └── ml.py                 # ML delay prediction endpoint
│   │   └── services/                 # Core Business & Blockchain Services
│   │       ├── blockchain.py         # Web3 provider & contract instances
│   │       ├── auth.py               # Cryptographic signature recovery & JWT
│   │       ├── indexer.py            # EventIndexer block listener & projection builder
│   │       └── ipfs.py               # IPFS Kubo client with local disk fallback
│   ├── tests/                        # Pytest Test Suite (32+ Tests)
│   ├── requirements.txt              # Python dependencies
│   └── main.py                       # FastAPI application entry point
│
├── frontend/                         # Next.js 14 Web3 Frontend Application
│   ├── src/
│   │   ├── app/                      # App Router Pages
│   │   │   ├── page.tsx              # Landing Page & Connect Wallet
│   │   │   ├── dashboard/            # Role-Specific Dashboard
│   │   │   ├── shipments/            # Shipment Management & Creation
│   │   │   ├── documents/            # Document Registry & Verification Sandbox
│   │   │   ├── disputes/             # Dispute Arbitration Console
│   │   │   ├── oracle/               # Real-time IoT Oracle & Geofence Simulator
│   │   │   ├── analytics/            # Operational Analytics & KPIs
│   │   │   ├── consensus/            # Interactive Consensus Comparison Lab
│   │   │   ├── ml-predictions/       # ML ETA & Delay Prediction Tool
│   │   │   └── admin/                # Participant Registry Administration
│   │   ├── components/               # Reusable React Components & Layouts
│   │   ├── contracts/                # Synced ABIs & Deployed Contract Addresses
│   │   ├── hooks/                    # Custom Web3 & Auth Hooks
│   │   └── lib/                      # API Clients, Utilities & Formatters
│   ├── package.json                  # Next.js dependencies
│   └── tailwind.config.ts            # Styling configuration
│
├── oracle/                           # Independent Oracle Service
│   ├── service.py                    # Autonomous waypoint generator & milestone reporter
│   └── waypoints.json                # Synthetic transport corridor routes
│
├── consensus/                        # Standalone Educational Consensus Simulator
│   ├── simulator.py                  # Simulation engine (PoW, PoA, PBFT-lite)
│   └── models.py                     # Metric extractors (Throughput, Latency, Energy)
│
├── ml/                               # Machine Learning Prediction Module
│   ├── model.py                      # Random Forest model & training pipeline
│   ├── synthetic_data.py             # Synthetic logistics dataset generator
│   └── model.pkl                     # Pre-trained model weights
│
├── deployments/                      # Canonical Deployment Records
│   └── local.json                    # Deployed addresses & deployment block height
│
├── docs/                             # Complete 33-Document Specifications Pack
├── docker-compose.yml                # Docker compose for PostgreSQL 16 & IPFS Kubo
├── .env.example                      # Environment variables template
└── README.md                         # Project documentation
```

---

## 8. Setup & Installation Runbook

### Prerequisites
- **Node.js**: `v18.x` or `v20.x`
- **Python**: `3.11.x`
- **Docker Desktop**: Running on host system
- **Ganache**: Installed and running (Port `8545`, Chain ID `1337`)
- **IPFS Desktop** or Docker IPFS: Ports `5001` (API) and `8080` (Gateway)
- **MetaMask**: Browser extension configured for Ganache

---

### Step 1 · Clone Repository
```powershell
git clone https://github.com/RudranshD24/CargoChain.git
cd CargoChain
```

---

### Step 2 · Environment Configuration
Create root `.env` and `frontend/.env.local`:
```powershell
copy .env.example .env
```
Ensure `.env` contains:
```env
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=1337
POSTGRES_USER=cargochain
POSTGRES_PASSWORD=cargochain_dev
POSTGRES_DB=cargochain
DATABASE_URL=postgresql://cargochain:cargochain_dev@localhost:5432/cargochain
IPFS_API_URL=http://127.0.0.1:5001
IPFS_GATEWAY_URL=http://127.0.0.1:8080
API_HOST=0.0.0.0
API_PORT=8000
JWT_SECRET=your_generated_32_byte_secret_hex
ORACLE_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
DEPLOYMENT_FILE=deployments/local.json
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CHAIN_ID=1337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CHAIN_ID=1337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

---

### Step 3 · Start PostgreSQL Container
```powershell
docker compose up -d postgres
docker compose ps
```
> *Note:* Do not start the containerized IPFS service if your host IPFS Desktop is already using ports `5001` and `8080`.

---

### Step 4 · Deploy Smart Contracts & Sync ABIs
```powershell
# 1. Compile contracts with evmVersion: "paris"
cd contracts
npm install
npm run compile

# 2. Deploy to Ganache
npx hardhat run scripts/deploy.js --network ganache
cd ..

# 3. Synchronize ABIs to frontend and backend
python scripts/sync_abis.py
```

---

### Step 5 · Seed On-Chain Roles Idempotently
Register the 6 canonical roles into `ParticipantRegistry` using Admin Account 0:
```powershell
cd contracts
npx hardhat run scripts/seed_participants.js --network ganache
cd ..
```
*Output will display the registered accounts mapping:*
- **Account 0**: `Admin`
- **Account 1**: `Shipper`
- **Account 2**: `Transporter`
- **Account 3**: `Warehouse`
- **Account 4**: `Inspector`
- **Account 5**: `Receiver`
- **Account 6**: `Oracle`
- **Account 7**: `None` (Deliberate outsider for security attack demonstrations)

---

### Step 6 · Database Migrations & Event Indexing
```powershell
# Initialize Python virtual environment
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt

# Run Alembic migrations
cd backend
..\.venv\Scripts\alembic upgrade head
cd ..

# Trigger initial event reindexing
$env:PYTHONPATH=".;backend"
.\.venv\Scripts\python -c "from app.database import SessionLocal; from app.services.indexer import EventIndexer; indexer = EventIndexer(SessionLocal()); print(indexer.reindex_all())"
```

---

### Step 7 · Start CargoChain Services

Open 3 terminal windows:

#### Terminal 1 — Backend API (FastAPI)
```powershell
cd backend
..\.venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*Health Check:* Open `http://localhost:8000/api/v1/health`. You should see `database: ok`, `chain: ok`, and `ipfs: ok`.

#### Terminal 2 — Frontend Application (Next.js)
```powershell
cd frontend
npm install
npm run dev
```
*Application UI:* Open `http://localhost:3000`.

#### Terminal 3 — Oracle Service (Optional / For IoT Demo)
```powershell
$env:PYTHONPATH=".;backend;oracle"
.\.venv\Scripts\uvicorn oracle.service:app --host 127.0.0.1 --port 8100 --reload
```

---

## 9. End-to-End Walkthrough & Demonstration

To demonstrate the full lifecycle across all roles, import Ganache accounts 0–7 into MetaMask using their private keys:

```
+----+-------------+----------------------------------------------+--------------------+
| #  | Role        | Address                                      | Walkthrough Action |
+----+-------------+----------------------------------------------+--------------------+
| 0  | Admin       | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  | Inspect roles      |
| 1  | Shipper     | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8  | Create & Escrow    |
| 2  | Transporter | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  | Accept, Transit    |
| 3  | Warehouse   | 0x90F79bf6EB2c4f870365E785982E1f101E93b906  | Storage custody    |
| 4  | Inspector   | 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  | Document audit     |
| 5  | Receiver    | 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc  | Confirm delivery   |
| 6  | Oracle      | 0x976EA74026E726554dB657fA54763abd0C3a0aa9  | IoT GPS updates    |
| 7  | Outsider    | 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955  | Security rejection |
+----+-------------+----------------------------------------------+--------------------+
```

### The 9-Step Verification Path
1. **Admin Inspection**: Connect MetaMask Account 0. Sign in. Open `/admin` &rarr; View all registered accounts and active status.
2. **Shipment Creation**: Switch to Account 1 (`Shipper`). Navigate to `/shipments/new`.
   - Set Reference: `SHIP-DEL-MUM-001`, Cargo: `Cotton fabric, 500 units`, Delhi &rarr; Mumbai.
   - Assign Transporter (`0x3C44...`), Receiver (`0x9965...`), Inspector (`0x15d3...`).
   - Destination coordinates: `19.0760, 72.8777`, Payment: `0.5 ETH`, Expected Delivery: Future date.
   - Submit & confirm in MetaMask &rarr; Status becomes **`Created`**.
3. **Transporter Acceptance**: Switch to Account 2 (`Transporter`). Click **Accept Shipment** &rarr; Status becomes **`Accepted`**.
4. **Escrow Funding**: Switch to Account 1 (`Shipper`). Click **Deposit Escrow (0.5 ETH)** &rarr; Escrow status updates to **`Funded`**.
5. **Document Anchoring**: In the Documents tab, upload a PDF (e.g. Bill of Lading). The SHA-256 hash and IPFS CID are anchored on-chain.
6. **Integrity Verification**: Switch to Account 4 (`Inspector`). Verify original PDF &rarr; Returns **Match**. Test with modified PDF &rarr; Detects **Hash Mismatch**.
7. **Transit & Milestones**: Switch to Account 2 (`Transporter`). Click **Start Transit**, then submit milestone `Jaipur Checkpoint`.
8. **Delivery & Condition Check**: Switch to Account 5 (`Receiver`). Confirm cargo arrival as `Intact` and click **Accept Delivery** &rarr; Status transitions to **`Completed`**.
9. **Escrow Release**: Switch to Account 2 (`Transporter`). Click **Release Payment** &rarr; 0.5 ETH is transferred to Transporter balance. A second release attempt reverts.

---

## 10. Security Model & Attack Hardening

CargoChain features an isolated **Security Attack Demonstration Lab** in `contracts/test/SecurityAttacks.test.js` covering 5 major smart contract attack vectors:

### 1. Reentrancy Exploitation on Escrow Payouts
- **Vulnerability**: Malicious recipient smart contract calling back into `releasePayment()` or `refund()` before state balances are zeroed.
- **Defense**: Implementation of OpenZeppelin's `ReentrancyGuard` modifier (`nonReentrant`) and strict application of the **Checks-Effects-Interactions** pattern.

### 2. State Machine Invariant Violation Fuzzing
- **Vulnerability**: Bypassing steps in transit (e.g., jumping from `Created` directly to `Delivered`).
- **Defense**: Explicit state transition validation matrix in `ShipmentRegistry._isValidTransition()`. Any unauthorized transition reverts with custom error `InvalidStatusTransition()`. Terminal statuses (`Completed`, `Rejected`, `Cancelled`) strictly block mutations.

### 3. Privilege Escalation & Access Control
- **Vulnerability**: Non-admin calling administrative functions or unauthorized parties transferring physical custody.
- **Defense**: `onlyAdmin`, `requireRole`, and custody check modifiers (`if (msg.sender != s.currentCustodian) revert Unauthorized()`).

### 4. Escrow & Dispute Split Boundary Exploits
- **Vulnerability**: An attacker attempting to claim >100% of escrow during dispute arbitration (e.g., basis points > 10,000).
- **Defense**: Mathematical basis points boundary validation `if (splitTransporterBps > 10000) revert InvalidSplit()`.

### 5. Oracle Boundary Containment
- **Vulnerability**: Oracle account attempting to execute business logic (e.g., modifying shipment prices, releasing escrow).
- **Defense**: Oracle role is strictly restricted to milestone appending and coordinate reporting.

---

## 11. Consensus Simulator & ML Delay Prediction

### Consensus Simulator (`/consensus`)
To satisfy academic requirements for understanding distributed ledger consensus, CargoChain includes an independent simulator comparing:
- **Proof of Work (PoW)**: Simulates SHA-256 mining difficulty, hashrate competition, and energy expenditure.
- **Proof of Authority (PoA)**: Simulates round-robin block proposals among designated authority validators with near-zero latency.
- **PBFT-Lite (Practical Byzantine Fault Tolerance)**: Simulates 3-phase consensus (Pre-Prepare, Prepare, Commit) handling up to $f = \lfloor(n-1)/3\rfloor$ byzantine nodes.

Users can simulate network topologies, validator counts, and Byzantine node percentages to observe throughput (TPS), latency, and energy metrics.

### Machine Learning Delay Prediction (`/ml-predictions`)
A scikit-learn Random Forest model trained on synthetic historical freight records (weather severity index, traffic congestion, distance in km, vehicle type, and scheduled transit windows) outputs:
- **Predicted Delay Probability** ($0.0 - 1.0$)
- **Estimated Delay Duration** (in hours)
- **Top Risk Factors** (e.g., Monsoon weather warning, border crossing congestion)

---

## 12. Testing & Verification

CargoChain is backed by extensive automated test suites:

### Smart Contract Suite (Hardhat)
```powershell
cd contracts
npx hardhat test
```
```
  DisputeEscrow (FR-DIS-01..04, FR-ESC-05..07) ................... 22 passing
  DocumentRegistry (FR-DOC-01..03) ............................... 10 passing
  EscrowManager (FR-ESC-01..04) .................................. 14 passing
  CargoChain End-to-End Lifecycle ................................ 1 passing
  OracleTracking (FR-ORC-01..03) ................................. 7 passing
  ParticipantRegistry (FR-ROL-01..03) ............................ 17 passing
  Phase 6 Security Lab: Isolated Controlled Attack Demonstrations . 8 passing
  SeedParticipants Script Unit Test .............................. 2 passing
  ShipmentRegistry (FR-SHP-01..04) ............................... 16 passing
  TrackingManager (FR-TRK-01..03) ................................ 23 passing

  Total: 120 passing (2.4s)
```

### Backend API Suite (Pytest)
```powershell
cd backend
..\.venv\Scripts\pytest
```
*32 passed across authentication, event indexing, shipment CRUD, document verification, and role boundaries.*

---

## 13. Academic & Viva Presentation Guide

### Core Talking Points for Academic Evaluators
1. **Why not store the entire document on the blockchain?**
   - *Answer:* Storing large files on-chain is prohibitively expensive in gas and causes chain bloat. CargoChain uses **hybrid off-chain storage**: only the immutable SHA-256 cryptographic fingerprint and IPFS CID are anchored on-chain. The file is stored in content-addressed decentralized storage (IPFS).
2. **How does CargoChain address Oracle Trust issues?**
   - *Answer:* The Oracle is bounded by a strict trust boundary. The contract enforces destination geofencing equations mathematically on-chain (`checkGeofence`) so that an Oracle cannot mark a shipment as "Arrived" unless coordinates fall within the declared radius of the destination.
3. **What prevents double-spending in the Escrow contract?**
   - *Answer:* Escrow states (`Deposited`, `Eligible`, `Released`, `Refunded`) are mutually exclusive. State transitions use OpenZeppelin's `ReentrancyGuard`, and balances are cleared before external funds transfer (Checks-Effects-Interactions).

---

## 14. License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Developed for academic demonstration and research purposes under Course `702IT0E016`.
