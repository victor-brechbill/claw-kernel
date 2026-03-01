#!/bin/bash
# rollback-config.sh — Restore most recent config and auth-profiles backups
#
# What it does:
#   Finds the newest timestamped backup of openclaw.json and
#   auth-profiles.json, saves a pre-rollback snapshot of the current
#   files, then restores from backup and restarts the gateway.
#
# When to use:
#   When a config or auth-profiles change broke authentication or
#   gateway behaviour and you need to revert to the last known-good state.
#
# Usage:
#   ./scripts/rollback-config.sh

set -euo pipefail

CONFIG_DIR="$HOME/.openclaw"
AUTH_DIR="$HOME/.openclaw/agents/main/agent"

OPENCLAW_CONF="$CONFIG_DIR/openclaw.json"
AUTH_CONF="$AUTH_DIR/auth-profiles.json"

echo "=== OpenClaw Config Rollback ==="

# ── Find best backup for a given base path ────────────────────────────────────
find_best_backup() {
  local base="$1"
  # Newest timestamped backup first
  local latest
  latest=$(ls -t "${base}.backup-"* 2>/dev/null | head -1 || true)
  if [ -n "$latest" ]; then
    echo "$latest"
    return
  fi
  # Fall back to .bak
  [ -f "${base}.bak" ] && echo "${base}.bak" && return
  echo ""
}

OC_BAK=$(find_best_backup "$OPENCLAW_CONF")
AUTH_BAK=$(find_best_backup "$AUTH_CONF")

if [ -z "$OC_BAK" ] && [ -z "$AUTH_BAK" ]; then
  echo "❌ No config backups found."
  echo "   Expected: $OPENCLAW_CONF.backup-* or $AUTH_CONF.backup-*"
  exit 1
fi

echo "Backups found:"
[ -n "$OC_BAK"   ] && echo "  openclaw.json     ← $(basename "$OC_BAK")"
[ -n "$AUTH_BAK" ] && echo "  auth-profiles.json ← $(basename "$AUTH_BAK")"

# ── Safety snapshot of current state ─────────────────────────────────────────
STAMP=$(date +%Y%m%d-%H%M%S)
echo ""
echo "Saving pre-rollback snapshot..."
cp "$OPENCLAW_CONF" "$OPENCLAW_CONF.pre-rollback-$STAMP" 2>/dev/null \
  && echo "  saved openclaw.json.pre-rollback-$STAMP"
cp "$AUTH_CONF" "$AUTH_CONF.pre-rollback-$STAMP" 2>/dev/null \
  && echo "  saved auth-profiles.json.pre-rollback-$STAMP"

# ── Stop gateway ──────────────────────────────────────────────────────────────
echo ""
echo "1. Stopping gateway..."
systemctl --user stop openclaw-gateway.service 2>/dev/null || true
pkill -9 -f openclaw 2>/dev/null || true
sleep 3

# ── Restore configs ───────────────────────────────────────────────────────────
echo "2. Restoring configs..."
if [ -n "$OC_BAK" ]; then
  cp "$OC_BAK" "$OPENCLAW_CONF"
  echo "   ✅ openclaw.json restored from $(basename "$OC_BAK")"
fi
if [ -n "$AUTH_BAK" ]; then
  cp "$AUTH_BAK" "$AUTH_CONF"
  echo "   ✅ auth-profiles.json restored from $(basename "$AUTH_BAK")"
fi

# ── Restart gateway ───────────────────────────────────────────────────────────
echo "3. Restarting gateway..."
systemctl --user start openclaw-gateway.service
sleep 5

echo ""
echo "✅ Config rollback complete."
echo "   Pre-rollback snapshots saved as .pre-rollback-$STAMP if you need to undo."
