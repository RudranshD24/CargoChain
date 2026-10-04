"""Inference and advisory prediction engine for CargoChain ML."""

import os
import json
import joblib
import numpy as np
from typing import Dict, Any, Optional

from ml.schemas import ShipmentFeatures, ETAPredictionResponse, FeatureImportance, MLModelInfoResponse
from ml.features import encode_features, get_feature_names
from ml.train import ARTIFACTS_DIR, train_and_evaluate


CAVEAT_NOTICE = (
    "Advisory decision-support estimate based on synthetic freight logistics training data. "
    "Predictions are informational only and do not alter on-chain smart contract state, "
    "trigger escrow release/penalties, or resolve disputes."
)

_REGRESSOR = None
_CLASSIFIER = None
_METADATA = None


def load_artifacts():
    """Lazy load or train artifacts if missing."""
    global _REGRESSOR, _CLASSIFIER, _METADATA
    reg_path = os.path.join(ARTIFACTS_DIR, "cargochain_eta_regressor.joblib")
    cls_path = os.path.join(ARTIFACTS_DIR, "cargochain_delay_classifier.joblib")
    meta_path = os.path.join(ARTIFACTS_DIR, "model_metadata.json")

    if not (os.path.exists(reg_path) and os.path.exists(cls_path) and os.path.exists(meta_path)):
        # Train once on first startup
        train_and_evaluate()

    if _REGRESSOR is None:
        _REGRESSOR = joblib.load(reg_path)
    if _CLASSIFIER is None:
        _CLASSIFIER = joblib.load(cls_path)
    if _METADATA is None:
        with open(meta_path, "r") as f:
            _METADATA = json.load(f)

    return _REGRESSOR, _CLASSIFIER, _METADATA


def get_model_info() -> MLModelInfoResponse:
    """Retrieve metadata about the active ML model."""
    _, _, meta = load_artifacts()
    return MLModelInfoResponse(
        model_name=meta["model_name"],
        model_version=meta["model_version"],
        trained_at=meta["trained_at"],
        dataset_records=meta["dataset_records"],
        train_records=meta["train_records"],
        test_records=meta["test_records"],
        features=meta["features"],
        regression_metrics=meta["regression_metrics"],
        classification_metrics=meta["classification_metrics"],
        data_provenance=meta["data_provenance"],
    )


def predict_shipment_eta(
    features: ShipmentFeatures,
    shipment_id: Optional[int] = None,
    current_timestamp: Optional[int] = None,
) -> ETAPredictionResponse:
    """Generate advisory ETA and delay risk prediction for a shipment."""
    regressor, classifier, meta = load_artifacts()

    # Convert Pydantic model to dict for feature encoder
    raw_dict = features.model_dump()
    X = encode_features([raw_dict])

    # 1. ETA Regression
    pred_remaining = float(regressor.predict(X)[0])
    pred_remaining = max(0.0, round(pred_remaining, 1))
    pred_total_duration = round(features.elapsed_transit_hours + pred_remaining, 1)

    # Calculate predicted timestamp if current timestamp provided
    pred_eta_ts = None
    if current_timestamp:
        pred_eta_ts = int(current_timestamp + (pred_remaining * 3600))

    # 2. Delay Classification
    delay_prob = float(classifier.predict_proba(X)[0][1])
    delay_prob = round(delay_prob, 2)
    is_delayed = delay_prob >= 0.50

    if delay_prob < 0.30:
        delay_category = "LOW"
    elif delay_prob < 0.65:
        delay_category = "MODERATE"
    else:
        delay_category = "HIGH"

    # 3. Contributing Factors
    feature_names = get_feature_names()
    importances = regressor.feature_importances_
    # Pick top contributing features that have non-zero presence
    top_indices = np.argsort(importances)[::-1][:4]
    factors = []
    for idx in top_indices:
        feat_name = feature_names[idx]
        factors.append(
            FeatureImportance(
                feature=feat_name,
                importance=round(float(importances[idx]), 3),
                value=raw_dict.get(feat_name, 1.0),
            )
        )

    # 4. Confidence Interval (residual RMSE based)
    rmse = meta["regression_metrics"].get("rmse_hours", 1.5)
    margin = round(1.645 * rmse, 1)  # ~90% confidence interval
    ci = {
        "lower_bound_hours": max(0.0, round(pred_remaining - margin, 1)),
        "upper_bound_hours": round(pred_remaining + margin, 1),
    }

    return ETAPredictionResponse(
        shipment_id=shipment_id,
        predicted_remaining_hours=pred_remaining,
        predicted_total_duration_hours=pred_total_duration,
        predicted_eta_timestamp=pred_eta_ts,
        delay_risk_probability=delay_prob,
        delay_risk_category=delay_category,
        is_delay_predicted=is_delayed,
        contributing_factors=factors,
        model_version=meta["model_version"],
        confidence_interval_hours=ci,
        caveat=CAVEAT_NOTICE,
    )
