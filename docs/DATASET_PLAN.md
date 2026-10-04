# DATASET_PLAN

## 1. Purpose

Provide deterministic, synthetic logistics records for local demonstrations, analytics, oracle scenarios and optional delay-prediction experiments. Do not use real customer, shipment or personally identifying data.

## 2. Data principles

- Synthetic data only; fixed seed and documented generator version.
- Use clearly fictional organizations, addresses and shipment references.
- Keep private keys and real wallet credentials out of generated fixtures.
- Chain fixtures must be generated through deployed contracts and signed local test accounts.
- Clearly separate generated oracle reports from measured real-world telemetry.

## 3. MVP seed dataset

Seed a small, readable dataset first: at least one shipment per main lifecycle outcome needed by the demo (created, accepted, in transit, delivered/completed, rejected/cancelled where feasible), multiple participant roles, several milestones, two document types and escrow examples. Keep seed records stable across repeated runs. The generator must report counts and transaction hashes.

## 4. Advanced route scenarios

| Scenario | Behavior | Expected demonstration |
|---|---|---|
| `normal` | Waypoints progress at configured interval | InTransit → Arrived → Delivered |
| `delayed` | Progress is slowed or expected time is exceeded | Delay report and Delayed state |
| `deviated` | One waypoint is outside the planned route/geofence | Deviation is displayed and audited; arrival is not falsely inferred |

Use a fixed seed and bounded number of waypoints. The oracle service must stop cleanly and must not write arbitrary shipment states.

## 5. Optional ML dataset

Candidate synthetic features: route distance, planned transit duration, shipment quantity band, number of handling transfers, weather-risk category (synthetic only), origin/destination region category and historical synthetic lane delay rate. Label `delayed` using a documented deterministic rule with controlled noise. Prevent target leakage: do not include post-delivery values as predictive features.

Split data by shipment or generated scenario, not by duplicated event rows. Use a fixed seed for train/test split. Compare logistic regression with a majority-class baseline; a gradient-boosting model is optional. Report class balance, F1, ROC-AUC where defined, and MAE for delay days. Do not claim real-world predictive validity from synthetic data.

## 6. Data validation

Check required fields, enum membership, coordinate bounds, timestamp ordering, unique external references, positive quantities, nonnegative amounts, stable seed behavior and no secrets. Record generator version, seed, row counts and checksum in evaluation output.
