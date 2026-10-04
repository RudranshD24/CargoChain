# CONSISTENCY_AUDIT

## 1. Purpose

Use this checklist before accepting a phase and during final documentation freeze. The audit script performs basic structural checks; it does not prove semantic or code-level correctness.

## 2. Automated checks

Run from repository root:

```bash
python scripts/audit_docs.py
```

The script checks required documents, local Markdown links, canonical vocabulary references, duplicate requirement IDs and placeholder markers. A passing script is necessary but not sufficient.

## 3. Manual checks

- [ ] Project name, course code, chain ID and pinned stack agree across documents.
- [ ] Contract, function, event, enum and status names match deployed code and ABI.
- [ ] `ShipmentRegistry` remains the sole shipment status owner.
- [ ] Every legal state transition has actor/guard coverage; every illegal transition reverts.
- [ ] Human writes are MetaMask-signed; Oracle is the only approved service-account write exception.
- [ ] API access checks match contract roles and shipment visibility.
- [ ] API, DB and UI field names and enum serialization agree.
- [ ] Reindex rebuilds only chain-derived projections and preserves off-chain-only data.
- [ ] Document hash is SHA-256 of raw bytes; CID is not represented as confidentiality.
- [ ] Escrow is labeled test ETH; no real-payment claim appears.
- [ ] Oracle reports are labeled as reports, not verified physical truth.
- [ ] Consensus simulator is independent of Ganache; simplified assumptions are stated.
- [ ] PoS, PoET, Algorand and sharding are described in a way consistent with the course outline.
- [ ] Contract tests are separated from API, IPFS, UI, simulator and ML tests.
- [ ] Requirement IDs map to actual tests and test outputs.
- [ ] Optional ML does not block MVP acceptance.
- [ ] Evaluation numbers, screenshots and success claims have real evidence.
- [ ] Known limitations and unresolved defects are disclosed.

## 4. Findings log

| ID | Finding | Severity | Owner | Resolution / evidence | Status |
|---|---|---|---|---|---|
| CA-001 | Run structural audit against actual repository | Medium | Agent | Record command output | Open |
| CA-002 | Verify contract/API/UI interfaces against generated ABI/OpenAPI | High | Agent | Record interface diff | Open |
| CA-003 | Confirm phase gate with real tests | High | Student + Agent | Attach test output | Open |

Do not mark an item resolved merely because documentation was edited; inspect implementation and evidence.
