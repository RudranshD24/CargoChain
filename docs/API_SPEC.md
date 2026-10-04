# API_SPEC

Base URL: `http://localhost:8000/api/v1`. JSON unless stated. FastAPI publishes OpenAPI at `/docs`. This API contract is subordinate to `PROJECT_MASTER.md` and must match `ARCHITECTURE.md` and `DATABASE.md`.

**Blockchain writes:** human users sign contract transactions with MetaMask. The API does not relay arbitrary user transactions. The only automated write exception is the restricted Oracle service account for explicitly approved oracle methods.

## 1. Conventions

- Authentication: `Authorization: Bearer <JWT>`, except `/health` and `/auth/*`.
- API authorization uses the authenticated wallet address and current participant state; cached JWT role alone is not sufficient for sensitive actions.
- Visibility: participant can read shipments where their address is shipper, transporter, receiver, warehouse or inspector; Admin can read all.
- Pagination: `limit=20&offset=0`; response `{items,total,limit,offset}`.
- Error envelope: `{ "error": { "code": "STRING", "message": "human text", "details": {} } }`.
- Codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `CHAIN_ERROR`, `IPFS_ERROR`.
- Upload size default: 10 MB, configurable with `MAX_UPLOAD_MB`.

## 2. Authentication

1. `POST /auth/nonce` with `{address}` returns a nonce and exact message to sign, including domain/context and expiry.
2. Client signs using `personal_sign`.
3. `POST /auth/login` with `{address,signature}` verifies signer, expiry and single-use nonce, then returns `{token,role,expiresIn}`.
4. Nonce consumption must be atomic. JWT expiry and signing algorithm are configured server-side. Revoked participants are denied on subsequent protected requests.

## 3. Endpoints

| Priority | Method | Path | Access | Purpose |
|---|---|---|---|---|
| MVP | GET | `/health` | Public | Service, chain, DB and IPFS health |
| MVP | POST | `/auth/nonce` | Public | Issue login nonce |
| MVP | POST | `/auth/login` | Public | Verify wallet signature and issue JWT |
| MVP | GET | `/me` | Any authenticated | Current wallet and role |
| MVP | GET | `/participants` | Admin | List participants |
| MVP | PATCH | `/participants/{address}/profile` | Admin | Update off-chain display/org name |
| MVP | GET | `/shipments` | Authenticated | List permitted shipments; filter by status, role, query and date |
| MVP | GET | `/shipments/{id}` | Involved/Admin | Shipment details |
| MVP | GET | `/shipments/{id}/milestones` | Involved/Admin | Ordered timeline and provenance |
| MVP | GET | `/shipments/{id}/custody` | Involved/Admin | Custody history |
| MVP | GET | `/shipments/{id}/documents` | Involved/Admin | Anchored document metadata |
| MVP | GET | `/shipments/{id}/escrow` | Involved/Admin | Escrow state and events |
| MVP | POST | `/documents/upload` | Shipper, Inspector | Multipart file + shipmentId + docType; returns CID/hash/size; no chain write |
| MVP | POST | `/documents/verify` | Involved/Admin | Multipart file + shipmentId + docIndex; recompute hash |
| MVP | GET | `/documents/{cid}` | Involved/Admin | Authorized IPFS proxy download |
| MVP | GET | `/analytics/summary` | Authenticated | Basic counts/status distribution/on-time rate |
| MVP | GET | `/audit` | Admin, Inspector | Raw indexed chain events |
| MVP | POST | `/admin/reindex` | Admin | Rebuild chain-derived projections |
| ADV | GET | `/shipments/{id}/route` | Involved/Admin | Oracle-reported waypoints |
| ADV | GET | `/disputes` | Authorized parties/Admin | Dispute list |
| ADV | GET | `/disputes/{id}` | Involved/Admin | Dispute detail |
| ADV | GET | `/disputes/{id}/history` | Involved/Admin | Ordered dispute events |
| ADV | GET | `/oracle/status` | Authenticated | Oracle service state |
| ADV | POST | `/oracle/scenarios` | Admin | Start a bounded demo scenario |
| ADV | POST | `/oracle/scenarios/{id}/stop` | Admin | Stop scenario |
| ADV | GET | `/oracle/events` | Involved/Admin | Oracle reports, optionally filtered |
| ADV | POST | `/simulator/run` | Authenticated | Run configured model with seed |
| ADV | GET | `/simulator/runs` | Authenticated | List runs |
| ADV | GET | `/simulator/runs/{id}` | Authenticated | Metrics and block trace |
| ADV | POST | `/simulator/compare` | Authenticated | Compare models on same workload/seed |
| ADV | POST | `/simulator/attack` | Authenticated | Run controlled attack model |
| ADV | GET | `/analytics/delays` | Authenticated | Delayed/disputed lists |
| ADV | GET | `/analytics/transporters` | Admin, Shipper | Aggregate performance metrics |
| ADV | GET | `/analytics/timeseries` | Authenticated | Delivery/transit time series |
| ADV | POST | `/ml/predict` | Authenticated | Optional shipment delay prediction |
| ADV | GET | `/ml/model-info` | Authenticated | Optional model metadata |

## 4. Representative response schemas

Shipment: `shipmentId`, `externalRef`, `status`, `productDescription`, `quantity`, `origin`, `destination`, participant addresses, `currentCustodian`, `expectedDelivery`, `paymentAmountWei`, `escrowState`.

Milestone: `type`, `location`, optional `lat`/`lon`, `note`, `source`, `submittedBy`, `submitterRole`, `blockNumber`, `blockTime`, `txHash`.

Document upload: `{cid,sha256,size}`. Verification: `{match,expectedHash,computedHash,cid}`. These schemas are illustrative; generated OpenAPI is the executable API contract.

## 5. Contract and API boundary

Frontend contract writes must use ABIs from `contracts/abi/` and addresses from `deployments/local.json`. API endpoints that upload files or return indexed state must not silently submit user business transactions. Oracle writes must use a dedicated account, restricted contract role, scenario allowlist and audit log.
