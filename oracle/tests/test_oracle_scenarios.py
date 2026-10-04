"""Unit tests for Oracle Service and Route Scenarios (FR-ORC-01..03)."""

import pytest
from oracle.service import (
    check_geofence,
    generate_scenario_waypoints,
    OracleService,
    ORACLE_DEFAULT_ADDRESS,
)


def test_geofence_calculation():
    """Verify microdegree-based geofence calculation logic (1m ≈ 9 microdegrees)."""
    dest_lat = 28613900  # New Delhi
    dest_lon = 77209000
    radius_m = 1000  # 1000 meters = 9000 microdegrees radius

    # Exactly at destination
    assert check_geofence(dest_lat, dest_lon, dest_lat, dest_lon, radius_m) is True

    # 100m away (approx 900 microdegrees): inside geofence
    assert check_geofence(dest_lat + 900, dest_lon, dest_lat, dest_lon, radius_m) is True
    assert check_geofence(dest_lat, dest_lon + 900, dest_lat, dest_lon, radius_m) is True

    # 800m away diagonally: (7200^2 + 0^2) < 9000^2: inside
    assert check_geofence(dest_lat + 6000, dest_lon + 6000, dest_lat, dest_lon, radius_m) is True

    # 2000m away (18,000 microdegrees): outside geofence
    assert check_geofence(dest_lat + 18000, dest_lon, dest_lat, dest_lon, radius_m) is False
    assert check_geofence(dest_lat, dest_lon + 18000, dest_lat, dest_lon, radius_m) is False

    # 50km away: clearly outside
    assert check_geofence(dest_lat + 450000, dest_lon + 450000, dest_lat, dest_lon, radius_m) is False


def test_generate_scenario_normal():
    """Verify normal scenario produces 4 progressive waypoints ending within geofence."""
    dest_lat = 28613900
    dest_lon = 77209000
    radius_m = 1000

    waypoints = generate_scenario_waypoints("normal", dest_lat, dest_lon, radius_m)
    assert len(waypoints) == 4

    # Steps 1-3 are InTransit
    for wp in waypoints[:3]:
        assert wp["action"] == "waypoint"
        assert wp["milestone_type"] == 1
        assert wp["expect_revert"] is False

    # Final step is Arrived within geofence
    final = waypoints[3]
    assert final["action"] == "waypoint"
    assert final["milestone_type"] == 3
    assert check_geofence(final["lat"], final["lon"], dest_lat, dest_lon, radius_m) is True
    assert final["expect_revert"] is False


def test_generate_scenario_delayed():
    """Verify delayed scenario produces an explicit delay action."""
    dest_lat = 28613900
    dest_lon = 77209000

    waypoints = generate_scenario_waypoints("delayed", dest_lat, dest_lon, 1000)
    assert len(waypoints) == 4

    # Step 2 is delay action
    assert waypoints[1]["action"] == "delay"
    assert "Weather hazard" in waypoints[1]["note"]

    # Final step is Arrived
    assert waypoints[3]["milestone_type"] == 3


def test_generate_scenario_deviated():
    """Verify deviated scenario includes off-corridor waypoint and arrival attempt with expect_revert."""
    dest_lat = 28613900
    dest_lon = 77209000
    radius_m = 1000

    waypoints = generate_scenario_waypoints("deviated", dest_lat, dest_lon, radius_m)
    assert len(waypoints) == 4

    # Step 2 is deviated off-route
    step2 = waypoints[1]
    assert check_geofence(step2["lat"], step2["lon"], dest_lat, dest_lon, radius_m) is False

    # Step 3 attempts arrival outside geofence (expect_revert=True)
    step3 = waypoints[2]
    assert step3["milestone_type"] == 3
    assert step3["expect_revert"] is True
    assert check_geofence(step3["lat"], step3["lon"], dest_lat, dest_lon, radius_m) is False

    # Step 4 corrects route and arrives within geofence
    step4 = waypoints[3]
    assert step4["milestone_type"] == 3
    assert step4["expect_revert"] is False
    assert check_geofence(step4["lat"], step4["lon"], dest_lat, dest_lon, radius_m) is True


def test_invalid_scenario_type():
    with pytest.raises(ValueError):
        generate_scenario_waypoints("hyperjump", 1000, 1000, 500)


def test_oracle_service_account():
    """Verify OracleService initializes with designated restricted Oracle account."""
    svc = OracleService()
    assert svc.address.lower() == ORACLE_DEFAULT_ADDRESS.lower()
    status = svc.get_status()
    assert status["oracleAddress"].lower() == ORACLE_DEFAULT_ADDRESS.lower()
