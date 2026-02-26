#!/bin/bash
# Gateway watchdog — auto-restart OpenClaw gateway on deadlock/unresponsive
# Checks the health endpoint with a configurable timeout
#
# Setup:
#   chmod +x scripts/gateway-watchdog.sh
#   cp scripts/gateway-watchdog.sh ~/scripts/
#
# Cron (every 5 minutes):
#   */5 * * * * /home/YOUR-USERNAME/scripts/gateway-watchdog.sh >> /home/YOUR-USERNAME/logs/watchdog.log 2>&1
#
# Configuration:
#   WATCHDOG_TIMEOUT  - health check timeout in seconds (default: 30)
#   WATCHDOG_PORT     - gateway port (default: 18789)
#   WATCHDOG_SERVICE  - systemd service name (default: openclaw-gateway)

set -euo pipefail

TIMEOUT="${WATCHDOG_TIMEOUT:-30}"
PORT="${WATCHDOG_PORT:-18789}"
SERVICE="${WATCHDOG_SERVICE:-openclaw-gateway}"
HEALTH_URL="http://localhost:${PORT}/health"

log() {
    echo "[$(date -Iseconds)] $*"
}

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

# Health check with timeout
if ! timeout "$TIMEOUT" curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "ALERT: Gateway unresponsive (no response within ${TIMEOUT}s). Restarting..."
    systemctl --user restart "$SERVICE"
    sleep 3

    # Verify restart succeeded
    if timeout "$TIMEOUT" curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log "Gateway restarted successfully."
    else
        log "ERROR: Gateway still unresponsive after restart. Manual intervention may be needed."
        exit 1
    fi
fi
