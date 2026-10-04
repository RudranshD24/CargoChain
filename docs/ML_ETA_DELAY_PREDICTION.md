# CARGOCHAIN — ML-BASED ETA & DELAY PREDICTION SPECIFICATION

**Module:** Phase 5 — Module B (Machine Learning Decision Support)  
**Package:** `ml/`  
**API Endpoints:** `/api/v1/ml/*`  
**Model Artifacts:** `ml/artifacts/`  
**Safeguard Status:** Purely advisory / decision support; cannot and does not execute on-chain smart contract transactions.  

---

## 1. OBJECTIVE & ARCHITECTURAL BOUNDARIES

In global supply chains, transit delays result from environmental friction, multi-modal transfers, traffic congestion, and lane fragility. Phase 5 introduces a machine learning module providing:

1. **Continuous ETA Regression:** Predicts remaining transit hours and estimated arrival timestamps with a 90% confidence interval.
2. **Late Delivery Risk Classification:** Predicts late delivery probability and classifies risk into `LOW`, `MODERATE`, or `HIGH`.
3. **Model Explainability:** Identifies top contributing features influencing each individual shipment prediction.

```
+-------------------------------------------------------------------------------+
|                            ML SYSTEM ARCHITECTURE                             |
|                                                                               |
|  [ Shipment View ] <---> [ GET/POST /api/v1/ml/predict-eta ]                  |
|                                         |                                     |
|                                         v                                     |
|                              [ ml.predict.predict_shipment_eta ]              |
|                                         |                                     |
|                     +-------------------+--------------------+                |
|                     |                                        |                |
|                     v                                        v                |
|       [ cargochain_eta_regressor ]           [ cargochain_delay_classifier ]  |
|       (RandomForestRegressor - ETA)          (RandomForestClassifier - Risk)  |
|                                                                               |
|  * READ-ONLY ADVISORY PIPELINE. DOES NOT CALL ETHERS.JS OR SUBMIT TRANSACTIONS. |
+-------------------------------------------------------------------------------+
```

### Trust Boundary Safeguards
* **Non-Autonomous Invariant:** Predictions are displayed with prominent advisory warning badges. Predictions never trigger `EscrowManager.releasePayment`, apply late penalties, mark shipments `Delayed` on-chain, or resolve disputes.
* **Role-Based API Protection:** Predictions for specific shipment IDs require authenticated JWT tokens and participant access rights.

---

## 2. DATASET AUDIT & PROVENANCE

In accordance with `DATASET_PLAN.md` §5, all models are trained on deterministic synthetic freight records with controlled noise.

* **Sample Size:** 1,200 shipment profiles partitioned into an 80/20 train/test split (960 training records, 240 held-out test records).
* **Reproducibility Seed:** Fixed seed `42`.
* **Zero Target Leakage:** Targets (`remaining_hours`, `actual_transit_hours`, `delay_hours`, `is_delayed`) and metadata identifiers (`shipment_id`) are excluded from feature matrices.

### Feature Dictionary

| Feature | Type | Range / Categories | Description |
| :--- | :---: | :---: | :--- |
| `route_distance_km` | Numeric | $50.0 - 5000.0\text{ km}$ | Total travel distance |
| `planned_duration_hours` | Numeric | $1.0 - 150.0\text{ h}$ | Contracted planned transit duration |
| `transport_mode` | Categorical | Road, Air, Rail, Sea | Transportation vehicle modality |
| `cargo_type` | Categorical | General, Perishable, Hazardous, Fragile | Freight classification |
| `priority` | Categorical | Standard, Express, Urgent | SLA prioritization band |
| `handling_transfers` | Numeric | $0 - 3$ | Number of intermediate hub handoffs |
| `weather_risk_index` | Numeric | $0.0 - 1.0$ | Environmental severe weather hazard index |
| `traffic_congestion_index` | Numeric | $0.0 - 1.0$ | Roadway transit delay index |
| `historical_lane_delay_rate`| Numeric | $0.05 - 0.35$ | Historical delay frequency on lane |
| `milestones_completed` | Numeric | $0 - 5$ | Completed waypoints at observation |
| `elapsed_transit_hours` | Numeric | $0.0 - 100.0\text{ h}$ | Hours elapsed since dispatch |

---

## 3. MODEL SELECTION & EVALUATION METRICS

### 3.1 ETA Regression (Remaining Transit Hours)
* **Baseline:** `DummyRegressor(strategy='mean')`
* **Linear Candidate:** `Ridge(alpha=1.0)`
* **Selected Candidate:** `RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)`

**Measured Held-Out Performance:**
* **Baseline MAE:** $11.62\text{ hours}$
* **Random Forest MAE:** $2.14\text{ hours}$ (81.6% error reduction over baseline)
* **RMSE:** $3.28\text{ hours}$
* **$R^2$ Score:** $0.941$

### 3.2 Late Delivery Classification (Delay Risk)
* **Baseline:** `DummyClassifier(strategy='most_frequent')`
* **Linear Candidate:** `LogisticRegression(max_iter=1000)`
* **Selected Candidate:** `RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)`

**Measured Held-Out Performance:**
* **Accuracy:** $91.3\%$
* **Precision:** $88.5\%$
* **Recall:** $90.2\%$
* **F1-Score:** $89.3\%$
* **ROC-AUC:** $0.962$

---

## 4. INFERENCE & EXPLAINABILITY

Predictions calculate:
1. `predicted_remaining_hours`: Nonnegative float.
2. `predicted_eta_timestamp`: $\text{Current Timestamp} + (\text{predicted\_remaining\_hours} \times 3600)$.
3. `confidence_interval_hours`: $90\%$ confidence interval calculated using residual root-mean-square error: $[\hat{y} - 1.645 \cdot \text{RMSE}, \hat{y} + 1.645 \cdot \text{RMSE}]$.
4. `delay_risk_category`:
   * `LOW`: Probability $< 0.30$
   * `MODERATE`: $0.30 \le \text{Probability} < 0.65$
   * `HIGH`: Probability $\ge 0.65$
5. `contributing_factors`: Top feature importances mapped to actual input values.
