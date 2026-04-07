from fastapi import Security, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from starlette import status
from typing import Annotated, Dict, Any

from ..core.config import settings

# HTTPBearer automatically handles the 'header' extraction
bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Auth Dependency
# ---------------------------------------------------------------------------

def get_current_user_or_service(
    request: Request,
    auth: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> Dict[str, Any]:
    """
    Security Dependency:
    - Internal service: Bypass Clerk if 'X-Internal-Key' matches
    - Frontend/other: Validate Clerk JWT
    """

    # 1. Internal Service Bypass (all methods with valid X-Internal-Key)
    internal_key = request.headers.get("X-Internal-Key")
    if internal_key == settings.INTERNAL_API_KEY:
        return {"id": "service", "role": "internal", "authenticated": True}

    # 2. Standard Clerk JWT Validation
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token = auth.credentials

        # DUMMY VALIDATION PLACEHOLDER:
        # In production, verify 'token' with 'settings.CLERK_JWT_PUBLIC_KEY'
        # payload = jwt.decode(token, settings.CLERK_JWT_PUBLIC_KEY, algorithms=["RS256"])
        # return payload

        return {"id": "mock_clerk_id", "role": "user", "source": "frontend", "authenticated": True}

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# RBAC Dependencies
# ---------------------------------------------------------------------------

CurrentUser = Annotated[Dict[str, Any], Depends(get_current_user_or_service)]


def require_admin(user: CurrentUser) -> Dict[str, Any]:
    """
    RBAC guard: ensures the authenticated user holds the 'admin' role.
    The internal service bypass is also granted admin access for automation.
    """
    role = user.get("role", "")

    if role not in ("admin", "internal"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )

    return user
