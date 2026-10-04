"""CargoChain Machine Learning Package — ETA and Late Delivery Prediction.

Provides synthetic data generation, scikit-learn model training, evaluation,
and advisory decision-support inference.
"""

from ml.schemas import (
    ShipmentFeatures,
    ETAPredictionRequest,
    ETAPredictionResponse,
    MLModelInfoResponse,
)
from ml.predict import predict_shipment_eta, get_model_info
from ml.train import train_and_evaluate

__version__ = "0.2.0"

__all__ = [
    "ShipmentFeatures",
    "ETAPredictionRequest",
    "ETAPredictionResponse",
    "MLModelInfoResponse",
    "predict_shipment_eta",
    "get_model_info",
    "train_and_evaluate",
]
