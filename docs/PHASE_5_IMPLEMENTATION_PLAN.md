# PHASE 5 IMPLEMENTATION PLAN: CONSENSUS SIMULATOR & ML ETA DELAY PREDICTION

**Project:** CargoChain — Smart Contract-Based Logistics and Freight Management  
**Phase:** Phase 5 (Consensus Simulator, ML ETA Delay Prediction, Integration & Acceptance)  
**Author:** CargoChain Core Engineering Team  
**Status:** In Progress / Approved for Implementation  
**Baseline Status:** Pre-Phase-5 Hardening Audit PASSED (177/177 tests passing, Next.js build clean)  

---

## 1. SCOPE & OBJECTIVES

Phase 5 introduces two key analytical and educational capabilities into the CargoChain ecosystem while strictly maintaining the integrity, access controls, and invariants of Phases 0–4:

1. **Module A — Educational Consensus Simulator (`simulator/`):**
   - Provide an educational, interactive engine comparing blockchain consensus mechanisms: Proof of Work (PoW), Proof of Stake (PoS), Practical Byzantine Fault Tolerance (PBFT), Proof of Authority (PoA), and Proof of Elapsed Time (PoET).
   - Support configurable network size, validator count, Byzantine/faulty node injection, network latency/delays, mining difficulty, stake distribution, and deterministic random seeds.
   - Calculate analytical metrics: consensus finality latency, simulated transaction throughput, message overhead, round failures, and energy/computational indices.
   - Completely isolated from the local Ganache chain (cannot and does not alter Ganache consensus or write transactions).
   - FastAPI endpoints mounted under `/api/v1/consensus/` and Next.js frontend console at `/consensus`.

2. **Module B — ML-Based ETA and Delay Prediction (`ml/`):**
   - Provide a decision-support machine learning pipeline predicting remaining transit duration (ETA regression) and late delivery risk probability (delay classification).
   - Feature engineering pipeline using available shipment parameters: route distance, planned duration, cargo category, priority band, transit milestones elapsed, and synthetic lane weather/traffic risk indicators.
   - Train and evaluate baseline and candidate models (Linear Regression, Ridge, Random Forest Regressor, Logistic Regression, Random Forest Classifier) with reproducible time/group-aware splits.
   - Serialize model artifacts and expose authenticated prediction endpoints (`/api/v1/ml/predict-eta`, `/api/v1/ml/model-info`).
   - Decision-support only: strictly read-only, informational frontend display with clear caveats; predictions never trigger smart contract writes, escrow freezes, or dispute resolutions.

---

## 2. ARCHITECTURE & MODULE BOUNDARIES

```
+-----------------------------------------------------------------------------------+
|                                  CARGOCHAIN DAPP                                  |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  | Frontend (/app)    |   | Frontend (/app)     |   | Frontend (Shipment View) |  |
|  | /consensus page    |   | /analytics page     |   | Predicted ETA / Risk     |  |
|  +---------+----------+   +----------+----------+   +------------+-------------+  |
|            |                         |                           |                |
+------------|-------------------------|---------------------------|----------------+
             | HTTP (REST)             | HTTP                      | HTTP (Auth)
             v                         v                           v
+-----------------------------------------------------------------------------------+
|                                  FASTAPI BACKEND                                  |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  | /api/v1/consensus  |   | /api/v1/analytics   |   | /api/v1/ml               |  |
|  | - /models          |   | Existing Dashboards |   | - /predict-eta           |  |
|  | - /simulate        |   +---------------------+   | - /model-info            |  |
|  | - /compare         |                             | - /retrain (admin)       |  |
|  +---------+----------+                             +------------+-------------+  |
|            |                                                     |                |
|            v                                                     v                |
|  +--------------------+                             +--------------------------+  |
|  | simulator/ package |                             | ml/ package              |  |
|  | - pow.py, pos.py   |                             | - pipeline.py            |  |
|  | - pbft.py, poa.py  |                             | - dataset.py             |  |
|  | - poet.py          |                             | - models.py, train.py    |  |
|  | - engine.py        |                             | - artifacts/ (joblib)    |  |
|  +--------------------+                             +--------------------------+  |
+-----------------------------------------------------------------------------------+
             |                                                     |
             X (ISOLATED - NO WRITE ACCESS)                        X (READ-ONLY PROJECTIONS)
             v                                                     v
+-----------------------------------------------------------------------------------+
|               SMART CONTRACTS (GANACHE) & POSTGRESQL (READ MODEL)                 |
|   ParticipantRegistry | ShipmentRegistry | TrackingManager | EscrowManager        |
+-----------------------------------------------------------------------------------+
```

