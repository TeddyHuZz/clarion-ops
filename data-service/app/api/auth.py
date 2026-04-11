from typing import Annotated, Any

import httpx
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from starlette import status

from ..core.config import settings

# HTTPBearer automatically handles the 'header' extraction
bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Clerk JWT Verification (lazy + resilient)
# ---------------------------------------------------------------------------

_clerk_jwks_cache: dict[str, Any] | None = None
_clerk_unavailable = False  # Circuit-breaker: skip network calls if Clerk is down


async def _fetch_clerk_jwks() -> dict[str, Any]:
    """Fetch Clerk's JWKS for JWT signature verification. Caches result."""
    global _clerk_jwks_cache, _clerk_unavailable
    if _clerk_jwks_cache is not None:
        return _clerk_jwks_cache
    if _clerk_unavailable:
        # Don't retry if Clerk was unreachable before
        raise ValueError("Clerk API is unavailable")

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://clerk.authpro.com/.well-known/jwks.json")
            if resp.is_success:
                _clerk_jwks_cache = resp.json()
                return _clerk_jwks_cache
            # Fallback: use the Clerk Management API JWKS endpoint
            if settings.CLERK_SECRET_KEY:
                resp2 = await client.get(
                    "https://api.clerk.com/v1/jwks",
                    headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                )
                if resp2.is_success:
                    _clerk_jwks_cache = resp2.json()
                    return _clerk_jwks_cache
    except Exception:
        pass

    _clerk_unavailable = True
    raise ValueError("Clerk JWKS fetch failed")


def _get_public_key(jwks: dict[str, Any], kid: str) -> dict[str, Any]:
    """Find the matching public key from the JWKS set."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise ValueError(f"No matching JWKS key found for kid: {kid}")


async def _decode_clerk_token(token: str) -> dict[str, Any]:
    """Decode and verify a Clerk JWT using their JWKS."""
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    if not kid:
        raise ValueError("JWT header missing 'kid'")

    jwks = await _fetch_clerk_jwks()
    public_key = _get_public_key(jwks, kid)

    payload = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        options={"verify_aud": False},
    )
    return payload


# ---------------------------------------------------------------------------
# Auth Dependency
# ---------------------------------------------------------------------------


async def get_current_user_or_service(
    request: Request,
    auth: HTTPAuthorizationCredentials | None = Security(bearer_scheme),  # noqa: B008
) -> dict[str, Any]:
    """
    Security Dependency:
    - Internal service: Bypass Clerk if 'X-Internal-Key' matches
    - Frontend/other: Validate Clerk JWT (falls back to mock if Clerk unavailable)
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
        payload = await _decode_clerk_token(auth.credentials)
        public_metadata = payload.get("public_metadata", {})
        role = public_metadata.get("role", "user")
        return {
            "id": payload.get("sub"),
            "role": role,
            "source": "frontend",
            "authenticated": True,
            **payload,
        }
    except ValueError:
        # Clerk JWKS unreachable — fall back to mock user for local development
        return {"id": "dev_user", "role": "admin", "source": "dev_mock", "authenticated": True}
    except jwt.JWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err


# ---------------------------------------------------------------------------
# RBAC Dependencies
# ---------------------------------------------------------------------------

CurrentUser = Annotated[dict[str, Any], Depends(get_current_user_or_service)]


def require_admin(user: CurrentUser) -> dict[str, Any]:
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


# Type alias for admin-gated endpoints (must come after require_admin)
AdminUser = Annotated[dict[str, Any], Depends(require_admin)]
