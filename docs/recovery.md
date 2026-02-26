# Recovery Guide

How to restore your OpenClaw deployment from backups.

## Prerequisites

- A new server (Ubuntu recommended) with SSH access
- Your Google Drive backup (from `backup-to-gdrive.sh`)
- Access to your GitHub repositories

## Quick Recovery (15-20 minutes)

### 1. Install Prerequisites

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Set npm global directory
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Install OpenClaw (claw-kernel)
npm install -g @claw/claw-kernel

# Install rclone for backup restoration
curl https://rclone.org/install.sh | sudo bash

# Install other tools
sudo apt-get install -y git jq
```

### 2. Configure Google Drive Access

```bash
# Re-authenticate with Google Drive (requires browser OAuth)
rclone config

# Create remote named "gdrive"
# Select: Google Drive
# Follow the OAuth flow
```

### 3. Restore from Backup

```bash
# Restore workspace
rclone copy gdrive:OpenClaw-Backup/workspace ~/.openclaw/workspace

# Restore OpenClaw config
rclone copy gdrive:OpenClaw-Backup/openclaw-config ~/.openclaw

# Verify restored files
ls -la ~/.openclaw/workspace/
ls -la ~/.openclaw/openclaw.json
```

### 4. Clone Code Repositories

```bash
# Clone your repositories (adjust URLs for your account)
mkdir -p ~/repos
cd ~/repos
git clone git@github.com:YOUR-USERNAME/claw-interface.git
# Add other repositories as needed
```

### 5. Re-enter Secrets (NOT backed up for security)

These must be manually restored:

- **Claude OAuth**: Run `claude` to re-authenticate, or restore `~/.claude/.credentials.json`
- **API keys**: Edit `~/.openclaw/openclaw.json` with your keys
- **Telegram bot token**: Should be in restored config (backed up)
- **Google OAuth (rclone)**: Re-authenticated in step 2

### 6. Set Up Systemd Service

```bash
# OpenClaw creates this automatically on first run:
openclaw gateway start

# Or manually install as service:
openclaw gateway install
systemctl --user enable openclaw-gateway.service
systemctl --user start openclaw-gateway.service
loginctl enable-linger $(whoami)
```

### 7. Restore Cron Jobs

```bash
# Re-create cron jobs
crontab -e

# Add these entries (adjust paths):
# Token refresh every 6 hours
0 */6 * * * /home/YOUR-USERNAME/scripts/refresh-claude-token.sh >> /home/YOUR-USERNAME/logs/token-refresh.log 2>&1

# Daily backup at 4am
0 4 * * * /home/YOUR-USERNAME/scripts/backup-to-gdrive.sh >> /home/YOUR-USERNAME/logs/backup.log 2>&1

# Gateway watchdog every 5 minutes
*/5 * * * * /home/YOUR-USERNAME/scripts/gateway-watchdog.sh >> /home/YOUR-USERNAME/logs/watchdog.log 2>&1
```

### 8. Verify

```bash
openclaw --version
openclaw gateway status
curl -s http://localhost:18789/health | jq .
```

## What Gets Backed Up

| Category                    | Path                                      | Backed Up?               |
| --------------------------- | ----------------------------------------- | ------------------------ |
| SOUL.md, AGENTS.md, USER.md | `~/.openclaw/workspace/`                  | Yes                      |
| MEMORY.md                   | `~/.openclaw/workspace/`                  | Yes                      |
| Daily logs                  | `~/.openclaw/workspace/memory/`           | Yes                      |
| Skills                      | `~/.openclaw/workspace/skills/`           | Yes                      |
| OpenClaw config             | `~/.openclaw/openclaw.json`               | Yes                      |
| Agent configs               | `~/.openclaw/agents/`                     | Yes                      |
| Git repositories            | `~/repos/`                                | No (restore from GitHub) |
| Chrome profiles             | `~/.openclaw/chrome-profile/`             | No (regenerated)         |
| Session transcripts         | `~/.openclaw/sessions/`                   | No (ephemeral)           |
| Media/logs                  | `~/.openclaw/media/`, `~/.openclaw/logs/` | No (ephemeral)           |
| API keys/secrets            | Various                                   | No (re-enter manually)   |

## Recovery Scenarios

### Config Corruption

If `~/.openclaw/openclaw.json` becomes corrupted:

```bash
# Restore from backup
rclone copy gdrive:OpenClaw-Backup/openclaw-config/openclaw.json ~/.openclaw/

# Or restore from local backup (if you made one)
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json

# Restart gateway
systemctl --user restart openclaw-gateway
```

### Token Expired (Agent Unresponsive)

```bash
# Manual token refresh
~/scripts/refresh-claude-token.sh

# Sync to OpenClaw agents
~/scripts/sync-oauth-tokens.sh

# Restart gateway if needed
systemctl --user restart openclaw-gateway
```

### Gateway Won't Start

```bash
# Check logs
journalctl --user -u openclaw-gateway --since "10 min ago"

# Check config validity
python3 -c "import json; json.load(open('$HOME/.openclaw/openclaw.json'))" && echo "Config OK" || echo "Config INVALID"

# Try starting manually to see errors
openclaw gateway start --verbose
```

### Complete Data Loss

Follow the full Quick Recovery procedure above. Key points:

1. Server infrastructure is replaceable — reinstall from scratch
2. Workspace data restores from Google Drive backup
3. Code restores from GitHub
4. Secrets must be re-entered manually
5. Total recovery time: 15-20 minutes with backups

## Backup Verification

Periodically verify your backups are working:

```bash
# Check last backup timestamp
rclone ls gdrive:OpenClaw-Backup/ | head -5

# Check backup size
rclone size gdrive:OpenClaw-Backup/

# Test restore of a single file
rclone copy gdrive:OpenClaw-Backup/workspace/MEMORY.md /tmp/test-restore/
cat /tmp/test-restore/MEMORY.md
rm -rf /tmp/test-restore/
```