### Trust Boundary Safeguards
* **Ganache Chain Independence:** Neither `simulator/` nor `ml/` imports `w3.eth.account` to execute transactions. All consensus models run in-memory discrete event loops.
* **Non-Autonomous Predictions:** ML results return advisory JSON envelopes with explicit confidence bounds and data caveats. No contract methods are invoked based on model inferences.
* **Authentication & Authorization:** ML prediction for specific shipments requires active JWT session and role-verified access to that shipment.

---

## 3. DATA FLOW & API DESIGN

### 3.1 Consensus Simulator API (`backend/app/routers/consensus.py`)
1. `GET /api/v1/consensus/models`
   - Returns metadata, parameter definitions, and educational summaries for PoW, PoS, PBFT, PoA, and PoET.
2. `POST /api/v1/consensus/simulate`
   - Accepts `SimulationRequest`:
     ```json
     {
       "mechanism": "pow",
       "nodes_count": 8,
       "faulty_nodes_count": 1,
       "workload_blocks": 5,
       "network_latency_ms": 50,
       "seed": 42,
       "parameters": {
         "difficulty": 3
       }
     }
     ```
   - Returns `SimulationResult` containing round-by-round event timelines, block proposals, validator selections, messages exchanged, and summary metrics.
3. `POST /api/v1/consensus/compare`
   - Accepts workload configuration and runs parallel simulations across selected mechanisms (e.g. PoW vs. PoS vs. PBFT vs. PoA vs. PoET) under identical workload and seed.
   - Returns structured comparison table: Finality Latency (ms), Throughput (bps), Total Message Count, Byzantine Fault Tolerance limit, and Energy Index.

### 3.2 Machine Learning API (`backend/app/routers/ml.py`)
1. `GET /api/v1/ml/model-info`
   - Returns active model version, training timestamp, feature schema, evaluation metrics (MAE, RMSE, R², F1-score), and synthetic dataset provenance.
2. `POST /api/v1/ml/predict-eta`
   - Protected endpoint (requires Bearer JWT).
   - Accepts either explicit feature payload or `shipment_id`. If `shipment_id` is supplied, fetches current shipment details from PostgreSQL, computes elapsed transit time, active milestones, and lane characteristics.
   - Returns structured prediction:
     ```json
     {
       "shipment_id": 1,
       "predicted_remaining_hours": 14.5,
       "predicted_eta_timestamp": 1728045600,
       "delay_risk_probability": 0.18,
       "delay_risk_category": "LOW",
       "contributing_factors": [
         {"feature": "route_distance_km", "importance": 0.42, "value": 450},
         {"feature": "elapsed_transit_hours", "importance": 0.28, "value": 8.0}
       ],
       "caveat": "Decision-support estimate based on synthetic logistics training data. Not a contract commitment."
     }
     ```

---

## 4. DATABASE & MIGRATIONS

- Current database tables (`participants`, `shipments`, `documents`, `tracking_events`, `escrow_records`, `disputes`) cover all operational entities.
- Prediction history table `ml_predictions` can optionally record timestamp, shipment ID, predicted ETA, and model version for model auditability without disrupting existing tables.
- Alembic migration `add_ml_predictions_table` will be added cleanly if persistence is enabled.

---

## 5. FRONTEND INTEGRATION

1. **New Route: `/consensus` (`frontend/src/app/consensus/page.tsx`):**
   - Header with protocol selection tabs (PoW, PoS, PBFT, PoA, PoET).
   - Parameter control sliders (Node count, Faulty nodes, Workload, Network latency, Random seed).
   - Visual Node Network & Block Timeline component showing round progression, proposal validation, and vote tallying.
   - Multi-Protocol Comparison Matrix table.
