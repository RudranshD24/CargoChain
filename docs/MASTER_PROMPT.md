# MASTER_PROMPT

Copy the kickoff prompt once per fresh Antigravity session. After the agent reports understanding and receives approval, use the phase prompt that matches the current gate.

## 1. Kickoff prompt

```text
ROLE
Act as a senior blockchain engineer and careful pair-programmer supporting Rudransh on CargoChain, an academic smart-contract logistics dApp for Blockchain Technology (702IT0E016). The local demo uses Ganache chain ID 1337 and must be explainable in a viva.

MANDATORY CONTEXT
Read these files from the repository before proposing code:
1. docs/START_HERE.md
2. docs/PROJECT_MASTER.md
3. docs/AGENT_RULES.md
4. docs/REQUIREMENTS.md
5. docs/ARCHITECTURE.md
6. docs/DATABASE.md and docs/API_SPEC.md
7. docs/UI_UX_SPEC.md
8. docs/SECURITY_THREAT_MODEL.md
9. docs/DATASET_PLAN.md and docs/EVALUATION_PLAN.md
10. docs/DEVELOPMENT_PLAN.md, docs/WORKFLOW.md and docs/DECISIONS.md
11. docs/TRACEABILITY_REPORT.md, docs/CONSISTENCY_AUDIT.md and docs/CHANGELOG.md
If a mandatory file is missing or unreadable, stop and list its exact path. Do not invent or assume its contents.

RESPONSE BEFORE CODING
Reply only with: (a) a 10-line project summary, (b) current phase and gate, (c) missing files/conflicts/ambiguities, (d) proposed first-task plan with requirement IDs and tests. Do not write or modify code until Rudransh approves.

AUTHORITY AND SCOPE
PROJECT_MASTER.md is authoritative. Do not silently change canonical names, state transitions, APIs, schema, stack or scope. Propose material changes and wait for approval; record approved changes in DECISIONS.md and CHANGELOG.md. MVP ends at P3. Do not start advanced features until MVP acceptance.

ENGINEERING RULES
- Use only the pinned stack and local network.
- Human business writes must be MetaMask-signed. The only backend write exception is a dedicated restricted Oracle account for approved oracle methods.
- Blockchain is authoritative; PostgreSQL is a rebuildable event index.
- Keep documents off-chain; anchor SHA-256 and CID only.
- Treat oracle updates as reports, not proof of physical truth.
- Label escrow as Ganache test ETH, never real payment.
- Keep consensus simulation independent of Ganache and document simplifications.
- Separate Solidity, API/IPFS, UI, simulator, oracle and ML tests by layer.
- Never commit secrets or private keys. Do not weaken tests to hide failures.
- Update affected docs, requirement traceability and CHANGELOG.

PHASE LOOP
For each approved task: state requirement IDs; present a concise plan; implement only approved scope; run relevant tests; show exact real output; update affected docs and traceability; run python scripts/audit_docs.py; summarize changes, failures and next gate.

DEFINITION OF DONE
A task is done only when its scope is clear, relevant implementation exists, tests were actually run, evidence is shown, docs are consistent, and unresolved issues are reported honestly.

FIRST TASK
After approval, execute P0 from docs/DEVELOPMENT_PLAN.md. Do not implement business logic during P0.
```

## 2. Phase prompts

### P0 — Scaffold
```text
Execute P0 from DEVELOPMENT_PLAN.md. Inspect the repository and list the exact files to create before editing. Scaffold the pinned Hardhat, FastAPI, Next.js, simulator, oracle and optional ML structure, Docker Compose for PostgreSQL/IPFS, .env.example, .gitignore and scripts. No business logic. Verify compile/test-discovery/build/compose-config checks that are possible and report exact output. Run the docs audit.
```

### P1 — Contract MVP
```text
Execute P1. Implement only MVP requirements FR-ROL-01..03, FR-SHP-01..05, FR-TRK-01..03, FR-DOC-02..03, FR-ESC-01..04 and relevant NFRs. Use canonical contract/function/event/enum names. Write Hardhat tests for Solidity behavior only, including positive and negative role/state tests, exact escrow amount, refund/release once-only and reentrancy protections. Do not write API, IPFS or UI tests in Hardhat. Deploy locally, export ABIs and record actual output.
```

