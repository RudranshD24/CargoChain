# UI_UX_SPEC

## 1. Product goals

Provide a clear local demonstration of role-controlled shipment management, transaction signing, tamper-evident documents and audit history. The interface must distinguish indexed information from wallet transactions and oracle-reported data.

## 2. Global shell

- Next.js 14 App Router, React, strict TypeScript and Tailwind CSS.
- Persistent header: CargoChain identity, connected wallet, network/chain indicator, role, account menu.
- Require chain ID `1337` for local demo actions. Explain how to switch networks; never imply a public deployment.
- Every async view includes loading, empty, error and retry states.
- Every wallet write shows awaiting-signature, pending, confirmed and rejected/failed states, including transaction hash when available.
- Use accessible labels, keyboard focus, semantic headings and responsive layouts.

## 3. Routes and role actions

| Route | Roles | Main content/actions |
|---|---|---|
| `/` | Public | Project overview, connect wallet, local-demo warning |
| `/login` | Public | Wallet nonce-signature login |
| `/dashboard` | Authenticated | Role-filtered KPIs and relevant shipments |
| `/shipments` | Authenticated | Search/filter/paginated permitted shipments |
| `/shipments/new` | Shipper | Create shipment transaction |
| `/shipments/[id]` | Involved/Admin | Details, status, participants and action panel |
| `/shipments/[id]/documents` | Shipper/Inspector/involved read | Upload, anchor via wallet, verify hash |
| `/shipments/[id]/escrow` | Involved/Admin | Test-ETH escrow status, deposit/release/refund where allowed |
| `/participants` | Admin | Register/revoke participants and edit profile |
| `/audit` | Admin/Inspector | Event log and transaction provenance |
| `/oracle` | Admin (ADV) | Start/stop deterministic scenarios |
| `/disputes` | Authorized parties/Admin (ADV) | Dispute queue, details and resolution |
| `/simulator` | Authenticated (ADV) | Model setup, run, compare and visualize |
| `/analytics` | Authenticated | MVP summary; advanced charts when implemented |
| `/security-lab` | Authenticated (ADV) | Controlled attack and authorization demonstrations |

## 4. Role-aware behavior

Hide actions that are not relevant, but enforce every permission again in the contract/API. Role action matrix must be derived from the canonical state machine and role definitions; do not duplicate role rules in ad hoc UI conditionals without a shared helper.

## 5. Shipment detail

Use clear tabs or sections: Overview, Timeline, Custody, Documents, Escrow, and advanced Disputes/Route when available. Timeline items display milestone type, location, source badge (`Manual` or `Oracle`), submitter/role, block time and transaction hash. Label Oracle data as “reported”, not independently verified GPS truth.

## 6. Transaction UX

Before submitting, show the action and relevant parameters. User confirms in MetaMask. Do not show success until wallet/provider confirms receipt and expected event/state can be read. Handle wrong network, disconnected wallet, rejected signature, reverted transaction, timeout and stale indexed data.

## 7. Documents and escrow

- Document upload and on-chain anchoring are separate steps with separate confirmations.
- Show the exact file fingerprint and CID; provide integrity verification result.
- Escrow panels must say “Ganache test ETH — no real payment”. Display amount in wei and optional test ETH conversion.
- Do not expose private document content to unrelated participants.

## 8. Visual system

Use a restrained logistics/operations dashboard: high-contrast text, consistent spacing, clear status chips and accessible color contrast. Status colors must always be paired with text/icons; color alone cannot convey state. Avoid fabricated ratings, trust scores or AI certainty labels.

## 9. MVP acceptance checklist

- Wallet connect and signature login.
- Role dashboard and permitted shipment list.
- Shipper create flow; transporter accept/reject/dispatch.
- Timeline and custody history.
- Document upload, wallet anchoring and integrity verification.
- Escrow test-ETH panel and eligible MVP actions.
- Admin participant page and basic analytics.
- Pending/confirmed/failed, loading/empty/error states on all relevant flows.
- Browser run follows `DEMO_SCRIPT.md` MVP acts.
