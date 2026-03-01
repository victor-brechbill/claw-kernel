#!/bin/bash
# rollforward-config.sh — Undo a config rollback by restoring the pre-rollback snapshot
#
# What it does:
#   Finds the most recent .pre-rollback-* snapshot created by
#   rollback-config.sh and restores it, effectively undoing the rollback.
#   The current config is saved before overwriting so this operation
#   is itself reversible.
#
# When to use:
#   When a config rollback made things worse (e.g., overwrote fresh
#   OAuth tokens with stale ones) and you want to return to the state
#   that existed before the rollback.
#
# Usage:
#   ./scripts/rollforward-config.sh

set -euo pipefail

CONFIG_DIR="$HOME/.openclaw"
AUTH_DIR="$HOME/.openclaw/agents/main/agent"

OPENCLAW_CONF="$CONFIG_DIR/openclaw.json"
AUTH_CONF="$AUTH_DIR/auth-profiles.json"

echo "=== OpenClaw Config Roll Forward (Undo Rollback) ==="

# ── Find most recent pre-rollback snapshot ────────────────────────────────────
find_latest_prerollback() {
  local base="$1"
  ls -t "${base}.pre-rollback-"* 2>/dev/null | head -1 || true
}

OC_PREROLLBACK=$(find_latest_prerollback "$OPENCLAW_CONF")
AUTH_PREROLLBACK=$(find_latest_prerollback "$AUTH_CONF")

if [ -z "$OC_PREROLLBACK" ] && [ -z "$AUTH_PREROLLBACK" ]; then
  echo "❌ No pre-rollback snapshots found."
  echo "   Nothing to roll forward to. This command only works after a rollback."
  exit 1
fi

echo "Pre-rollback snapshots found:"
[ -n "$OC_PREROLLBACK"   ] && echo "  openclaw.json     ← $(basename "$OC_PREROLLBACK")"
[ -n "$AUTH_PREROLLBACK" ] && echo "  auth-profiles.json ← $(basename "$AUTH_PREROLLBACK")"

echo ""
echo "This will RESTORE the config that existed before the last rollback."
echo "Current config will be saved as .backup-rollforward-<timestamp>"
echo ""

# ── Safety snapshot of current state ─────────────────────────────────────────
STAMP=$(date +%Y%m%d-%H%M%S)
echo "Saving current state..."
cp "$OPENCLAW_CONF" "$OPENCLAW_CONF.backup-rollforward-$STAMP" 2>/dev/null \
  && echo "  saved openclaw.json.backup-rollforward-$STAMP"
cp "$AUTH_CONF" "$AUTH_CONF.backup-rollforward-$STAMP" 2>/dev/null \
  && echo "  saved auth-profiles.json.backup-rollforward-$STAMP"

# ── Stop gateway ──────────────────────────────────────────────────────────────
echo ""
echo "1. Stopping gateway..."
systemctl --user stop openclaw-gateway.service 2>/dev/null || true
pkill -9 -f openclaw 2>/dev/null || true
sleep 3

# ── Restore pre-rollback snapshots ────────────────────────────────────────────
echo "2. Restoring pre-rollback snapshots..."
if [ -n "$OC_PREROLLBACK" ]; then
  cp "$OC_PREROLLBACK" "$OPENCLAW_CONF"
  echo "   ✅ openclaw.json restored from $(basename "$OC_PREROLLBACK")"
fi
if [ -n "$AUTH_PREROLLBACK" ]; then
  cp "$AUTH_PREROLLBACK" "$AUTH_CONF"
  echo "   ✅ auth-profiles.json restored from $(basename "$AUTH_PREROLLBACK")"
fi

# ── Restart gateway ───────────────────────────────────────────────────────────
echo "3. Restarting gateway..."
systemctl --user start openclaw-gateway.service
sleep 5

echo ""
echo "✅ Roll forward complete — config restored to pre-rollback state."
echo "   Current config saved as .backup-rollforward-$STAMP if you need to undo this."
