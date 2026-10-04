"""Participant management and profile endpoints."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import User
from app.schemas import (
    UserProfileResponse,
    ProfileUpdateRequest,
    ParticipantItem,
    ROLE_NAMES,
)
from app.services.auth import (
    get_current_user,
    require_roles,
    normalize_address,
)

router = APIRouter(tags=["participants"])


@router.get("/me", response_model=UserProfileResponse)
def get_me(user: User = Depends(get_current_user)):
    """Return the profile and role of the currently authenticated wallet."""
    return UserProfileResponse(
        address=user.wallet_address,
        role=user.role,
        roleName=ROLE_NAMES.get(user.role, "Unknown"),
        displayName=user.display_name,
        orgName=user.org_name,
        isActive=user.is_active,
    )


@router.get("/participants", response_model=List[ParticipantItem])
def list_participants(
    admin: User = Depends(require_roles(1)),  # Admin only
    db: Session = Depends(get_db),
):
    """List all registered participants (Admin only)."""
    users = db.query(User).order_by(User.id.asc()).all()
    return [
        ParticipantItem(
            address=u.wallet_address,
            role=u.role,
            roleName=ROLE_NAMES.get(u.role, "Unknown"),
            displayName=u.display_name,
            orgName=u.org_name,
            isActive=u.is_active,
            registeredBlock=u.registered_block,
        )
        for u in users
    ]


@router.patch("/participants/{address}/profile", response_model=ParticipantItem)
def update_participant_profile(
    address: str,
    body: ProfileUpdateRequest,
    admin: User = Depends(require_roles(1)),  # Admin only
    db: Session = Depends(get_db),
):
    """Update off-chain display name or organization name for a participant (Admin only)."""
    norm_addr = normalize_address(address)
    user = db.query(User).filter(User.wallet_address == norm_addr).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Participant with address {address} not found"}},
        )

    if body.displayName is not None:
        user.display_name = body.displayName
    if body.orgName is not None:
        user.org_name = body.orgName

    db.commit()
    db.refresh(user)

    return ParticipantItem(
        address=user.wallet_address,
        role=user.role,
        roleName=ROLE_NAMES.get(user.role, "Unknown"),
        displayName=user.display_name,
        orgName=user.org_name,
        isActive=user.is_active,
        registeredBlock=user.registered_block,
    )
