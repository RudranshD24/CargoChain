"""CargoChain ML — Model Training and Evaluation Pipeline.

Trains, evaluates, and serializes ETA regression and late delivery classification
models using Scikit-Learn. Saves artifacts to ml/artifacts/.
"""

import os
import json
import datetime
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.dummy import DummyRegressor, DummyClassifier
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)

from ml.dataset import generate_synthetic_dataset, get_train_test_split
from ml.features import encode_features, extract_targets, get_feature_names


ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")


def train_and_evaluate(num_samples: int = 1200, seed: int = 42):
    """Execute complete ML pipeline: data generation, training, evaluation, and serialization."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    # 1. Dataset generation & split
    records = generate_synthetic_dataset(num_samples=num_samples, seed=seed)
    train_records, test_records = get_train_test_split(records, test_ratio=0.2, seed=seed)

    X_train = encode_features(train_records)
    y_reg_train, y_cls_train = extract_targets(train_records)

    X_test = encode_features(test_records)
    y_reg_test, y_cls_test = extract_targets(test_records)

    feature_names = get_feature_names()

    # 2. Train ETA Regression Models
    dummy_reg = DummyRegressor(strategy="mean")
    dummy_reg.fit(X_train, y_reg_train)
    dummy_reg_preds = dummy_reg.predict(X_test)

    ridge_reg = Ridge(alpha=1.0)
    ridge_reg.fit(X_train, y_reg_train)

    rf_reg = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=seed)
    rf_reg.fit(X_train, y_reg_train)
    rf_reg_preds = rf_reg.predict(X_test)

    # Metrics for ETA Regression
    reg_metrics = {
        "baseline_mae": round(float(mean_absolute_error(y_reg_test, dummy_reg_preds)), 3),
        "mae_hours": round(float(mean_absolute_error(y_reg_test, rf_reg_preds)), 3),
        "rmse_hours": round(float(root_mean_squared_error(y_reg_test, rf_reg_preds)), 3),
        "r2_score": round(float(r2_score(y_reg_test, rf_reg_preds)), 3),
    }

    # 3. Train Delay Risk Classification Models
    dummy_cls = DummyClassifier(strategy="most_frequent")
    dummy_cls.fit(X_train, y_cls_train)

    log_cls = LogisticRegression(max_iter=1000, random_state=seed)
    log_cls.fit(X_train, y_cls_train)

    rf_cls = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=seed)
    rf_cls.fit(X_train, y_cls_train)
    rf_cls_preds = rf_cls.predict(X_test)
    rf_cls_probs = rf_cls.predict_proba(X_test)[:, 1]

    # Metrics for Delay Classification
    cls_metrics = {
        "accuracy": round(float(accuracy_score(y_cls_test, rf_cls_preds)), 3),
        "precision": round(float(precision_score(y_cls_test, rf_cls_preds, zero_division=0)), 3),
        "recall": round(float(recall_score(y_cls_test, rf_cls_preds, zero_division=0)), 3),
        "f1_score": round(float(f1_score(y_cls_test, rf_cls_preds, zero_division=0)), 3),
        "roc_auc": round(float(roc_auc_score(y_cls_test, rf_cls_probs)), 3),
    }

    # 4. Feature Importances
    importances = rf_reg.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    top_features = [
        {"feature": feature_names[i], "importance": round(float(importances[i]), 4)}
        for i in sorted_idx[:8]
    ]

    # 5. Metadata Bundle
    metadata = {
        "model_name": "CargoChain ETA & Delay Predictor",
        "model_version": "1.0.0",
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dataset_records": num_samples,
        "train_records": len(train_records),
        "test_records": len(test_records),
        "features": feature_names,
        "regression_metrics": reg_metrics,
        "classification_metrics": cls_metrics,
        "top_feature_importances": top_features,
        "data_provenance": "Fictional synthetic freight shipments generated with controlled environmental friction.",
    }

    # 6. Save Artifacts
    reg_path = os.path.join(ARTIFACTS_DIR, "cargochain_eta_regressor.joblib")
    cls_path = os.path.join(ARTIFACTS_DIR, "cargochain_delay_classifier.joblib")
    meta_path = os.path.join(ARTIFACTS_DIR, "model_metadata.json")

    joblib.dump(rf_reg, reg_path)
    joblib.dump(rf_cls, cls_path)
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return metadata


if __name__ == "__main__":
    result = train_and_evaluate()
    print("CargoChain ML Training Complete!")
    print(json.dumps(result, indent=2))
