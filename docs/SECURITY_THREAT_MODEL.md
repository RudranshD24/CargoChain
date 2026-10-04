# CARGOCHAIN — COMPREHENSIVE SECURITY THREAT MODEL & RISK ASSESSMENT

**Phase:** Phase 6 — Security Hardening, Advanced Analytics & Production-Readiness Assessment  
**Auditor:** Principal Blockchain Security Engineer, Senior Solidity Auditor  
**Date:** October 4, 2026  
**Scope:** Smart Contracts, Backend API, PostgreSQL Read Model, IPFS, Oracle Service, Consensus Simulator, ML Pipeline, and Frontend DApp  

---

## 1. PURPOSE & METHODOLOGY

This threat model identifies assets, analyzes trust boundaries, models threat vectors, and assigns risk severity classifications across the CargoChain logistics platform. It provides actionable remediation controls and defines the verification test suite required to validate each defense.

### Risk Severity Rating Scale
* **CRITICAL:** Direct loss or theft of escrow funds, complete authentication bypass, arbitrary contract state overwrite, or private key disclosure.
* **HIGH:** Unauthorized state transition, escrow lockup without resolution, oracle privilege escalation, or cross-tenant document tampering.
* **MEDIUM:** Broken object-level authorization (IDOR) leaking read-only data, replay of expired nonces, API denial-of-service via resource exhaustion, or geofence boundary rounding discrepancies.
* **LOW:** Non-critical UI state inconsistencies, missing security headers, or minor documentation ambiguities.

---

## 2. SYSTEM ASSETS & DATA CLASSIFICATION

1. **Escrow Balances (`EscrowManager.sol`):** Real/test ETH locked in escrow for freight settlement. Must never be double-released, stolen by unauthorized parties, or permanently frozen without administrative recourse.
2. **Shipment Lifecycle State (`ShipmentRegistry.sol`):** Authoritative on-chain state machine (`Created`, `Accepted`, `InTransit`, `Arrived`, `Delivered`, `Completed`, `Disputed`).
3. **Identity & Role Registry (`ParticipantRegistry.sol`):** Maps wallet addresses to operational permissions (`Admin`, `Shipper`, `Transporter`, `Warehouse`, `Inspector`, `Receiver`, `Oracle`).
4. **Physical Custody Chain (`TrackingManager.sol`):** Tamper-evident ledger of which participant currently holds physical custody of goods.
5. **Document Digests (`DocumentRegistry.sol`):** SHA-256 cryptographic hashes anchoring Bills of Lading, Customs Declarations, and Inspection Certificates.
6. **Off-Chain Documents (IPFS):** Physical payload files pinned to Kubo IPFS nodes.
7. **Session Credentials & Nonces:** EIP-191 single-use nonces and signed JWT bearer tokens governing API access.
8. **Oracle Signer Key:** Private key authorized to submit off-chain telematics, milestones, and route deviation alerts.
9. **PostgreSQL Read Model:** Indexed projections reflecting blockchain events for fast querying.
10. **ML Model Artifacts & Inferences:** Predictive remaining transit hours and late delivery risk scores.

---

## 3. TRUST BOUNDARIES & ARCHITECTURAL ASSUMPTIONS

```
+-----------------------------------------------------------------------------------------+
|                                    TRUST BOUNDARIES                                     |
|                                                                                         |
|  [ UNTRUSTED CLIENT BROWSER / METAMASK ]                                                |
|    - Can manipulate local DOM, forge request bodies, replay requests, refuse signatures |
|    ======================== TRUST BOUNDARY 1: RPC / HTTP =============================  |
|                                                                                         |
|  [ FASTAPI BACKEND & POSTGRESQL READ MODEL ]                                            |
|    - Authenticates sessions via EIP-191 signatures + single-use nonces                  |
|    - Enforces server-side authorization (does not trust client-asserted roles)           |
|    - Read model is non-authoritative projection of blockchain events                    |
|    ======================== TRUST BOUNDARY 2: WEB3 RPC ===============================  |
|                                                                                         |
|  [ SMART CONTRACT EXECUTION ENVIRONMENT (EVM) ]                                         |
|    - Authoritative source of truth for shipment states, custody, escrow, and disputes   |
|    - Enforces modifier guards, state transition constraints, and reentrancy mutex       |
|    ======================== TRUST BOUNDARY 3: EXTERNAL ORACLE ========================  |
|                                                                                         |
|  [ ORACLE SERVICE DAEMON ]                                                              |
|    - Submits claims regarding external telemetry; cannot create shipments or move funds  |
|    ======================== TRUST BOUNDARY 4: ML / SIMULATION ========================  |
|                                                                                         |
|  [ ML ENGINE & CONSENSUS SIMULATOR ]                                                    |
|    - Isolated analytical components; strictly zero transaction-signing capabilities     |
+-----------------------------------------------------------------------------------------+
```

---

## 4. DETAILED THREAT MATRIX & MITIGATION CONTROLS

