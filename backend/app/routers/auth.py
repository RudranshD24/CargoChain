"""Authentication routes for CargoChain API."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import User
from app.schemas import (
    NonceRequest,
    NonceResponse,
    LoginRequest,
    LoginResponse,
    UserProfileResponse,
    ROLE_NAMES,
)
from app.services.auth import (
    create_auth_nonce,
    verify_signature_and_login,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/nonce", response_model=NonceResponse)
def get_nonce(body: NonceRequest, db: Session = Depends(get_db)):
    """Generate a single-use login nonce for the specified wallet address."""
    return create_auth_nonce(db, body.address)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Verify wallet signature and return JWT."""
    return verify_signature_and_login(db, body.address, body.signature)
