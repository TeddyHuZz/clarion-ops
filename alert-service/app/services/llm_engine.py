"""
LLM Engine — Groq-powered Root Cause Analysis
==============================================
Provides async integration with Groq's LLM API to analyze
Prometheus alerts, pod logs, and deployment events for
automated root cause analysis.
"""

import json
import logging
from typing import Any

from groq import AsyncGroq

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Groq Client Initialization
# ---------------------------------------------------------------------------


def _get_groq_client() -> AsyncGroq:
    """
    Initialize and return an async Groq client.
    Raises ValueError if GROQ_API_KEY is not configured.
    """
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY environment variable is not set. "
            "LLM-powered RCA cannot function without it."
        )
    return AsyncGroq(api_key=api_key)


# ---------------------------------------------------------------------------
# Default Fallback Response
# ---------------------------------------------------------------------------

DEFAULT_FALLBACK: dict[str, Any] = {
    "root_cause_summary": "AI analysis failed due to an unexpected error. Human review required.",
    "confidence_score": 0,
    "recommended_action": "escalate",
}

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are an elite Level 1 Site Reliability Engineer. Your job is to analyze "
    "incoming Prometheus alerts, recent pod logs, and deployment events to determine "
    "the root cause of a failure. You MUST respond strictly in valid JSON format. "
    "Do not include Markdown blocks, greetings, or explanations outside the JSON."
)

# ---------------------------------------------------------------------------
# Core RCA Function
# ---------------------------------------------------------------------------


async def run_groq_rca(ai_context_payload: dict[str, Any]) -> dict[str, Any]:
    """
    Send enriched incident context to Groq's llama3-70b-8192 model for
    Root Cause Analysis.

    Args:
        ai_context_payload: Enriched incident data including alert details,
                            pod logs, and deployment history.

    Returns:
        A dictionary with keys:
            - root_cause_summary (str): Concise 2-sentence explanation.
            - confidence_score (int): 0-100 certainty level.
            - recommended_action (str): One of "rollback", "restart", "escalate".
    """
    service_name = ai_context_payload.get("service_name", "unknown")
    logger.info(
        "[groq-rca] Starting RCA analysis for service=%s, incident_id=%s",
        service_name,
        ai_context_payload.get("incident_id"),
    )

    user_prompt = (
        f"Analyze this data. Output a JSON object with exactly three keys: "
        f"root_cause_summary (a concise 2-sentence explanation), "
        f"confidence_score (an integer between 0 and 100 representing how certain you are), "
        f"and recommended_action (must be exactly one of these three strings: "
        f'"rollback", "restart", or "escalate").\n\n'
        f"Context:\n{json.dumps(ai_context_payload, indent=2, default=str)}"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    try:
        client = _get_groq_client()

        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.1,
            max_tokens=512,
        )

        raw_content = response.choices[0].message.content
        if raw_content is None:
            logger.error("[groq-rca] Groq returned empty content.")
            return DEFAULT_FALLBACK

        # Strip any accidental markdown code fences
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[-2] if cleaned.count("```") >= 2 else cleaned
        if cleaned.startswith("```json"):
            cleaned = cleaned[len("```json") :]
        cleaned = cleaned.strip()

        result = json.loads(cleaned)

        # Validate required keys
        required_keys = {"root_cause_summary", "confidence_score", "recommended_action"}
        if not required_keys.issubset(result.keys()):
            logger.error(
                "[groq-rca] Response missing required keys. Got: %s",
                list(result.keys()),
            )
            return DEFAULT_FALLBACK

        # Validate recommended_action
        valid_actions = {"rollback", "restart", "escalate"}
        if result["recommended_action"] not in valid_actions:
            logger.warning(
                "[groq-rca] Invalid recommended_action='%s', defaulting to 'escalate'",
                result["recommended_action"],
            )
            result["recommended_action"] = "escalate"

        # Validate confidence_score is an integer 0-100
        score = result["confidence_score"]
        if not isinstance(score, int) or not (0 <= score <= 100):
            logger.warning(
                "[groq-rca] Invalid confidence_score=%s, defaulting to 0",
                score,
            )
            result["confidence_score"] = 0

        logger.info(
            "[groq-rca] Analysis complete for service=%s — confidence=%d, action=%s",
            service_name,
            result["confidence_score"],
            result["recommended_action"],
        )
        return result

    except json.JSONDecodeError as exc:
        logger.error(
            "[groq-rca] Failed to parse Groq response as JSON: %s — Raw: %s",
            exc,
            raw_content[:200] if "raw_content" in dir() else "N/A",
        )
        return DEFAULT_FALLBACK

    except ValueError as exc:
        logger.error("[groq-rca] Configuration error: %s", exc)
        return DEFAULT_FALLBACK

    except Exception as exc:
        logger.exception("[groq-rca] Unexpected error during RCA analysis: %s", exc)
        return DEFAULT_FALLBACK
