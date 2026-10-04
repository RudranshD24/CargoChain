# EVALUATION_PLAN

## 1. Evaluation policy

Report measured results only. Targets are acceptance goals, not pre-existing results. Record hardware/software versions, commands, dataset size, seed, test count and failures. Separate implemented, simulated and proposed functionality.

## 2. MVP functional evaluation

| Area | Evidence | Acceptance |
|---|---|---|
| Roles and lifecycle | Hardhat positive/negative tests | Only permitted transitions/actions succeed |
| Documents | API/IPFS integration and contract tests | Original file matches anchored hash; modified file fails |
| Escrow | Hardhat tests on local test ETH | Exact deposit, correct eligibility, once-only release/refund |
| Authentication | pytest | Signature verified; expired/reused nonce rejected |
| Indexer | Integration test | Duplicate polling idempotent; reindex matches chain |
| UI | Browser/E2E demo | Core role flows and transaction states work |
| Setup | Clean-clone run | Documented local workflow succeeds |

## 3. Advanced evaluation

- Oracle: test normal, delayed and deviated scenarios, access restriction and provenance.
- Consensus: compare PoW, PoA and PBFT-lite with identical workload and seed. Explain PoS and PoET; only publish simulation metrics for models actually implemented.
- Security lab: controlled attacks, expected failure/success behavior and mitigation.
- Analytics: reconcile each aggregate to source rows.
- Optional ML: compare against majority-class baseline on held-out synthetic data; report F1, ROC-AUC (when defined), MAE and class balance.

## 4. Quantitative targets

| Metric | Target / rule |
|---|---|
| Contract line coverage | ≥90% target |
| Contract branch coverage | ≥80% target |
| Gas | Record create shipment, milestone, document registration and release; report actual gas and constraints |
| API p95 latency | ≤500 ms target on a stated laptop with 1,000 seeded shipments |
| Reproducibility | Fixed seed/config gives stable logical results |
| Startup | Clean-clone setup follows `WORKFLOW.md` |
| Security | No known critical/high findings left unreported; no claim of certification |

If a target is missed, report the measured value, test setup, cause if known and follow-up plan. Never adjust a threshold after seeing results without recording a decision.

## 5. Evidence table template

| Date | Commit | Environment | Command | Result | Artifact |
|---|---|---|---|---|---|
| Not run | — | — | — | Pending | — |

## 6. Final reporting

Include requirement coverage, passing/failing/skipped tests, gas and coverage reports, latency setup/results, simulator assumptions and metrics, ML limitations if applicable, screenshots from actual runs, known defects and exact MVP/advanced completion boundary.
