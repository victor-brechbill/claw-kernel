#!/bin/bash
# Gateway watchdog — auto-restart OpenClaw gateway on deadlock/unresponsive
#
# Detects when the gateway is truly unresponsive (no TCP connection at all)
# vs. merely returning an error code. Any HTTP response proves the process
# is alive; only connection failures/timeouts trigger a restart.
#
# Safety features:
#   - Boot grace period (default 120s) prevents restart loops during startup
#   - Consecutive failure threshold (default 3) prevents flapping on transient errors
#   - Failure counter resets on any successful HTTP response
#
# Setup:
#   chmod +x scripts/gateway-watchdog.sh
#   cp scripts/gateway-watchdog.sh ~/scripts/
#
# Cron (every 5 minutes):
#   */5 * * * * /home/YOUR-USERNAME/scripts/gateway-watchdog.sh >> /home/YOUR-USERNAME/logs/watchdog.log 2>&1
#
# Configuration (env vars):
#   WATCHDOG_TIMEOUT         - health check timeout in seconds (default: 30)
#   WATCHDOG_PORT            - gateway port (default: 18789)
#   WATCHDOG_SERVICE         - systemd service name (default: openclaw-gateway)
#   WATCHDOG_FAIL_THRESHOLD  - consecutive failures before restart (default: 3)
#   WATCHDOG_BOOT_GRACE      - seconds after boot to skip checks (default: 120)

set -euo pipefail

TIMEOUT="${WATCHDOG_TIMEOUT:-30}"
PORT="${WATCHDOG_PORT:-18789}"
SERVICE="${WATCHDOG_SERVICE:-openclaw-gateway}"
HEALTH_URL="http://localhost:${PORT}/"
FAIL_COUNT_FILE="/tmp/gateway-watchdog-failures"
# Require this many consecutive failures before restarting.
# At the default 5-minute cron interval, 3 failures = 15 minutes of downtime.
FAIL_THRESHOLD="${WATCHDOG_FAIL_THRESHOLD:-3}"
# Skip health checks for this many seconds after boot to allow gateway startup.
BOOT_GRACE="${WATCHDOG_BOOT_GRACE:-120}"

log() {
    echo "[$(date -Iseconds)] $*"
}

# Boot grace period: gateway needs time to start after a reboot.
# Without this, the watchdog can restart the gateway before it's ready,
# creating a restart loop.
UPTIME_SECS=$(awk '{print int($1)}' /proc/uptime)
if [ "$UPTIME_SECS" -lt "$BOOT_GRACE" ]; then
    log "INFO: Boot grace period (${UPTIME_SECS}s < ${BOOT_GRACE}s), skipping check"
    exit 0
fi

# Check if the service is supposed to be running
if ! systemctl --user is-enabled "$SERVICE" &>/dev/null; then
    # Service not enabled, nothing to watch
    exit 0
fi

# Check if the service process is running at all
if ! systemctl --user is-active "$SERVICE" &>/dev/null; then
    log "WARNING: $SERVICE is not running. Attempting to start..."
    systemctl --user start "$SERVICE"
    log "Started $SERVICE"
    exit 0
fi

# Health check with timeout.
# We use -s (silent) and check the HTTP status code. Any HTTP response (even
# 4xx/5xx) proves the gateway process is alive and listening. Only a connection
# failure (code 000) or timeout indicates a real problem like a deadlock.
HTTP_CODE=$(timeout "$TIMEOUT" curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ] || [ -z "$HTTP_CODE" ]; then
    # No HTTP response at all — gateway may be deadlocked or crashed
    FAILURES=$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0)
    FAILURES=$((FAILURES + 1))
    echo "$FAILURES" > "$FAIL_COUNT_FILE"

    if [ "$FAILURES" -ge "$FAIL_THRESHOLD" ]; then
        log "ALERT: Gateway unresponsive for $FAILURES consecutive checks. Restarting..."
        rm -f "$FAIL_COUNT_FILE"
        systemctl --user restart "$SERVICE"
        sleep 5

        # Verify restart succeeded
        VERIFY_CODE=$(timeout "$TIMEOUT" curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
        if [ "$VERIFY_CODE" != "000" ] && [ -n "$VERIFY_CODE" ]; then
            log "Gateway restarted successfully (HTTP $VERIFY_CODE)."
        else
            log "ERROR: Gateway still unresponsive after restart. Manual intervention may be needed."
            exit 1
        fi
    else
        log "WARNING: Gateway not responding ($FAILURES/$FAIL_THRESHOLD failures)"
    fi
else
    # Gateway responded (HTTP $HTTP_CODE) — it's alive, reset counter
    rm -f "$FAIL_COUNT_FILE"
fi
