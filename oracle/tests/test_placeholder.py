"""Oracle package and service configuration verification."""

from oracle import __version__
from oracle.service import OracleService, ORACLE_DEFAULT_ADDRESS, check_geofence


def test_oracle_package_and_service_configuration():
    """Verify oracle package version, default service address, and geofence helper."""
    assert __version__ == "0.1.0"
    service = OracleService()
    assert service.address.lower() == ORACLE_DEFAULT_ADDRESS.lower()
    assert check_geofence(28613900, 77209000, 28613900, 77209000, 500) is True
