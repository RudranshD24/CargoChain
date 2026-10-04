# DECISIONS

Architecture and scope decisions. New decisions must include date, context, decision, consequences and approval status. An agent may propose but may not silently approve a material change.

| ID | Decision | Rationale / consequence | Status |
|---|---|---|---|
| DEC-001 | Blockchain is authoritative; PostgreSQL is rebuildable index | Avoids treating divergent app data as chain truth; requires robust event replay | Accepted |
| DEC-002 | Ganache local chain ID 1337; Hardhat node is local fallback | Reproducible offline demo; no public deployment requirement | Accepted |
| DEC-003 | Solidity 0.8.24, Hardhat and OpenZeppelin ReentrancyGuard | Pinned, testable contract stack | Accepted |
| DEC-004 | Human users sign business writes with MetaMask | `msg.sender` represents the transaction signer; backend does not relay arbitrary writes | Accepted |
| DEC-005 | Documents remain off-chain; SHA-256 and CID are anchored | Reduces on-chain storage; hash is not encryption and IPFS availability is not guaranteed | Accepted |
| DEC-006 | Consensus simulator is independent of Ganache | Educational comparison without misrepresenting local chain consensus | Accepted |
| DEC-007 | MVP ends at P3; advanced features are conditional | Protects completion of core working system | Accepted |
| DEC-008 | Oracle is a restricted, trusted reporter, not proof of external truth | Makes trust boundary explicit; reports retain provenance | Accepted |
| DEC-009 | Test ETH escrow is a local simulation, not real payment | Avoids financial/legal claims; demonstrates contract flow only | Accepted |
| DEC-010 | PoW, PoA and PBFT-lite are initial simulator scope; PoS/PoET documented, optional to simulate | Covers syllabus concepts without overloading MVP | Accepted |
| DEC-011 | Contract, API, UI, simulator and ML tests remain in their respective layers | Prevents mismatched test ownership and unclear evidence | Accepted |
| DEC-012 | MVP contracts are non-upgradeable; redeploy/migration is the demo upgrade path | Keeps contract design explainable; proxy pattern is future work | Accepted |

## Change proposal template

- **Proposed ID:**
- **Date:**
- **Affected requirements/documents/code:**
- **Current behavior:**
- **Proposed change:**
- **Reason and trade-offs:**
- **Tests/evidence required:**
- **User approval:** Pending / Approved / Rejected
