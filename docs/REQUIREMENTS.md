# REQUIREMENTS

Requirement IDs are stable and referenced by tests and `TRACEABILITY_REPORT.md`. `MVP` is required by the end of P3; `ADV` is an extension. Acceptance criteria are testable conditions, not claims that the feature already exists.

## Functional requirements

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-ROL-01 | MVP | Admin registers participants and roles | Admin succeeds; non-admin reverts; event emitted |
| FR-ROL-02 | MVP | Admin revokes participant | Revoked account cannot perform protected actions |
| FR-ROL-03 | MVP | Enforce role and active status | Unauthorized and inactive calls revert across contracts |
| FR-SHP-01 | MVP | Shipper creates shipment with unique reference | Fields persist and `ShipmentCreated` emitted |
| FR-SHP-02 | MVP | Assigned transporter accepts or rejects | Only assigned active transporter may act |
| FR-SHP-03 | MVP | Enforce canonical shipment state machine | Legal transitions succeed; illegal transitions revert |
| FR-SHP-04 | MVP | Shipper cancels eligible shipment | Cancellation is guarded; any escrow is refunded once |
| FR-SHP-05 | MVP | Receiver confirms and accepts delivery | Condition is recorded; accepted delivery completes shipment |
| FR-TRK-01 | MVP | Record manual shipment milestones | Authorized actor, ordered event and provenance recorded |
| FR-TRK-02 | MVP | Transfer custody | Current custodian and custody event update atomically |
| FR-TRK-03 | MVP | Confirm warehouse arrival | Only authorized warehouse/transporter action succeeds |
| FR-DOC-01 | MVP | Upload document to IPFS and compute SHA-256 | API returns CID, SHA-256 and size; upload does not write chain |
| FR-DOC-02 | MVP | Anchor document hash and CID on-chain | `DocumentRegistered` emitted; hash/CID retrievable |
| FR-DOC-03 | MVP | Verify document integrity | Original bytes match; modified bytes fail |
| FR-DOC-04 | ADV | Inspector verifies and records clearance | Only Inspector; verification and clearance events emitted |
| FR-ESC-01 | MVP | Shipper deposits simulated escrow | Exact configured amount accepted; mismatch reverts |
| FR-ESC-02 | MVP | Make escrow eligible after accepted delivery | Eligibility follows canonical completion path |
| FR-ESC-03 | MVP | Release escrow exactly once | Correct recipient receives funds; duplicate release reverts |
| FR-ESC-04 | MVP | Refund on eligible rejection/cancellation | Shipper receives refund once; invalid refund reverts |
| FR-AUTH-01 | MVP | Wallet-signature authentication | Nonce signature validated and JWT issued |
| FR-AUTH-02 | MVP | Prevent authentication replay | Nonce expires and is single-use |
| FR-API-01 | MVP | Provide role-filtered shipment reads | Involved roles see allowed shipments; unrelated users are forbidden |
| FR-IDX-01 | MVP | Index chain events idempotently | Replayed logs do not duplicate rows |
| FR-IDX-02 | MVP | Rebuild chain-derived read model | Reindex result matches live chain-derived state |
| FR-ANL-01 | MVP | Provide basic operational summary | Counts and status distribution match indexed data |
| FR-ORC-01 | ADV | Submit simulated route/status updates | Restricted Oracle role only; event identifies oracle provenance |
| FR-ORC-02 | ADV | Simulate normal, delayed and deviated routes | Scenario produces documented, deterministic event sequence |
| FR-ORC-03 | ADV | Apply geofence arrival checks | Arrival only accepted under defined radius/coordinate rules |
| FR-DSP-01 | ADV | Raise and resolve disputes | Authorized parties raise; Admin resolves using allowed outcomes |
| FR-ESC-05 | ADV | Freeze escrow during dispute | Payment release is blocked until resolution |
| FR-ESC-06 | ADV | Apply capped late-delivery penalty | Formula, rounding and cap match architecture specification |
| FR-ESC-07 | ADV | Configure escrow rules | Admin-only changes emit `RuleChanged` |
| FR-CON-01 | ADV | Simulate PoW | Difficulty, nonce attempts and chain selection are reproducible |
| FR-CON-02 | ADV | Simulate PoA | Round-robin authorities and fault behavior are reproducible |
| FR-CON-03 | ADV | Simulate simplified PBFT | Commit succeeds within configured fault bound and halts beyond it |
| FR-CON-04 | ADV | Compare consensus models | Same workload and seed; metrics and assumptions reported |
| FR-CON-05 | ADV | Explain PoS and PoET | Documentation accurately compares both; simulation is optional |
| FR-SEC-01 | MVP | Demonstrate authorization and transition controls | Security tests show rejected calls without weakening checks |
| FR-SEC-02 | ADV | Demonstrate selected attacks | Isolated attack demos include assumptions and mitigations |
| FR-ANL-02 | ADV | Provide delay/dispute and transporter analytics | Aggregates match indexed source records |
| FR-ANL-03 | ADV | Provide route visualization | Map displays only indexed/oracle-reported waypoints |
| FR-ML-01 | ADV | Optional delay prediction | Seeded evaluation beats stated baseline on held-out data before display |

## Non-functional requirements

| ID | Pri | Requirement | Acceptance criteria |
|---|---|---|---|
| NFR-01 | MVP | Contract safety and bounded getters | Role, transition, event, reentrancy and pagination tests pass |
| NFR-02 | MVP | Contract coverage target | Report line coverage ≥90% and branch coverage ≥80%, or document gap |
| NFR-03 | MVP | API responsiveness | Measure p95 on stated laptop/seed size; report actual result, target ≤500 ms |
| NFR-04 | MVP | Reproducible local setup | Clean-clone workflow completes with documented commands |
| NFR-05 | MVP | Deterministic demo seed | Repeated seed yields same logical fixture records |
| NFR-06 | MVP | Secret hygiene | `.env` ignored; secret scan has no committed secret findings |
| NFR-07 | MVP | Documentation consistency | Audit script passes or remaining findings are explicitly listed |
| NFR-08 | MVP | State-change auditability | External state-changing calls emit and test relevant events |
| NFR-09 | ADV | Reproducible simulation/ML | Fixed seed and config yield stable results within stated model |
| NFR-10 | MVP | Usable transaction states | UI covers pending, confirmed, rejected, loading, empty and error states |

## Out of scope

Real-money settlement, public network deployment, real GPS hardware, legal/customs integrations, mobile application and production-grade identity/key management.
