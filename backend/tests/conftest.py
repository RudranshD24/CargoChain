import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "TEST_SECRET_KEY_FOR_CARGOCHAIN_12345"

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.entities import User
from main import app

# In-memory SQLite for high-speed isolated tests
TEST_DB_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database tables for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient that overrides get_db dependency with testing db_session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def wallets():
    """Deterministically generated test keypairs."""
    return {
        "admin": Account.from_key("0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"),
        "shipper": Account.from_key("0x6cbed15c793ce57650b9877cf5bab64c38d4249d3732153b31346ecb4742ec29"),
        "transporter": Account.from_key("0x6370fd033278c143033d34f77426b3da60e5ed3ba53ce0fad74f30959441f3db"),
        "receiver": Account.from_key("0x646f1ce2fd01a89c51e6e7f3ca8194332d5b9babad5043279f22263a8d7cb150"),
        "warehouse": Account.from_key("0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743"),
        "inspector": Account.from_key("0x39592477d2c6e436e9a3966e440865c17f3e737327d8bfd80ecd0e5edfa7e12f"),
        "outsider": Account.from_key("0xea6c44ac03be858b34d357b2b6870b5635d52b16127424d9c7e0b8a42398f4ad"),
    }


def auth_header_for(client: TestClient, db_session, account, role: int = 0, is_active: bool = True) -> dict:
    """Helper: register user in DB, sign nonce, login and return Authorization header."""
    addr = account.address.lower()
    user = db_session.query(User).filter(User.wallet_address == addr).first()
    if not user:
        user = User(
            wallet_address=addr,
            role=role,
            is_active=is_active,
        )
        db_session.add(user)
        db_session.commit()
    else:
        user.role = role
        user.is_active = is_active
        db_session.commit()

    # 1. Get nonce
    nonce_resp = client.post("/api/v1/auth/nonce", json={"address": account.address})
    assert nonce_resp.status_code == 200, nonce_resp.text
    msg_to_sign = nonce_resp.json()["message"]

    # 2. Sign message
    encoded = encode_defunct(text=msg_to_sign)
    signed = account.sign_message(encoded)
    sig_hex = signed.signature.hex()

    # 3. Login
    login_resp = client.post("/api/v1/auth/login", json={"address": account.address, "signature": sig_hex})
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["token"]

    return {"Authorization": f"Bearer {token}"}
