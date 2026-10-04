"""CargoChain ML — Synthetic Logistics Dataset Generator.

Generates deterministic, realistic freight transportation records for training
and evaluating ETA regression and delay classification models.
Adheres strictly to DATASET_PLAN.md §5 (Anti-leakage, reproducible seed).
"""

import random
from typing import List, Dict, Any, Tuple


CARGO_TYPES = ["General", "Perishable", "Hazardous", "Fragile"]
TRANSPORT_MODES = ["Road", "Air", "Rail", "Sea"]
PRIORITIES = ["Standard", "Express", "Urgent"]

# Average nominal operating transit speeds in km/h
NOMINAL_SPEEDS = {
    "Road": 65.0,
    "Air": 550.0,
    "Rail": 45.0,
    "Sea": 28.0,
}


def generate_synthetic_dataset(
    num_samples: int = 1200,
    seed: int = 42,
) -> List[Dict[str, Any]]:
    """Generate synthetic logistics shipment records with controlled noise."""
    rng = random.Random(seed)
    records = []

    for i in range(num_samples):
        shipment_id = i + 1
        mode = rng.choice(TRANSPORT_MODES)
        cargo = rng.choice(CARGO_TYPES)
        priority = rng.choice(PRIORITIES)

        # Distance distribution based on transport mode
        if mode == "Air":
            distance_km = rng.uniform(500.0, 4000.0)
        elif mode == "Sea":
            distance_km = rng.uniform(800.0, 5000.0)
        elif mode == "Rail":
            distance_km = rng.uniform(200.0, 2000.0)
        else:  # Road
            distance_km = rng.uniform(50.0, 1200.0)

        speed = NOMINAL_SPEEDS[mode]
        base_travel_hours = distance_km / speed

        # Planned duration includes standard operational buffer (15% - 30%)
        buffer_ratio = rng.uniform(1.15, 1.30)
        planned_duration_hours = base_travel_hours * buffer_ratio

        # Route operational features
        transfers = rng.randint(0, 3)
        weather_risk = round(rng.uniform(0.05, 0.95), 2)
        traffic_congestion = round(rng.uniform(0.05, 0.90), 2)
        lane_delay_rate = round(rng.uniform(0.05, 0.35), 2)

        # Active progress at observation point
        total_milestones = rng.randint(3, 6)
        milestones_done = rng.randint(0, total_milestones - 1)
        progress_ratio = milestones_done / total_milestones
        elapsed_hours = planned_duration_hours * progress_ratio * rng.uniform(0.9, 1.1)

        # Synthesize real transit outcome with environmental friction
        # Delays arise from weather, congestion, transfers, and lane fragility
        weather_delay = (weather_risk ** 2) * (planned_duration_hours * 0.20)
        traffic_delay = (traffic_congestion ** 1.5) * (planned_duration_hours * 0.15) if mode == "Road" else 0.0
        transfer_delay = transfers * rng.uniform(0.5, 2.5)
        lane_delay = rng.expovariate(1.0 / (lane_delay_rate * 5.0 + 0.1)) if rng.random() < lane_delay_rate else 0.0
        stochastic_noise = rng.gauss(0.0, 0.5)

        total_delay = max(0.0, weather_delay + traffic_delay + transfer_delay + lane_delay + stochastic_noise)
        actual_transit_hours = planned_duration_hours + total_delay
        remaining_hours = max(0.0, actual_transit_hours - elapsed_hours)

        # Binary late delivery definition: delayed by more than 1.5 hours past deadline
        is_delayed = 1 if total_delay > 1.5 else 0

        record = {
            "shipment_id": shipment_id,
            "route_distance_km": round(distance_km, 1),
            "planned_duration_hours": round(planned_duration_hours, 1),
            "cargo_type": cargo,
            "transport_mode": mode,
            "priority": priority,
            "handling_transfers": transfers,
            "weather_risk_index": weather_risk,
            "traffic_congestion_index": traffic_congestion,
            "historical_lane_delay_rate": lane_delay_rate,
            "milestones_completed": milestones_done,
            "elapsed_transit_hours": round(elapsed_hours, 1),
            # Targets (anti-leakage: targets excluded from input features)
            "remaining_hours": round(remaining_hours, 2),
            "actual_transit_hours": round(actual_transit_hours, 2),
            "delay_hours": round(total_delay, 2),
            "is_delayed": is_delayed,
        }
        records.append(record)

    return records


def get_train_test_split(
    records: List[Dict[str, Any]],
    test_ratio: float = 0.2,
    seed: int = 42,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Deterministically partition records into train and test sets."""
    rng = random.Random(seed)
    shuffled = list(records)
    rng.shuffle(shuffled)
    split_idx = int(len(shuffled) * (1.0 - test_ratio))
    return shuffled[:split_idx], shuffled[split_idx:]
