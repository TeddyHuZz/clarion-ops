#!/usr/bin/env python3
"""
Test the post-rollback health verification pipeline.

Usage:
    python3 test_health_validator.py

This script:
  1. Sends a test webhook to trigger the full AI → rollback pipeline
  2. Verifies the incident status transitions to "Verifying"
  3. Watches the alert-service logs for the health validator output
  4. (Optional) Shows you what to expect during the 5-minute poll cycle
"""

import asyncio
import json
import os
import sys
import time

import httpx

BASE_URL = "http://localhost:8004"
DATA_URL = "http://localhost:8002"


async def trigger_test_incident() -> int | None:
    """Send a test webhook and return the incident ID."""
    payload = {
        "alerts": [{
            "labels": {
                "alertname": "TestHealthValidation",
                "severity": "critical",
                "service": "api-gateway",
                "pod": "api-gateway-test-abc123",
            },
            "annotations": {"summary": "Test: health validator integration"},
        }]
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/api/v1/webhooks/alertmanager",
            json=payload,
        )

    data = resp.json()
    print(f"  Webhook response: {data}")

    if data.get("alerts_queued", 0) < 1:
        print("  ❌ No alerts queued — pipeline not triggered")
        return None

    # Wait for the incident to be created
    await asyncio.sleep(2)

    # Fetch the latest incident to get its ID
    # We need auth for data-service, so check logs instead
    return True  # Pipeline triggered successfully


async def check_incident_status(incident_id: int) -> str | None:
    """Poll the incident status to see if it transitions to 'Verifying'."""
    # This requires auth — skip for now and check logs instead
    pass


async def watch_logs():
    """Tail the alert-service logs and look for health validator output."""
    import subprocess

    print("\n📋 Watching alert-service logs for health validator activity...")
    print("   (Press Ctrl+C to stop)\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "logs", "-f", "--tail", "5", "alert-service",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace").strip()

            # Highlight health validator lines
            if "[health-validator]" in text:
                print(f"  🔍 {text}")
            elif "[ai-orchestrator]" in text and "Verifying" in text:
                print(f"  ✅ {text}")
            elif "[ai-orchestrator]" in text:
                print(f"     {text}")
    except asyncio.CancelledError:
        pass
    except KeyboardInterrupt:
        pass


async def main():
    print("=" * 60)
    print("Health Validator Integration Test")
    print("=" * 60)

    # Step 1: Trigger the pipeline
    print("\n📡 Step 1: Sending test webhook...")
    result = await trigger_test_incident()

    if not result:
        print("\n❌ Test failed — webhook was not processed")
        sys.exit(1)

    print("  ✅ Webhook accepted and queued")

    # Step 2: Check if the pipeline reached "Verifying"
    print("\n🔍 Step 2: Checking alert-service logs for 'Verifying' status...")
    await asyncio.sleep(8)  # Wait for RCA + rollback

    proc = await asyncio.create_subprocess_exec(
        "docker", "logs", "--tail", "30", "alert-service",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output = await proc.stdout.read()
    logs = output.decode("utf-8", errors="replace")

    if "Verifying" in logs:
        print("  ✅ Incident status set to 'Verifying'")
        print("  ✅ Health validator task spawned in background")
    elif "Rollback succeeded" in logs or "Rollback" in logs:
        print("  ✅ Rollback executed")
        print("  ⚠️  Check if 'Verifying' status appears (may need more time)")
    else:
        print("  ⚠️  No rollback activity detected yet")
        print("     This may mean Groq returned non-rollback or confidence ≤ 85")

    # Step 3: Show the health validator lifecycle
    print("\n" + "=" * 60)
    print("What happens next:")
    print("=" * 60)
    print("""
  The health validator is now running in the background:

  1. It polls metrics-service every 10 seconds for 5 minutes
  2. It checks if the pod state == "Running" AND restart count is stable
  3. After 3 consecutive stable checks → marks "Resolved" + Slack alert
  4. If timeout (5 min) without stability → marks "Manual Intervention"

  To watch it in real-time:
      docker logs -f alert-service | grep health-validator

  To check the current incident status:
      docker-compose exec timescaledb psql -U admin -d guardian_data \\
        -c "SELECT id, status, time FROM incident_events ORDER BY id DESC LIMIT 3;"

  To check audit logs:
      docker-compose exec timescaledb psql -U admin -d guardian_data \\
        -c "SELECT * FROM incident_logs ORDER BY id DESC LIMIT 10;"
    """)

    # Step 4: Ask if user wants to watch live
    print("-" * 60)
    print("Watch live health validator logs? (Ctrl+C to stop)")
    print("-" * 60)

    try:
        await watch_logs()
    except KeyboardInterrupt:
        print("\n  Stopped watching logs.")


if __name__ == "__main__":
    asyncio.run(main())
