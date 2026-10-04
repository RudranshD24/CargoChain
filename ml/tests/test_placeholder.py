"""Package metadata test for CargoChain ML."""

from ml import __version__, get_model_info


def test_ml_package_metadata():
    """Verify ML package version and model metadata."""
    assert __version__ == "0.2.0"
    info = get_model_info()
    assert info.model_version == "1.0.0"
