"""Pydantic schemas for CargoChain ML ETA and Delay Prediction."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ShipmentFeatures(BaseModel):
    """Features provided at prediction time for a shipment."""
    route_distance_km: float = Field(..., ge=10.0, le=10000.0, description="Total route distance in km")
    planned_duration_hours: float = Field(..., ge=1.0, le=500.0, description="Planned total transit duration in hours")
    cargo_type: str = Field(default="General", description="General, Perishable, Hazardous, Fragile")
    transport_mode: str = Field(default="Road", description="Road, Air, Rail, Sea")
    priority: str = Field(default="Standard", description="Standard, Express, Urgent")
    handling_transfers: int = Field(default=1, ge=0, le=10, description="Number of waypoint/warehouse transfers")
    weather_risk_index: float = Field(default=0.2, ge=0.0, le=1.0, description="Simulated weather hazard index")
    traffic_congestion_index: float = Field(default=0.3, ge=0.0, le=1.0, description="Simulated road congestion index")
    historical_lane_delay_rate: float = Field(default=0.15, ge=0.0, le=1.0, description="Lane historical delay frequency")
    milestones_completed: int = Field(default=1, ge=0, le=10, description="Number of completed route waypoints")
    elapsed_transit_hours: float = Field(default=2.0, ge=0.0, description="Hours elapsed since dispatch")


class ETAPredictionRequest(BaseModel):
    """API request for ETA and delay prediction."""
    shipment_id: Optional[int] = Field(default=None, description="Optional DB shipment ID to auto-populate features")
    features: Optional[ShipmentFeatures] = Field(default=None, description="Explicit feature vector if shipment_id not provided")


class FeatureImportance(BaseModel):
    feature: str
    importance: float
    value: Any


class ETAPredictionResponse(BaseModel):
    """Structured response from the prediction engine."""
    shipment_id: Optional[int] = None
    predicted_remaining_hours: float
    predicted_total_duration_hours: float
    predicted_eta_timestamp: Optional[int] = None
    delay_risk_probability: float
    delay_risk_category: str  # "LOW", "MODERATE", "HIGH"
    is_delay_predicted: bool
    contributing_factors: List[FeatureImportance]
    model_version: str
    confidence_interval_hours: Dict[str, float]
    caveat: str


class MLModelInfoResponse(BaseModel):
    """Metadata regarding active trained models and data provenance."""
    model_name: str
    model_version: str
    trained_at: str
    dataset_records: int
    train_records: int
    test_records: int
    features: List[str]
    regression_metrics: Dict[str, float]  # MAE, RMSE, R2
    classification_metrics: Dict[str, float]  # Accuracy, Precision, Recall, F1
    data_provenance: str
