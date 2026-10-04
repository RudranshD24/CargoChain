"""Tests for ML ETA and Delay Prediction FastAPI endpoints."""

from tests.conftest import auth_header_for


def test_get_ml_model_info(client):
    """Verify GET /api/v1/ml/model-info returns metadata and evaluation metrics."""
    resp = client.get("/api/v1/ml/model-info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_name"] == "CargoChain ETA & Delay Predictor"
    assert data["model_version"] == "1.0.0"
    assert "mae_hours" in data["regression_metrics"]
    assert "accuracy" in data["classification_metrics"]


def test_post_predict_eta_unauthorized(client):
    """Verify POST /api/v1/ml/predict-eta requires authentication."""
    resp = client.post("/api/v1/ml/predict-eta", json={"shipment_id": 1})
    assert resp.status_code == 401


def test_post_predict_eta_authenticated(client, db_session, wallets):
    """Verify authenticated prediction returns structured advisory estimates."""
    headers = auth_header_for(client, db_session, wallets["shipper"], role=2)
    payload = {
        "features": {
            "route_distance_km": 500.0,
            "planned_duration_hours": 10.0,
            "cargo_type": "General",
            "transport_mode": "Road",
            "priority": "Standard",
            "handling_transfers": 1,
            "weather_risk_index": 0.2,
            "traffic_congestion_index": 0.3,
            "historical_lane_delay_rate": 0.15,
            "milestones_completed": 1,
            "elapsed_transit_hours": 2.5,
        }
    }
    resp = client.post("/api/v1/ml/predict-eta", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["predicted_remaining_hours"] >= 0.0
    assert 0.0 <= data["delay_risk_probability"] <= 1.0
    assert data["delay_risk_category"] in ["LOW", "MODERATE", "HIGH"]
    assert "caveat" in data
    assert len(data["contributing_factors"]) > 0


def test_post_predict_eta_with_shipment_id(client, db_session, wallets):
    """Verify prediction handles shipment_id reference."""
    headers = auth_header_for(client, db_session, wallets["shipper"], role=2)
    payload = {"shipment_id": 9999}  # Fallback approximation
    resp = client.post("/api/v1/ml/predict-eta", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["predicted_remaining_hours"] >= 0.0
