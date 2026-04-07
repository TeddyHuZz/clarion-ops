"""
Slack ChatOps Notifier
======================
Sends formatted incident alerts to a Slack channel via Incoming Webhook.
Uses Slack's Block Kit for rich, structured messages.
"""

import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Severity → visual indicator mapping
# ---------------------------------------------------------------------------
_SEVERITY_ICONS: dict[str, str] = {
    "critical": "🚨",
    "warning": "⚠️",
    "info": "ℹ️",
}


def _build_slack_payload(incident_data: dict[str, Any]) -> dict[str, Any]:
    """
    Construct a Slack Block Kit payload from raw incident data.

    Expected keys in *incident_data* (fallbacks provided):
        service_name  — affected service
        severity      — critical | warning | info
        title / status / description — optional context
    """
    service_name = incident_data.get("service_name", "unknown-service")
    severity = (incident_data.get("severity", "info") or "").lower()
    icon = _SEVERITY_ICONS.get(severity, "📢")

    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    # --- Header section ---
    header_text = f"{icon}  *Incident Alert — {service_name}*"

    # --- Fields block (two-column layout) ---
    fields = [
        {"type": "mrkdwn", "text": f"*Service*\n{service_name}"},
        {"type": "mrkdwn", "text": f"*Severity*\n{severity.upper()}"},
        {"type": "mrkdwn", "text": f"*Time*\n{timestamp}"},
    ]

    # Optional context fields
    if incident_data.get("status"):
        fields.append({"type": "mrkdwn", "text": f"*Status*\n{incident_data['status']}"})
    if incident_data.get("title"):
        fields.append({"type": "mrkdwn", "text": f"*Title*\n{incident_data['title']}"})

    # --- Divider + description ---
    blocks: list[dict[str, Any]] = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": header_text},
        },
        {"type": "divider"},
        {
            "type": "section",
            "fields": fields,
        },
    ]

    if incident_data.get("description"):
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Details*\n{incident_data['description']}"},
            }
        )

    # --- Footer with clarion branding ---
    blocks.append(
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Posted by _Clarion Ops Alert Service_ • {timestamp}"}
            ],
        }
    )

    return {"blocks": blocks}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def send_slack_alert(incident_data: dict[str, Any]) -> bool:
    """
    Post an incident alert to the configured Slack Incoming Webhook.

    Returns ``True`` on successful delivery, ``False`` on any failure.
    Failures are logged but **never** raised — this function must not
    crash the calling application.
    """
    webhook_url = settings.SLACK_WEBHOOK_URL
    if not webhook_url:
        logger.warning("[slack-notifier] SLACK_WEBHOOK_URL not configured — skipping notification")
        return False

    payload = _build_slack_payload(incident_data)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            resp.raise_for_status()

        logger.info(
            "[slack-notifier] Alert sent to Slack for service=%s severity=%s",
            incident_data.get("service_name"),
            incident_data.get("severity"),
        )
        return True

    except httpx.TimeoutException:
        logger.error("[slack-notifier] Timeout while sending Slack alert")
    except httpx.HTTPStatusError as exc:
        logger.error(
            "[slack-notifier] Slack responded with HTTP %s — %s",
            exc.response.status_code,
            exc.response.text[:200],
        )
    except httpx.RequestError as exc:
        logger.error("[slack-notifier] Network error sending Slack alert: %s", exc)
    except Exception:
        logger.exception("[slack-notifier] Unexpected error sending Slack alert")

    return False
