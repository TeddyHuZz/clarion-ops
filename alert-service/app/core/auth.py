from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError, JWTClaimsError
from httpx import AsyncClient
from typing import Optional

from app.core.config import settings

security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# JWKS cache — fetch once and reuse across requests
# ---------------------------------------------------------------------------
_jwks_cache: Optional[dict] = None


async def _fetch_jwks() -> dict:
    """Retrieve the public JWKS from Clerk."""
    global _jwks_cache
    if _jwks_cache is None:
        async with AsyncClient() as client:
            resp = await client.get(settings.CLERK_JWKS_URL, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


# ---------------------------------------------------------------------------
# Dependency — verifies a Clerk JWT and returns the decoded payload
# ---------------------------------------------------------------------------
async def verify_clerk_jwt(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    Placeholder Clerk JWT verification dependency.

    Usage in a router:
        from app.core.auth import verify_clerk_jwt

        @router.get("/protected")
        async def protected_route(token_payload: dict = Depends(verify_clerk_jwt)):
            user_id = token_payload.get("sub")
            ...

    When running locally without Clerk, set `Clerk-Bypass: true` header
    (or disable auth entirely for internal endpoints).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is missing",
        )

    token = credentials.credentials

    try:
        jwks = await _fetch_jwks()

        # jose expects a dict with 'keys' for algorithm discovery
        unverified_headers = jwt.get_unverified_header(token)
        kid = unverified_headers.get("kid")

        # Find matching key
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break

        if key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find matching signing key",
            )

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.CLERK_JWT_ISSUER.split("/.well-known")[0] if "/.well-known" in settings.CLERK_JWT_ISSUER else settings.CLERK_JWT_ISSUER,
            issuer=settings.CLERK_JWT_ISSUER,
        )
        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except JWTClaimsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    except HTTPException:
        raise
