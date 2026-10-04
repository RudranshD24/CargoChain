"""Unit tests for CargoChain ML ETA and Delay Prediction package."""

import pytest
import numpy as np
from ml import (
    ShipmentFeatures,
    predict_shipment_eta,
    get_model_info,
    train_and_evaluate,
)
from ml.dataset import generate_synthetic_dataset, get_train_test_split
from ml.features import encode_features, extract_targets, get_feature_names, NUMERIC_FEATURES


def test_dataset_generation_and_schema():
    """Verify synthetic dataset produces valid records with correct keys and bounds."""
    records = generate_synthetic_dataset(num_samples=100, seed=42)
    assert len(records) == 100

    first = records[0]
    required_keys = [
        "route_distance_km",
        "planned_duration_hours",
        "cargo_type",
        "transport_mode",
        "priority",
        "handling_transfers",
        "weather_risk_index",
        "traffic_congestion_index",
        "historical_lane_delay_rate",
        "milestones_completed",
        "elapsed_transit_hours",
        "remaining_hours",
        "is_delayed",
    ]
    for key in required_keys:
        assert key in first

    # Value sanity
    assert first["route_distance_km"] > 0
    assert 0.0 <= first["weather_risk_index"] <= 1.0
    assert first["is_delayed"] in (0, 1)


def test_no_target_leakage_in_features():
    """Verify that targets are strictly excluded from the predictor feature set."""
    feature_names = get_feature_names()
    forbidden_targets = [
        "remaining_hours",
        "actual_transit_hours",
        "delay_hours",
        "is_delayed",
        "shipment_id",
    ]
    for target in forbidden_targets:
        assert target not in feature_names


def test_feature_encoding_shape_and_cleanliness():
    """Verify encoded feature matrix has expected dimensions and zero NaNs."""
    records = generate_synthetic_dataset(num_samples=50, seed=99)
    X = encode_features(records)
    y_reg, y_cls = extract_targets(records)

    assert X.shape[0] == 50
    assert X.shape[1] == len(get_feature_names())
    assert not np.isnan(X).any()
    assert len(y_reg) == 50
    assert len(y_cls) == 50


def test_model_training_and_serialization():
    """Verify full training pipeline produces valid models and metrics."""
    meta = train_and_evaluate(num_samples=300, seed=42)
    assert meta["model_version"] == "1.0.0"
    assert "mae_hours" in meta["regression_metrics"]
    assert "accuracy" in meta["classification_metrics"]
    # Model should beat baseline on regression
    assert meta["regression_metrics"]["mae_hours"] < meta["regression_metrics"]["baseline_mae"]


def test_advisory_prediction_inference():
    """Verify inference produces structured response with advisory caveats."""
    features = ShipmentFeatures(
        route_distance_km=450.0,
        planned_duration_hours=10.0,
        cargo_type="Perishable",
        transport_mode="Road",
        priority="Express",
        handling_transfers=1,
        weather_risk_index=0.3,
        traffic_congestion_index=0.4,
        historical_lane_delay_rate=0.15,
        milestones_completed=2,
        elapsed_transit_hours=4.0,
    )
    pred = predict_shipment_eta(features, shipment_id=101, current_timestamp=1728000000)

    assert pred.shipment_id == 101
    assert pred.predicted_remaining_hours >= 0.0
    assert 0.0 <= pred.delay_risk_probability <= 1.0
    assert pred.delay_risk_category in ["LOW", "MODERATE", "HIGH"]
    assert "Advisory decision-support estimate" in pred.caveat
    assert len(pred.contributing_factors) > 0
    assert pred.confidence_interval_hours["lower_bound_hours"] <= pred.predicted_remaining_hours


def test_model_info_endpoint_data():
    """Verify model metadata returns valid provenance and feature lists."""
    info = get_model_info()
    assert info.model_name == "CargoChain ETA & Delay Predictor"
    assert len(info.features) > 10
    assert "synthetic" in info.data_provenance.lower()
