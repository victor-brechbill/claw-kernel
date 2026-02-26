#!/bin/bash
# Backup workspace and OpenClaw config to Google Drive via rclone
# Run manually or schedule via cron
#
# Prerequisites:
#   1. Install rclone: curl https://rclone.org/install.sh | sudo bash
#   2. Configure remote: rclone config (create a remote named "gdrive")
#   3. Make executable: chmod +x scripts/backup-to-gdrive.sh
#
# Cron (daily at 4am):
#   0 4 * * * /home/YOUR-USERNAME/scripts/backup-to-gdrive.sh >> /home/YOUR-USERNAME/logs/backup.log 2>&1
#
# Configuration:
#   Set these environment variables or edit the defaults below:
#   BACKUP_REMOTE  - rclone remote name (default: "gdrive")
#   BACKUP_DIR     - remote folder name (default: "OpenClaw-Backup")
#   WORKSPACE      - workspace path (default: ~/.openclaw/workspace)
#   OPENCLAW_CONFIG - OpenClaw config dir (default: ~/.openclaw)

set -euo pipefail

# Configuration — customize these for your setup
REMOTE="${BACKUP_REMOTE:-gdrive}"
BACKUP_DIR="${BACKUP_DIR:-OpenClaw-Backup}"
WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-$HOME/.openclaw}"

log() {
    echo "[$(date -Iseconds)] $*"
}

log "=== Backup starting ==="

# Check if rclone is installed
if ! command -v rclone &> /dev/null; then
    log "ERROR: rclone not installed. Install with: curl https://rclone.org/install.sh | sudo bash"
    exit 1
fi

# Check if rclone remote is configured
if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:"; then
    log "ERROR: rclone remote '$REMOTE' not configured."
    log "Run 'rclone config' to set up a remote named '$REMOTE'."
    exit 1
fi

# 1. Sync workspace (excluding git repos, build artifacts, secrets)
if [ -d "$WORKSPACE" ]; then
    log "Syncing workspace ($WORKSPACE)..."
    rclone sync "$WORKSPACE" "${REMOTE}:${BACKUP_DIR}/workspace" \
        --exclude ".venv/**" \
        --exclude "__pycache__/**" \
        --exclude "*.pyc" \
        --exclude ".git/**" \
        --exclude "node_modules/**" \
        --exclude "*.so" \
        --exclude "*.wasm" \
        --exclude ".env" \
        --exclude "*.key" \
        2>&1
    log "Workspace sync complete."
else
    log "WARNING: Workspace not found at $WORKSPACE — skipping."
fi

# 2. Sync OpenClaw config (excluding sessions, media, logs, browser data)
if [ -d "$OPENCLAW_CONFIG" ]; then
    log "Syncing OpenClaw config ($OPENCLAW_CONFIG)..."
    rclone sync "$OPENCLAW_CONFIG" "${REMOTE}:${BACKUP_DIR}/openclaw-config" \
        --exclude "media/**" \
        --exclude "*.log" \
        --exclude "sessions/**" \
        --exclude "chrome-profile/**" \
        --exclude "logs/**" \
        --exclude "canvas/**" \
        --exclude "browser/**" \
        --exclude "devices/**" \
        2>&1
    log "OpenClaw config sync complete."
else
    log "WARNING: OpenClaw config not found at $OPENCLAW_CONFIG — skipping."
fi

log "=== Backup complete ==="
