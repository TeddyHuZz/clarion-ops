from fastapi import Security, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from starlette import status

from ..core.config import settings

# HTTPBearer automatically handles the 'header' extraction
bearer_scheme = HTTPBearer()

def get_current_user_or_service(
    request: Request,
    auth: HTTPAuthorizationCredentials = Security(bearer_scheme)
):
    """
    Security Dependency:
    - POST methods: Bypass Clerk if 'X-Internal-Key' matches settings.INTERNAL_API_KEY
    - GET methods: Validate Clerk JWT
    - Other/Frontend fallback: Require Clerk JWT
    """
    
    # 1. Internal Service Bypass (Typically for POST/PUT)
    internal_key = request.headers.get("X-Internal-Key")
    if request.method == "POST" and internal_key == settings.INTERNAL_API_KEY:
        return {"id": "service", "role": "internal", "authenticated": True}
    
    # 2. Standard Clerk JWT Validation (Typically for GET/Frontend)
    try:
        # Placeholder for real JWT validation using Clerk's public key
        # In production, use standard library to verify 'auth.credentials'
        # with 'settings.CLERK_JWT_PUBLIC_KEY' (JWS signing check)
        
        token = auth.credentials
        
        # DUMMY VALIDATION PLACEHOLDER: 
        # In dev, we often just check if the string exists.
        if not token:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bearer token missing or invalid",
            )
            
        # Example Decoding: 
        # payload = jwt.decode(token, settings.CLERK_JWT_PUBLIC_KEY, algorithms=["RS256"])
        # return payload
        
        return {"id": "mock_clerk_id", "source": "frontend", "authenticated": True}

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
