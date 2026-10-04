"""Backend application metadata and configuration verification."""

from main import app


def test_fastapi_application_metadata_and_routes(client):
    """Verify application metadata, versioning, and health endpoint."""
    assert app.title == "CargoChain API"
    assert app.version == "0.1.0"

    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "cargochain-api"
