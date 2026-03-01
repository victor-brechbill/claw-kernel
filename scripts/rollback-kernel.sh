#!/bin/bash
# rollback-kernel.sh — Restore previous OpenClaw kernel installation from backup
#
# What it does:
#   Swaps the current kernel installation with the .bak backup, then
#   restarts the gateway service. The replaced installation is preserved
#   as a .rollback-tmp directory so the operation can be undone.
#
# When to use:
#   After a kernel upgrade introduces a regression and you need to
#   quickly revert to the previously installed version.
#
# Usage:
#   ./scripts/rollback-kernel.sh

set -euo pipefail

INSTALL_DIR="$HOME/.npm-global/lib/node_modules/openclaw"
BACKUP_DIR="$HOME/.npm-global/lib/node_modules/openclaw.bak"

echo "=== OpenClaw Kernel Rollback ==="

if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ No backup found at $BACKUP_DIR"
  echo "Cannot rollback without a backup."
  exit 1
fi

CURRENT_VERSION=$(node "$INSTALL_DIR/openclaw.mjs" --version 2>/dev/null || echo "unknown")
BACKUP_VERSION=$(node "$BACKUP_DIR/openclaw.mjs" --version 2>/dev/null || echo "unknown")

echo "Current version: $CURRENT_VERSION"
echo "Backup version:  $BACKUP_VERSION"
echo ""
echo "Rolling back..."

# Stop gateway
echo "1. Stopping gateway..."
systemctl --user stop openclaw-gateway.service 2>/dev/null || true

# Kill any remaining processes
echo "2. Killing remaining processes..."
pkill -9 -f openclaw 2>/dev/null || true
sleep 3

# Swap
echo "3. Swapping to backup..."
TEMP_DIR="${INSTALL_DIR}.rollback-tmp"
mv "$INSTALL_DIR" "$TEMP_DIR"
cp -r "$BACKUP_DIR" "$INSTALL_DIR"

# Start gateway
echo "4. Starting gateway..."
systemctl --user start openclaw-gateway.service
sleep 5

# Verify
NEW_VERSION=$(node "$INSTALL_DIR/openclaw.mjs" --version 2>/dev/null || echo "unknown")
echo ""
echo "✅ Rollback complete: $CURRENT_VERSION → $NEW_VERSION"
echo ""
echo "Old installation saved at: $TEMP_DIR"
echo "To clean up: rm -rf $TEMP_DIR"