2. **Shipment Detail Enhancement (`frontend/src/app/shipments/[id]/page.tsx`):**
   - Add **"AI Delivery Estimation (Decision Support)"** card in shipment details.
   - Visual badge for delay risk ("Low Risk", "Moderate Risk", "High Risk").
   - Estimated ETA arrival time with clear advisory caveat badge: *"Advisory ML prediction based on historical route patterns; does not alter contract terms or escrow."*

---

## 6. TESTING STRATEGY

1. **Simulator Unit Tests (`simulator/tests/`):**
   - Deterministic seed validation (same seed produces identical timeline and metrics).
   - Boundary checks: 0 nodes, faulty nodes >= 1/3 (PBFT quorum failure), invalid difficulties.
   - Quorum and consensus completion across PoW, PoS, PBFT, PoA, PoET.
   - Isolation check: verifies no web3 or contract calls occur.
2. **ML Pipeline Tests (`ml/tests/`):**
   - Dataset generation and schema validation (no NaNs, positive distances, non-leaking features).
   - Preprocessing and feature engineering consistency.
   - Model training, evaluation metrics computation, and joblib serialization.
   - Inference with unseen/out-of-bound inputs.
3. **Backend API Tests (`backend/tests/`):**
   - `/api/v1/consensus/models`, `/simulate`, and `/compare` endpoint validation.
   - `/api/v1/ml/model-info` and authenticated `/predict-eta` access control.
4. **Frontend Integration Tests (`frontend/`):**
   - Component rendering for Consensus Simulator and ML estimation cards.
   - Build verification with `npm run build`.
5. **Phase 0–4 Regression Suite:**
   - 108 Hardhat tests, 38 backend tests, 7 oracle tests.

---

## 7. FILES EXPECTED TO BE ADDED OR MODIFIED

* **Added:**
  * `docs/PHASE_5_IMPLEMENTATION_PLAN.md` (this file)
  * `docs/CONSENSUS_SIMULATOR.md`
  * `docs/ML_ETA_DELAY_PREDICTION.md`
  * `docs/PHASE_5_TESTING_AND_ACCEPTANCE.md`
  * `docs/PHASE_5_COMPLETION_REPORT.md`
  * `simulator/models/pow.py`, `pos.py`, `pbft.py`, `poa.py`, `poet.py`, `base.py`
  * `simulator/engine.py`, `schemas.py`, `metrics.py`
  * `simulator/tests/test_simulator_models.py`, `test_simulator_engine.py`
  * `ml/dataset.py`, `features.py`, `train.py`, `predict.py`, `schemas.py`
  * `ml/artifacts/` (model artifacts)
  * `ml/tests/test_dataset.py`, `test_pipeline.py`, `test_inference.py`
  * `backend/app/routers/consensus.py`
  * `backend/app/routers/ml.py`
  * `backend/tests/test_consensus_api.py`
  * `backend/tests/test_ml_api.py`
  * `frontend/src/app/consensus/page.tsx`
  * `frontend/src/components/ConsensusVisualizer.tsx`
  * `frontend/src/components/MLEtaPredictionCard.tsx`
* **Modified:**
  * `backend/main.py` (mount consensus and ml routers)
  * `frontend/src/components/Navbar.tsx` (add link to Consensus Simulator)
  * `frontend/src/app/shipments/[id]/page.tsx` (embed MLEtaPredictionCard)
  * `frontend/src/app/analytics/page.tsx` (embed consensus and ML summary link)
  * `docs/API_SPEC.md`, `README.md`, `docs/CHANGELOG.md`, `docs/TRACEABILITY_REPORT.md`

---

## 8. IMPLEMENTATION ORDER

1. **Stage 1:** Initial inspection & plan (Completed in this document).
2. **Stage 2:** Consensus simulator core engine & protocol models in `simulator/` with unit tests.
3. **Stage 3:** Consensus FastAPI router and Next.js `/consensus` page with visualizer.
4. **Stage 4:** ML synthetic dataset generator & feature engineering pipeline in `ml/`.
5. **Stage 5:** Model training, evaluation, and artifact serialization.
6. **Stage 6:** ML FastAPI prediction router and frontend shipment integration.
7. **Stage 7:** End-to-end integration and Phase 0–4 regression testing.
8. **Stage 8:** Documentation updates and final Phase 5 completion report.
