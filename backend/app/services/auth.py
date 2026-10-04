"""Authentication service: nonce generation, signature verification, and JWT management."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.entities import User, AuthNonce
from app.services.blockchain import get_contract_instance, w3

security = HTTPBearer(auto_error=False)

ROLE_NAMES = {
    0: "None",
    1: "Admin",
    2: "Shipper",
    3: "Transporter",
    4: "Warehouse",
    5: "Inspector",
    6: "Receiver",
    7: "Oracle",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_address(address: str) -> str:
    """Validate EVM address and return lowercased 0x... format."""
    try:
        checksum = Web3.to_checksum_address(address)
        return checksum.lower()
    except Exception:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "VALIDATION_ERROR", "message": f"Invalid EVM address: {address}"}},
        )


def create_auth_nonce(db: Session, address: str) -> Dict[str, Any]:
    """Generate a single-use nonce for wallet signature."""
    norm_addr = normalize_address(address)
    nonce_val = uuid.uuid4().hex
    expires_at = utcnow() + timedelta(minutes=5)

    message = (
        f"Sign this message to authenticate with CargoChain:\n"
        f"Wallet: {Web3.to_checksum_address(norm_addr)}\n"
        f"Nonce: {nonce_val}\n"
        f"Issued At: {utcnow().isoformat()}\n"
        f"Expires At: {expires_at.isoformat()}"
    )

    nonce_record = AuthNonce(
        wallet_address=norm_addr,
        nonce=nonce_val,
        message=message,
        expires_at=expires_at,
    )
    db.add(nonce_record)
    db.commit()
    db.refresh(nonce_record)

    return {
        "nonce": nonce_val,
        "message": message,
        "expiresAt": expires_at.isoformat(),
    }


def verify_signature_and_login(db: Session, address: str, signature: str) -> Dict[str, Any]:
    """Verify personal_sign signature against active nonce, check role, and issue JWT."""
    norm_addr = normalize_address(address)

    # Find the latest unused, unexpired nonce for this address
    nonce_record = (
        db.query(AuthNonce)
        .filter(
            AuthNonce.wallet_address == norm_addr,
            AuthNonce.used_at.is_(None),
            AuthNonce.expires_at > utcnow(),
        )
        .order_by(AuthNonce.created_at.desc())
        .first()
    )

    if not nonce_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": "No active, unused nonce found for this address"}},
        )

    # Verify signature
    try:
        encoded_msg = encode_defunct(text=nonce_record.message)
        recovered_addr = Account.recover_message(encoded_msg, signature=signature)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": f"Invalid signature format: {str(e)}"}},
        )

    if recovered_addr.lower() != norm_addr:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": "Signature does not match the claiming wallet address"}},
        )

    # Mark nonce used atomically
    nonce_record.used_at = utcnow()
    db.commit()

    # Determine participant role and active status
    user = db.query(User).filter(User.wallet_address == norm_addr).first()
    
    # If not in DB yet, query on-chain ParticipantRegistry if node is connected
    role = user.role if user else 0
    is_active = user.is_active if user else True

    if user is None:
        try:
            if w3.is_connected():
                registry = get_contract_instance("ParticipantRegistry")
                if registry:
                    chain_role = registry.functions.roleOf(Web3.to_checksum_address(norm_addr)).call()
                    chain_active = registry.functions.isActive(Web3.to_checksum_address(norm_addr)).call()
                    user = User(
                        wallet_address=norm_addr,
                        role=chain_role,
                        is_active=chain_active,
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                    role = chain_role
                    is_active = chain_active
        except Exception:
            pass

    if not is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Participant account is revoked or inactive"}},
        )

    # Generate JWT
    expiry_seconds = settings.jwt_expiry_minutes * 60
    exp_time = utcnow() + timedelta(seconds=expiry_seconds)

    payload = {
        "sub": norm_addr,
        "role": role,
        "role_name": ROLE_NAMES.get(role, "Unknown"),
        "iat": int(utcnow().timestamp()),
        "exp": int(exp_time.timestamp()),
    }

    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    return {
        "token": token,
        "role": role,
        "roleName": ROLE_NAMES.get(role, "Unknown"),
        "expiresIn": expiry_seconds,
        "address": norm_addr,
    }


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: decode and validate JWT, verify user is active."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": "Missing Authorization header"}},
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": "Token has expired"}},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": f"Invalid token: {str(e)}"}},
        )

    wallet_address = payload.get("sub")
    if not wallet_address:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHENTICATED", "message": "Token missing subject (wallet address)"}},
        )

    # Verify user state from DB
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    if not user:
        # Create user record from token payload if first time
        user = User(
            wallet_address=wallet_address,
            role=payload.get("role", 0),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "User account has been revoked"}},
        )

    return user


def require_roles(*allowed_roles: int):
    """Dependency factory: require current user to have one of the allowed roles (or Admin)."""
    def role_checker(user: User = Depends(get_current_user)) -> User:
        # Admin (role 1) always has access
        if user.role == 1 or user.role in allowed_roles:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": f"Role {ROLE_NAMES.get(user.role, user.role)} not authorized for this action"}},
        )
    return role_checker
