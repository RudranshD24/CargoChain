# CargoChain — Advanced Analytics & Operational Observability
## Phase 6 Analytics Specifications, Metric Definitions & Safeguards

**Project:** CargoChain — Smart Contract-Based Logistics and Freight Management  
**Phase:** Phase 6 (Security Hardening, Advanced Analytics & Production-Readiness Assessment)  
**Author:** Full-Stack Architect, Data Engineer, QA Lead  
**Date:** October 2026  
**Status:** COMPLETE & VERIFIED  

---

## 1. Overview & Architectural Boundaries

Phase 6 introduces **Advanced Analytics and Spatial Route Corridor Observability** to CargoChain. The objective is to provide actionable visibility into freight lifecycle efficiency, transporter service-level agreement (SLA) compliance, and corridor delay patterns without altering on-chain contract state or compromising data confidentiality.

### Non-Negotiable Analytical Boundaries
1. **Read-Only Scope:** Analytics queries aggregate existing PostgreSQL projections and blockchain events. Analytics endpoints NEVER write to smart contracts, execute escrow releases, or trigger penalties.
2. **Data Classification:** All outputs are explicitly tagged with `dataClassification: "SYNTHETIC_LOCAL_DEMO"`. The application makes no claim that local simulated data represents physical freight operations.
3. **Role-Based Authorization:** Enterprise-wide metrics are restricted to Admin participants (`role == 1`). Non-admin participants (Shippers, Transporters, Receivers, Warehouses, Inspectors) receive strictly filtered metrics scoped only to shipments in which their wallet is actively assigned.
4. **ML Isolation:** Machine learning ETA and delay predictions remain advisory overlays. Under no circumstances may ML outputs automate dispute resolutions or contract state transitions.

---

## 2. Metric Definitions & Formulas

### 2.1 Shipment Lifecycle Duration
Measures stage-to-stage operational latency across the shipment lifecycle:
- **Origin Staging Latency ($T_{\text{staging}}$):** Elapsed time from shipment registration to transporter dispatch milestone:
  $$T_{\text{staging}} = t_{\text{dispatched}} - t_{\text{created}}$$
- **Transit Duration ($T_{\text{transit}}$):** Elapsed movement time along the transport corridor:
  $$T_{\text{transit}} = t_{\text{delivered}} - t_{\text{dispatched}}$$
- **Settlement & Acceptance Latency ($T_{\text{settlement}}$):** Time from delivery confirmation to receiver final acceptance:
  $$T_{\text{settlement}} = t_{\text{completed}} - t_{\text{delivered}}$$
- **Total Cycle Time:** End-to-end duration from creation to completed settlement:
  $$T_{\text{total}} = T_{\text{staging}} + T_{\text{transit}} + T_{\text{settlement}}$$

### 2.2 Transporter SLA Compliance
Evaluates carrier reliability based on on-time delivery commitments:
- **On-Time Criteria:** A shipment is classified as on-time if:
  $$\text{status} = \text{Completed} \quad \text{AND} \quad t_{\text{delivered}} \le t_{\text{expected}}$$
- **SLA Fulfillment Rate ($R_{\text{SLA}}$):**
  $$R_{\text{SLA}} = \left( \frac{N_{\text{on\_time}}}{N_{\text{total\_delivered}}} \right) \times 100\%$$
- **Risk Tiers:**
  - $\ge 90\%$: Tier 1 (High Reliability) — Green badge
  - $75\% - 89\%$: Tier 2 (Moderate Risk) — Amber badge
  - $< 75\%$: Tier 3 (Breach / Underperforming) — Red badge

### 2.3 Freight Corridor Delay Aggregation
Identifies geographical corridors exhibiting systemic transit friction:
- **Lane Identification:** Unique tuple $(\text{Origin}, \text{Destination})$.
- **Average Delay Hours ($\bar{D}_{\text{lane}}$):** Mean delay duration among late shipments in the lane:
  $$\bar{D}_{\text{lane}} = \frac{1}{|K_{\text{delayed}}|} \sum_{i \in K_{\text{delayed}}} \max\left(0, \frac{t_{\text{delivered}}^{(i)} - t_{\text{expected}}^{(i)}}{3600}\right)$$

---

## 3. Spatial Route Corridors & Waypoint Visualizer

The Route Corridors feature (`/api/v1/analytics/route-corridors` and frontend visualizer at `/analytics`) renders the physical progression of freight across spatial waypoints:

| Property | Data Type | Description |
|---|---|---|
| `shipmentId` | `int` | Primary on-chain identifier. |
| `externalRef` | `string` | Shipper external ERP reference. |
| `origin` / `destination` | `string` | Named facility origin and delivery hub. |
| `destLat` / `destLon` | `float` | Target delivery coordinates in decimal degrees (converted from on-chain microdegrees $\div 10^6$). |
| `geofenceRadiusM` | `int` | Authorized geofence boundary in meters. |
| `waypoints` | `array` | Ordered sequence of spatial waypoints recording progress, GPS coordinates, geofence verification status (`inGeofence: bool`), and timestamps. |

---

## 4. API Endpoints

### `GET /api/v1/analytics/summary`
- **Auth:** Bearer JWT (Role-scoped).
- **Output:** Total shipments, active, completed, delayed, disputed counts, and status distribution map.

### `GET /api/v1/analytics/advanced`
- **Auth:** Bearer JWT (Role-scoped).
- **Output:** `AdvancedAnalyticsResponse` containing `lifecycleDuration`, `transporterSLA`, and `corridorDelays`.

### `GET /api/v1/analytics/route-corridors`
- **Auth:** Bearer JWT (Role-scoped).
- **Output:** `RouteCorridorsResponse` containing array of `RouteCorridorItem` with structured waypoint timelines.

---

## 5. Machine Learning Safeguards & Governance

CargoChain's machine learning module (trained on synthetic freight dataset `data/synthetic_freight_data.csv`) generates:
1. **ETA Regression:** Predicted delivery delay in hours.
2. **Delay Classification:** Binary probability of shipment delay ($> 4$ hours).

### Strict Safeguard Policies
- **No Direct Contract Execution:** Model predictions are displayed in the Next.js UI solely for planner advisories. No smart contract calls, escrow release requests, or dispute resolutions can be initiated by ML inference.
- **Leakage Prevention:** Training features strictly omit post-outcome variables, on-chain transaction hashes, block numbers, or final dispute resolutions.
- **Uncertainty Presentation:** Prediction UI displays standard deviation intervals and explicit "Advisory Only" badges.