| ID | Asset at Risk | Threat Vector & Attack Path | Preconditions | Impact | Existing Mitigation | Phase 6 Hardening Control | Verification Test | Risk Level |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TM-01** | Escrow Funds | **Reentrancy Attack on Payout:** Malicious Transporter or Receiver contract executes fallback recursion during `releasePayment()` or `refundShipper()`. | Attacker is designated Transporter/Shipper and calls payout via contract. | **CRITICAL** | `ReentrancyGuard` nonReentrant modifier and Checks-Effects-Interactions pattern. | Add dedicated `SecurityAttacks.test.js` exercising reentrancy attack against escrow. | `SecurityAttacks.test.js` ("reentrancy attack blocked") | **CRITICAL** |
| **TM-02** | Escrow Funds | **Unauthorized Release of Frozen Escrow:** Caller attempts ordinary `releasePayment()` or `refundShipper()` while shipment is in `Disputed` state. | Escrow is frozen (`frozen == true`). | **HIGH** | `releasePayment()` checks `if (e.frozen) revert EscrowIsFrozen()`. | Enforce check ordering across all payout paths and test split resolution limits. | `DisputeEscrow.test.js` & `SecurityAttacks.test.js` | **HIGH** |
| **TM-03** | Escrow Funds | **Dispute Split Manipulation:** Admin resolution provides split basis points $> 10,000\text{ bps}$, attempting to disburse more than deposited balance. | Malicious or buggy admin input. | **HIGH** | `require(splitBps <= 10000)` check on-chain. | Add boundary test for $> 10000\text{ bps}$ and zero-split disbursement. | `SecurityAttacks.test.js` ("split bps overflow rejected") | **HIGH** |
| **TM-04** | Lifecycle State | **Invalid State Machine Bypass:** Caller attempts illegal transition (e.g. `Created -> Delivered` or mutating `Completed`). | Any registered caller. | **HIGH** | Explicit state transition matrix in `ShipmentRegistry.sol`. | Add comprehensive invalid transition matrix test covering all $10 \times 10$ pairs. | `SecurityAttacks.test.js` ("state machine transition fuzzing") | **HIGH** |
| **TM-05** | Identity & Roles | **Role Spoofing / Privilege Escalation:** Unregistered or non-admin caller attempts to invoke `registerParticipant()`, `revokeParticipant()`, or `setRules()`. | Attacker possesses EVM private key. | **HIGH** | `onlyAdmin` modifier on `ParticipantRegistry.sol` and `EscrowManager.sol`. | Add negative tests confirming non-admin calls revert with custom error. | `ParticipantRegistry.test.js` & `SecurityAttacks.test.js` | **HIGH** |
| **TM-06** | Telematics | **Oracle Authority Abuse:** Oracle account attempts to call non-Oracle functions (`createShipment`, `transferCustody`, `releasePayment`, `resolveDispute`). | Attacker compromises Oracle private key. | **HIGH** | Contracts strictly restrict Oracle role to `TrackingManager.submitOracleUpdate` and `markDelayed`. | Verify negative assertions for all non-Oracle functions using Oracle signer. | `OracleTracking.test.js` & `SecurityAttacks.test.js` | **HIGH** |
| **TM-07** | Session Auth | **Signature Replay / Stale Nonce:** Attacker intercepts signed EIP-191 message and attempts to authenticate after session expiry or reuse nonce. | Network sniffing / MITM. | **MEDIUM** | Single-use expiring nonces stored in DB with 5-minute TTL. | Verify nonce is marked `used=True` immediately upon verification and expires. | `test_auth.py` ("nonce single-use and expiration") | **MEDIUM** |
| **TM-08** | Read Model | **Broken Object-Level Authorization (IDOR):** Attacker queries `/api/v1/documents/{id}` or `/shipments/{id}` for shipments where they are not an authorized stakeholder. | Valid JWT for unrelated user. | **MEDIUM** | Backend queries filter by participant address; admin/inspector role override. | Add negative tests verifying HTTP 403 on cross-participant data access. | `test_documents_ipfs.py` & `test_shipments_api.py` | **MEDIUM** |
| **TM-09** | Backend API | **Denial of Service via Payload Flooding:** Attacker sends massive payloads or excessive request bursts to backend endpoints. | Unauthenticated or authenticated client. | **MEDIUM** | Request size checks and async connection timeouts. | Implement security headers and payload size limit middleware in FastAPI. | `test_security_headers.py` | **MEDIUM** |
| **TM-10** | Document Integrity | **IPFS Content Tampering:** Attacker modifies off-chain IPFS payload and serves altered file to Receiver. | Attacker hosts modified file on IPFS. | **MEDIUM** | Receiver client recomputes SHA-256 hash and compares with on-chain digest. | Automated verification test checking hash mismatch triggers `TamperedDocument` warning. | `test_documents_ipfs.py` & `DocumentRegistry.test.js` | **MEDIUM** |
| **TM-11** | Analytical Models | **Autonomous Contract Execution Leakage:** ML delay predictions or simulated consensus events trigger on-chain contract transactions. | Faulty backend integration. | **CRITICAL** | Architectural wall: `simulator/` and `ml/` do not import Web3 signers or call contracts. | Isolation unit tests confirming zero contract interactions occur. | `test_simulator.py` & `test_ml.py` | **CRITICAL** |

---

## 5. RESIDUAL RISKS & PRODUCTION GAPS

1. **Local Chain Assumptions:** Ganache local blockchain uses deterministic test mnemonics and instantaneous mining without real-world gas price volatility or mempool front-running.
2. **Single Oracle Signer:** The current implementation uses a single restricted Oracle key. Production logistics requires a decentralized oracle network (e.g. Chainlink DON) or threshold multi-signatures.
3. **Public IPFS Storage:** Documents stored on IPFS are content-addressed and public. While cryptographic hashes prevent tampering, document confidentiality relies on gateway access control or off-chain symmetric encryption.
4. **Reorganization Depth:** The event indexer assumes sequential block progression. Deep reorgs (>5 blocks) require the documented full-reindex recovery protocol.
