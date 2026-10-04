# WORKFLOW

## 1. Prerequisites

Git, Node.js compatible with Next.js 14 and Hardhat, Python 3.11, Docker Desktop/Engine, MetaMask and Ganache. Confirm exact installed versions before debugging. Use a dedicated local demo wallet only.

## 2. Environment

Create `.env` from `.env.example`; never commit `.env`. Configure local RPC, chain ID 1337, database URL, local IPFS endpoint, JWT secret and Oracle key using local test credentials. Ensure no secret is embedded in frontend variables.

## 3. Local startup sequence

1. Start dependencies: `docker compose up -d`.
2. Start Ganache at `127.0.0.1:8545`, chain ID `1337`, or use the approved Hardhat-node fallback.
3. Install contract dependencies and compile: `cd contracts && npm install && npx hardhat compile`.
4. Deploy contracts using the documented Ganache network script; save addresses and deployment block in `deployments/local.json`.
5. Run backend migrations and deterministic seed using the project scripts.
6. Start FastAPI on port 8000.
7. Start Oracle only for advanced P4 scenarios.
8. Start Next.js on port 3000.
9. Connect MetaMask to the local network and import only a local test account if required.

Exact commands must be finalized to match actual scripts and package managers present in the repository. Do not claim a one-command startup until it has been tested from a clean clone.

## 4. Verification commands

Run the commands appropriate to the current phase, such as:
- Contracts: `npx hardhat compile`, `npx hardhat test`, coverage and gas report.
- Backend: `pytest -q`, migration check and API smoke tests.
- Frontend: package-defined lint, typecheck, build and browser/E2E suite.
- Infrastructure: `docker compose config` and health checks.
- Documentation: `python scripts/audit_docs.py`.

Record actual output, version information and any skipped checks in `EVALUATION_PLAN.md`.

## 5. Reset and reindex

A local-chain reset changes deployment addresses and chain history. Stop indexer, reset/redeploy, refresh `deployments/local.json`, migrate/seed as documented and rebuild chain-derived tables. Never mix logs from different local-chain deployments.

## 6. Demo readiness

Use `DEMO_SCRIPT.md` on a clean local environment. Confirm wallet network, test accounts, seeded shipment IDs, IPFS health, API health and browser access before presentation. Keep a fallback screenshot/recording only as clearly labeled backup evidence, not as proof of a live run.
