"""Clerk RBAC administration endpoints.

Provides admin-only endpoints to list users and manage their roles
via the Clerk Management API.
"""

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import AdminUser, require_admin

router = APIRouter()


# ---------------------------------------------------------------------------
# Clerk Management API Client
# ---------------------------------------------------------------------------


async def _clerk_request(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    """Send a request to the Clerk Management API."""
    from app.core.config import settings

    url = f"{settings.CLERK_API_URL}{path}"
    headers = {
        "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.request(method, url, headers=headers, **kwargs)

        if not resp.is_success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Clerk API error ({resp.status_code}): {resp.text[:200]}",
            )

        return resp.json()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[dict[str, Any]])
async def list_users(
    _admin: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> list[dict[str, Any]]:
    """
    Fetch all registered users from the Clerk Management API.

    Requires the requester's JWT to contain public_metadata.role == 'admin'.
    Internal service calls are also permitted.

    Response is trimmed to essential fields to minimize payload size.
    """
    data = await _clerk_request("GET", "/users")

    # Trim the response to only useful fields
    return [
        {
            "id": user.get("id"),
            "email_addresses": [
                email.get("email_address") for email in user.get("email_addresses", [])
            ],
            "username": user.get("username"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "role": user.get("public_metadata", {}).get("role", "user"),
            "created_at": user.get("created_at"),
            "last_active_at": user.get("last_active_at"),
            "last_sign_in_at": user.get("last_sign_in_at"),
            "banned": user.get("banned", False),
        }
        for user in data
    ]


class RoleUpdatePayload:
    """Accepted values for the role field."""

    VALID_ROLES = {"admin", "user"}


@router.patch("/users/{target_user_id}/role", response_model=dict[str, Any])
async def update_user_role(
    target_user_id: str,
    role: str,
    requester: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """
    Update a user's role in Clerk by modifying their public_metadata.

    Requires the requester's JWT to contain public_metadata.role == 'admin'.
    Internal service calls are also permitted.

    Args:
        target_user_id: The Clerk user ID (e.g. "user_2abc...")
        role: The new role — must be one of: 'admin', 'user'

    Returns:
        The updated user's id and new role.
    """
    if role not in RoleUpdatePayload.VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{role}'. Must be one of: {RoleUpdatePayload.VALID_ROLES}",
        )

    # Clerk's update user endpoint accepts public_metadata in the body
    payload = {"public_metadata": {"role": role}}

    result = await _clerk_request("PATCH", f"/users/{target_user_id}", json=payload)

    return {
        "id": result.get("id"),
        "role": result.get("public_metadata", {}).get("role", role),
        "status": "updated",
    }
