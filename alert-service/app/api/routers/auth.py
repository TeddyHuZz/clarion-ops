from fastapi import APIRouter, Depends
from app.core.auth import verify_clerk_jwt

router = APIRouter()


@router.get("/me")
async def get_current_user(token_payload: dict = Depends(verify_clerk_jwt)):
    """
    Returns the authenticated user context from the Clerk JWT.
    """
    return {
        "user_id": token_payload.get("sub"),
        "email": token_payload.get("email"),
        "name": token_payload.get("name"),
    }