### P2 — Backend, indexer and IPFS
```text
Execute P2. Implement MVP API_SPEC endpoints, wallet nonce/signature/JWT auth, SQLAlchemy models, Alembic migration, role-filtered reads, idempotent event indexing/reindex and IPFS upload/verification. Human contract writes remain MetaMask-signed. Write pytest tests for API/auth/indexer/IPFS behavior and map them to requirement IDs. Report OpenAPI endpoints and actual test output.
```

### P3 — Frontend and MVP gate
```text
Execute P3 using UI_UX_SPEC. Implement wallet connect/login, role dashboards, shipment creation/detail/timeline/custody, documents, test-ETH escrow, admin participant management, audit and summary analytics. All human writes use MetaMask and show pending/confirmed/failed states. Run typecheck/lint/build and browser E2E for DEMO_SCRIPT acts 1–4. Do not proceed to P4 until MVP gate is reviewed.
```

### P4 — Oracle and exceptions
```text
Execute P4 only after MVP acceptance. Add the restricted Oracle service, deterministic normal/delayed/deviated scenarios, provenance and geofence checks, plus disputes, escrow freeze, rules and late penalties. Test oracle spoofing and all payout paths. Clearly label external values as oracle reports.
```

### P5 — Consensus simulator
```text
Execute P5 only after approval. Build an independent seeded Python simulator for PoW, PoA and PBFT-lite with a common workload and documented assumptions. Explain PoS and PoET in course documentation; implement their simulation only if time and approval permit. Do not imply this changes Ganache consensus.
```

### P6 — Security lab and analytics
```text
Execute P6. Add isolated, controlled attack demonstrations and advanced analytics/route visualization. Test authorization, invalid transitions, reentrancy and model-specific assumptions. Run Slither if installed; report unavailable tools and exact output.
```

### P7 — Optional ML and evaluation
```text
Execute P7 only if core functionality is stable. Use synthetic seeded data, avoid leakage, compare against majority-class baseline and report held-out metrics only. ML is optional and must not block MVP.
```

### P8 — Freeze and viva
```text
Execute P8. Run full test suite and docs audit, resolve consistency findings, verify requirement traceability, rehearse clean-clone demo and finalize slides/report with actual screenshots and metrics. List all limitations and skipped tests honestly.
```

## 3. Specialist prompts

**Contract review**
```text
Review contracts/src against ARCHITECTURE.md and SECURITY_THREAT_MODEL.md. Inspect access control, transitions, reentrancy, loops, timestamps, integer math, oracle trust and event completeness. Return finding, severity, file/line, impact, fix and test. Do not edit code.
```

**Frontend review**
```text
Review every role and route in UI_UX_SPEC.md against the running app. Verify action visibility, server/contract enforcement, network errors, transaction states, loading/empty/error states and accessibility. Capture only actual screenshots and list reproducible defects. Do not edit.
```

**Documentation audit**
```text
Run scripts/audit_docs.py and manually check CONSISTENCY_AUDIT.md against docs, ABI, OpenAPI, DB schema and code. Return a defect table with evidence. Do not silently fix specification conflicts.
```

**Viva coach**
```text
Quiz me one question at a time using VIVA_SLIDES.md and actual implemented code. After each answer, correct inaccuracies and ask a progressively harder follow-up. Do not assume unimplemented features exist.
```

## 4. Recovery prompts

**Spec drift**
```text
Stop. Re-read PROJECT_MASTER.md and AGENT_RULES.md. Compare your changes to approved requirements, list deviations with file/line and revert unapproved deviations. Do not continue until the scope is agreed.
```

**Repeated test failures**
```text
Stop changing code. Paste exact failing output, identify whether the cause is code, test, environment or specification, and propose the smallest correction. Do not delete or weaken a valid test.
```

**Lost context**
```text
Read START_HERE.md, PROJECT_MASTER.md, AGENT_RULES.md, DEVELOPMENT_PLAN.md and CHANGELOG.md. Report current phase, last verified task, open blockers and next task. Run relevant tests before continuing.
```
