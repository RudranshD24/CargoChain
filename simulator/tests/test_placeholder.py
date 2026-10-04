"""Scaffold and package metadata test for CargoChain Consensus Simulator."""

from simulator import __version__, get_supported_models


def test_simulator_package_metadata():
    """Verify package version and model registry."""
    assert __version__ == "0.2.0"
    models = get_supported_models()
    assert len(models) == 5
