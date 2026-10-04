# CargoChain — Start Here

CargoChain is an academic, local-only blockchain proof of concept for logistics and freight management. This documentation pack is the project specification for the student and AI coding agents. It distinguishes required MVP work from advanced extensions and records how each feature must be tested.

## Read in this order

1. `PROJECT_MASTER.md` — purpose, boundaries, canonical vocabulary and pinned stack.
2. `AGENT_RULES.md` — operating rules for any coding agent.
3. `REQUIREMENTS.md` — functional and non-functional acceptance criteria.
4. `ARCHITECTURE.md` — contracts, lifecycle, trust boundaries and data flow.
5. `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md` — cross-layer interfaces.
6. `SECURITY_THREAT_MODEL.md`, `DATASET_PLAN.md`, `EVALUATION_PLAN.md` — security, reproducibility and evidence.
7. `DEVELOPMENT_PLAN.md`, `WORKFLOW.md`, `DECISIONS.md` — build sequence and decisions.
8. `TRACEABILITY_REPORT.md`, `CONSISTENCY_AUDIT.md`, `CHANGELOG.md` — project control.
9. `DEMO_SCRIPT.md`, `VIVA_SLIDES.md`, `MASTER_PROMPT.md` — demonstration and agent instructions.

## Initial setup

1. Create a Git repository named `cargochain`.
2. Copy this `docs/` folder and `scripts/audit_docs.py` into the repository.
3. Review the full documentation pack and confirm the MVP cut-line in `DEVELOPMENT_PLAN.md`.
4. Open the repository as the Antigravity workspace.
5. Configure the workspace agent rule: “Read `docs/PROJECT_MASTER.md` and `docs/AGENT_RULES.md` before changing files.”
6. Paste the kickoff prompt from `MASTER_PROMPT.md`. The agent must report its understanding and wait for approval before coding.
7. Implement one phase at a time. Review the plan, tests, requirement mapping and change log before accepting each phase.

## MVP boundary

The MVP ends at P3: role registry, shipment lifecycle, manual milestones/custody, document hash anchoring and verification, simulated escrow, event indexing, API and core UI. Oracle automation, consensus simulation, disputes, security attack demonstrations, analytics extensions and ML are advanced work. Do not start advanced work while the MVP acceptance gate is failing.

## Important limitations

- Ganache uses local test accounts and test ETH only. This is not a real freight-payment system.
- Oracle updates are reports from a trusted off-chain service, not cryptographic proof that GPS or external events are true.
- IPFS content addressing helps detect content changes; it does not guarantee file availability or confidentiality.
- The consensus simulator is an educational model and does not change Ganache's consensus protocol.
- Logistics is CargoChain's applied domain. The supplied course syllabus names finance, education, health and government as use-case examples; present logistics as an additional application, not as a verbatim listed syllabus example.

## First task

Start with P0 in `DEVELOPMENT_PLAN.md`. The agent must inspect the repository, report missing prerequisites or specification conflicts, and present a plan before writing implementation code.
