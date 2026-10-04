"""Tests for authentication and authorization service (FR-AUTH-01, FR-AUTH-02)."""

from datetime import datetime, timedelta, timezone
from eth_account.messages import encode_defunct
from app.models.entities import AuthNonce, User
from tests.conftest import auth_header_for


def test_nonce_issuance_valid_address(client, wallets):
    addr = wallets["shipper"].address
    resp = client.post("/api/v1/auth/nonce", json={"address": addr})
    assert resp.status_code == 200
    data = resp.json()
    assert "nonce" in data
    assert "message" in data
    assert "expiresAt" in data
    assert addr.lower() in data["message"].lower()


def test_nonce_issuance_invalid_address(client):
    resp = client.post("/api/v1/auth/nonce", json={"address": "invalid-address"})
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_login_successful(client, wallets, db_session):
    account = wallets["shipper"]
    addr = account.address

    # Pre-register user in DB
    user = User(wallet_address=addr.lower(), role=2, is_active=True)
    db_session.add(user)
    db_session.commit()

    # Request nonce
    nonce_resp = client.post("/api/v1/auth/nonce", json={"address": addr})
    msg = nonce_resp.json()["message"]

    # Sign message
    sig = account.sign_message(encode_defunct(text=msg)).signature.hex()

    # Login
    login_resp = client.post("/api/v1/auth/login", json={"address": addr, "signature": sig})
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "token" in data
    assert data["role"] == 2
    assert data["roleName"] == "Shipper"
    assert data["address"] == addr.lower()


def test_login_invalid_signature(client, wallets):
    account = wallets["shipper"]
    different_account = wallets["transporter"]
    addr = account.address

    nonce_resp = client.post("/api/v1/auth/nonce", json={"address": addr})
    msg = nonce_resp.json()["message"]

    # Sign with wrong private key
    wrong_sig = different_account.sign_message(encode_defunct(text=msg)).signature.hex()

    login_resp = client.post("/api/v1/auth/login", json={"address": addr, "signature": wrong_sig})
    assert login_resp.status_code == 401
    assert login_resp.json()["error"]["code"] == "UNAUTHENTICATED"


def test_login_replay_nonce_fails(client, wallets):
    account = wallets["shipper"]
    addr = account.address

    nonce_resp = client.post("/api/v1/auth/nonce", json={"address": addr})
    msg = nonce_resp.json()["message"]
    sig = account.sign_message(encode_defunct(text=msg)).signature.hex()

    # First login succeeds
    first_resp = client.post("/api/v1/auth/login", json={"address": addr, "signature": sig})
    assert first_resp.status_code == 200

    # Second login with same nonce must be rejected (single-use)
    second_resp = client.post("/api/v1/auth/login", json={"address": addr, "signature": sig})
    assert second_resp.status_code == 401
    assert second_resp.json()["error"]["code"] == "UNAUTHENTICATED"


def test_login_expired_nonce_fails(client, wallets, db_session):
    account = wallets["shipper"]
    addr = account.address.lower()

    # Insert already expired nonce directly
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    nonce_rec = AuthNonce(
        wallet_address=addr,
        nonce="expired_nonce_123",
        message="Sign message",
        expires_at=expired_time,
    )
    db_session.add(nonce_rec)
    db_session.commit()

    sig = account.sign_message(encode_defunct(text="Sign message")).signature.hex()
    resp = client.post("/api/v1/auth/login", json={"address": addr, "signature": sig})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


def test_login_revoked_participant_forbidden(client, wallets, db_session):
    account = wallets["shipper"]
    addr = account.address.lower()

    # Register as revoked / inactive
    user = User(wallet_address=addr, role=2, is_active=False)
    db_session.add(user)
    db_session.commit()

    nonce_resp = client.post("/api/v1/auth/nonce", json={"address": addr})
    msg = nonce_resp.json()["message"]
    sig = account.sign_message(encode_defunct(text=msg)).signature.hex()

    resp = client.post("/api/v1/auth/login", json={"address": addr, "signature": sig})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


def test_protected_endpoints_auth_enforcement(client):
    # Missing header
    resp = client.get("/api/v1/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"

    # Malformed header
    resp2 = client.get("/api/v1/me", headers={"Authorization": "Bearer invalid_garbage_token"})
    assert resp2.status_code == 401
    assert resp2.json()["error"]["code"] == "UNAUTHENTICATED"


def test_get_me_profile(client, wallets, db_session):
    headers = auth_header_for(client, db_session, wallets["shipper"], role=2)

    resp = client.get("/api/v1/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["address"] == wallets["shipper"].address.lower()
    assert data["role"] == 2
    assert data["roleName"] == "Shipper"
    assert data["isActive"] is True


def test_jwt_expired_token_rejected(client, wallets, db_session):
    import jwt
    from app.config import settings

    addr = wallets["shipper"].address.lower()
    # Create expired token
    expired_payload = {
        "sub": addr,
        "role": 2,
        "role_name": "Shipper",
        "iat": int(datetime.now(timezone.utc).timestamp()) - 3600,
        "exp": int(datetime.now(timezone.utc).timestamp()) - 1800,
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    resp = client.get("/api/v1/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"
    assert "expired" in resp.json()["error"]["message"].lower()


def test_subsequently_revoked_participant_token_rejected_on_api(client, wallets, db_session):
    # User gets token while active
    headers = auth_header_for(client, db_session, wallets["shipper"], role=2)
    resp = client.get("/api/v1/me", headers=headers)
    assert resp.status_code == 200

    # User is revoked in DB (e.g. by on-chain event ParticipantRevoked indexer projection)
    user = db_session.query(User).filter(User.wallet_address == wallets["shipper"].address.lower()).first()
    user.is_active = False
    db_session.commit()

    # Subsequent request using the previously issued JWT must be rejected with 403
    resp_revoked = client.get("/api/v1/me", headers=headers)
    assert resp_revoked.status_code == 403
    assert resp_revoked.json()["error"]["code"] == "FORBIDDEN"
    assert "revoked" in resp_revoked.json()["error"]["message"].lower()
