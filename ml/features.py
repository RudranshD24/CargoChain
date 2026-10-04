"""Feature engineering and preprocessing pipeline for CargoChain ML."""

from typing import List, Dict, Any, Tuple
import numpy as np


NUMERIC_FEATURES = [
    "route_distance_km",
    "planned_duration_hours",
    "handling_transfers",
    "weather_risk_index",
    "traffic_congestion_index",
    "historical_lane_delay_rate",
    "milestones_completed",
    "elapsed_transit_hours",
]

CATEGORICAL_FEATURES = {
    "transport_mode": ["Road", "Air", "Rail", "Sea"],
    "cargo_type": ["General", "Perishable", "Hazardous", "Fragile"],
    "priority": ["Standard", "Express", "Urgent"],
}


def get_feature_names() -> List[str]:
    """Return ordered names of all encoded features in the feature matrix."""
    names = list(NUMERIC_FEATURES)
    for cat_name, categories in CATEGORICAL_FEATURES.items():
        for cat in categories:
            names.append(f"{cat_name}_{cat}")
    return names


def encode_features(records: List[Dict[str, Any]]) -> np.ndarray:
    """Encode raw records into 2D numeric feature matrix X."""
    X = []
    for r in records:
        row = []
        # Continuous numeric features
        for num_feat in NUMERIC_FEATURES:
            val = float(r.get(num_feat, 0.0))
            row.append(val)

        # Categorical one-hot features
        for cat_feat, categories in CATEGORICAL_FEATURES.items():
            curr_val = str(r.get(cat_feat, categories[0]))
            for cat in categories:
                row.append(1.0 if curr_val == cat else 0.0)

        X.append(row)

    return np.array(X, dtype=np.float32)


def extract_targets(records: List[Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray]:
    """Extract continuous remaining transit time target y_reg and binary delayed target y_cls."""
    y_reg = np.array([float(r["remaining_hours"]) for r in records], dtype=np.float32)
    y_cls = np.array([int(r["is_delayed"]) for r in records], dtype=np.int32)
    return y_reg, y_cls
