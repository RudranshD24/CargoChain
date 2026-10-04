"""CargoChain backend configuration.

Loads settings from environment variables. P2 will expand with DB, IPFS
and chain settings. Uses pydantic-settings for validation.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Chain
    rpc_url: str = "http://127.0.0.1:8545"
    chain_id: int = 1337

    # Database
    database_url: str = "postgresql://cargochain:cargochain_dev@localhost:5432/cargochain"

    # JWT
    jwt_secret: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60

    # IPFS
    ipfs_api_url: str = "http://127.0.0.1:5001"

    # Upload
    max_upload_mb: int = 10

    # Deployment
    deployment_file: str = "deployments/local.json"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
