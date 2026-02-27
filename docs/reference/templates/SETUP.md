---
title: "SETUP.md Template"
summary: "Interactive post-onboarding infrastructure wizard"
read_when:
  - Setting up production infrastructure after onboarding
---

# SETUP.md - Production Infrastructure Setup

_Onboarding complete! Now let's build out your production environment together._

---

## 🤖 Bot Instructions - INTERACTIVE WIZARD MODE

**THIS IS A WIZARD, NOT A CHECKLIST.**

### On First User Message

1. **Greet the user warmly** - they just completed onboard!
2. **Summarize what this setup wizard will do:**
   - Telegram configuration (privacy, chat settings)
   - OAuth token refresh (prevents 24h agent death)
   - Heartbeat (proactive check-ins)
   - Timezone (correct timestamps)
   - Automated backups (protects your data)
   - Security hardening (SSH, firewall, updates)
   - Monitoring & health checks
3. **Explain the format:**
   - "I'll walk you through each step one at a time"
   - "For each step, I'll explain what it is, why it matters, and either set it up for you or guide you through it"
   - "We can take breaks - just let me know and we'll pick up where we left off"
4. **Ask:** "Ready to start with Step 1: OAuth Token Refresh?"

### During Setup - Step-by-Step Process

**For EACH step below:**

1. **Explain what this step is** (in plain English)
2. **Explain why it matters** (what breaks without it)
3. **Check if already done** (don't repeat completed work)
4. **Execute or guide:**
   - If I can do it myself → ask permission, then do it
   - If user needs to do something → guide them through exact commands
   - If external service needed → explain how to set it up
5. **Verify it worked** (test the thing we just set up)
6. **Mark complete** (check the box below)
7. **Ask:** "Done! Ready for Step [N+1]: [next step name]?"

### Handling Interruptions

- User wants to do something else? **That's fine!**
- Help them with whatever they need
- When done, say: "Great! Now let's get back to the setup wizard. We were on Step [N]: [step name]"
- **Keep returning** until all steps are complete

### Completion

- When ALL steps are ✅
- Say: "🎉 Setup complete! Your production infrastructure is ready."
- Ask: "Should I delete this SETUP.md file? You won't need it anymore."
- If yes → delete the file

### Progress Tracking

- Check boxes as you complete steps
- User can see progress at any time
- If user asks "where are we?" → show current step number and uncompleted steps

---

## Setup Steps

### ✅ Step 0: Telegram Configuration

**What this is:** Properly configure Telegram privacy, chat settings, and behavior

**Why it matters:** Default settings might not be optimal - you want the bot private, responsive, and configured for your workflow.

**What we'll configure:**

1. **Privacy - Ensure bot is private (only you can message it)**
2. **Chat settings - Interrupt mode, reasoning, streaming**
3. **DM policy - Allowlist with only your Telegram ID**
4. **Reactions - Set to minimal or off**

**Check current config:**

```bash
# View current Telegram settings
cat ~/.openclaw/openclaw.json | jq '.channels.telegram'
```

**Recommended settings:**

```json
{
  "telegram": {
    "enabled": true,
    "dmPolicy": "allowlist",
    "allowFrom": [YOUR_TELEGRAM_USER_ID],
    "groupPolicy": "allowlist",
    "streamMode": "block",
    "reactions": {
      "mode": "minimal"
    }
  }
}
```

**What each setting means:**

- **`dmPolicy: "allowlist"`** - Only people in `allowFrom` can DM the bot (private)
- **`allowFrom: [YOUR_ID]`** - Your Telegram user ID (the bot will tell you this)
- **`groupPolicy: "allowlist"`** - Bot won't join groups unless explicitly allowed
- **`streamMode: "block"`** - Waits until full response ready before sending (cleaner UX)
- **`reactions.mode: "minimal"`** - Bot reacts sparingly (not every message)

**Implementation:**

I can help you update these settings. First, let me check your current config and tell you:

1. Your Telegram user ID
2. What settings need changing
3. Recommend optimal settings for your use case

Then I'll either:

- Update the config for you (with permission), or
- Guide you through manual edits

**Verify:**

```bash
# Check bot is private
cat ~/.openclaw/openclaw.json | jq '.channels.telegram.dmPolicy'  # Should be "allowlist"
cat ~/.openclaw/openclaw.json | jq '.channels.telegram.allowFrom'  # Should contain only your ID

# Test by sending a message from another Telegram account - should be ignored
```

- [ ] Telegram privacy configured (allowlist, only your user ID)
- [ ] Chat settings optimized (stream mode, reactions, reasoning)
- [ ] Verified bot ignores messages from other users

---

### ✅ Step 1: OAuth Token Refresh

**What this is:** Automatic refresh of Claude Code OAuth tokens every 6 hours

**Why it matters:** OAuth tokens expire after ~24 hours. Without refresh, your agent silently stops working.

**Implementation:**

```bash
# Create directories
mkdir -p ~/clawd/scripts ~/clawd/logs

# Install refresh scripts
curl -o ~/clawd/scripts/refresh-claude-token.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/refresh-claude-token.sh

curl -o ~/clawd/scripts/sync-oauth-tokens.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/sync-oauth-tokens.sh

chmod +x ~/clawd/scripts/refresh-claude-token.sh ~/clawd/scripts/sync-oauth-tokens.sh

# Add cron job (runs every 6 hours)
(crontab -l 2>/dev/null; echo "0 */6 * * * ~/clawd/scripts/refresh-claude-token.sh >> ~/clawd/logs/token-refresh.log 2>&1 && ~/clawd/scripts/sync-oauth-tokens.sh >> ~/clawd/logs/token-refresh.log 2>&1") | crontab -
```

**Verify:**

```bash
# Check cron job installed
crontab -l | grep refresh-claude-token

# Check tokens are valid
cat ~/.claude/.credentials.json | jq '.claudeAiOauth.expiresAt'
```

- [ ] OAuth token refresh cron job installed and verified

---

### ✅ Step 2: Heartbeat Configuration

**What this is:** Periodic automated check-ins where the bot proactively looks for work

**Why it matters:** Without heartbeat, the bot only responds when you message it. With heartbeat, it can check the kanban board, handle background tasks, and be proactive.

**What we'll configure:**

1. **Heartbeat frequency** - How often to check in (recommended: every 1 hour for OAuth users)
2. **Heartbeat target** - Where to send check-in messages (usually "none" = silent, or specific channel)
3. **What the bot checks** - Kanban board, email, calendar, agent status

**Check current config:**

```bash
# View heartbeat settings
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.heartbeat'
```

**Recommended settings:**

```json
{
  "heartbeat": {
    "every": "1h",
    "target": "none"
  }
}
```

**What this means:**

- **`every: "1h"`** - Check in every hour (OAuth users can afford frequent checks)
- **`target: "none"`** - Silent check-ins (only messages you if something needs attention)
- Alternative: `target: "telegram"` sends "HEARTBEAT_OK" confirmations

**Implementation:**

I can update your heartbeat config. The bot will then:

1. Check the kanban board for work
2. Look for completed agents
3. Check for unmerged PRs
4. Only message you if something needs action

**Verify:**

```bash
# Check heartbeat config
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.heartbeat'

# Wait 1 hour and verify heartbeat ran (check logs)
journalctl --user -u openclaw-gateway.service | grep heartbeat
```

- [ ] Heartbeat configured (1h interval, silent mode)
- [ ] Verified heartbeat runs and checks kanban board

---

### ✅ Step 3: Timezone Configuration

**What this is:** Set your local timezone so timestamps make sense

**Why it matters:** Logs, memory files, and cron jobs all use timestamps. Without timezone config, everything is in UTC.

**Check current timezone:**

```bash
# System timezone
timedatectl

# Agent timezone (if configured)
cat ~/.openclaw/openclaw.json | jq '.timezone'
```

**Set timezone:**

```bash
# Set system timezone
sudo timedatectl set-timezone America/New_York  # Replace with your timezone

# Verify
timedatectl
```

**Common timezones:**

- `America/New_York` (Eastern)
- `America/Chicago` (Central)
- `America/Denver` (Mountain)
- `America/Los_Angeles` (Pacific)
- `Europe/London`
- Full list: `timedatectl list-timezones`

**Verify:**

```bash
# Check system timezone matches your location
date
```

- [ ] Timezone configured and verified

---

### ✅ Step 4: Automated Backups

**What this is:** Daily backups of your workspace, config, and databases to Google Drive

**Why it matters:** Hardware fails. Accidental deletions happen. Backups prevent data loss.

**What gets backed up:**

- Your workspace (`~/clawd/`)
- OpenClaw config (`~/.openclaw/openclaw.json`)
- Any project databases (DailyStockPick MongoDB, etc.)

**Implementation:**

```bash
# Install rclone (Google Drive sync tool)
sudo apt-get update && sudo apt-get install -y rclone

# Configure Google Drive remote
rclone config
# Follow prompts:
# - New remote → name it "nova-gdrive"
# - Type: Google Drive
# - OAuth flow will open browser
```

**Install backup script:**

```bash
curl -o ~/clawd/scripts/backup-to-gdrive.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/backup-to-gdrive.sh

chmod +x ~/clawd/scripts/backup-to-gdrive.sh

# Test backup
~/clawd/scripts/backup-to-gdrive.sh
```

**Schedule daily backups (4:00 AM local time):**

```bash
(crontab -l 2>/dev/null; echo "0 4 * * * ~/clawd/scripts/backup-to-gdrive.sh >> ~/clawd/logs/gdrive-backup.log 2>&1") | crontab -
```

**Verify:**

```bash
# Check backup exists
rclone ls nova-gdrive:Nova-Backup/

# Check cron job
crontab -l | grep backup-to-gdrive
```

- [ ] Google Drive configured and backup script tested
- [ ] Daily backup cron job installed

---

### ✅ Step 5: Security Hardening

**What this is:** SSH hardening, firewall, automatic updates, fail2ban

**Why it matters:** Your agent has access to APIs, databases, and sensitive data. Secure the host.

**What we'll do:**

1. Disable SSH password auth (key-only)
2. Enable UFW firewall
3. Install fail2ban (blocks brute-force attempts)
4. Enable automatic security updates

**Implementation:**

```bash
# Download security script
curl -o ~/clawd/scripts/security-hardening.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/security-hardening.sh

chmod +x ~/clawd/scripts/security-hardening.sh

# Run security hardening
~/clawd/scripts/security-hardening.sh
```

**Verify:**

```bash
# Check firewall status
sudo ufw status

# Check fail2ban is running
sudo systemctl status fail2ban

# Check SSH config
grep "PasswordAuthentication no" /etc/ssh/sshd_config
```

- [ ] Security hardening complete and verified

---

### ✅ Step 6: Gateway Health Monitoring

**What this is:** Watchdog script that detects gateway deadlocks and auto-restarts

**Why it matters:** Gateway can freeze (event loop deadlock). Watchdog recovers automatically.

**Implementation:**

```bash
# Install healthcheck script
curl -o ~/clawd/scripts/healthcheck-gateway.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/healthcheck-gateway.sh

chmod +x ~/clawd/scripts/healthcheck-gateway.sh

# Add to cron (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/clawd/scripts/healthcheck-gateway.sh >> ~/clawd/logs/gateway-health.log 2>&1") | crontab -
```

**Verify:**

```bash
# Test healthcheck
~/clawd/scripts/healthcheck-gateway.sh

# Check cron job
crontab -l | grep healthcheck-gateway
```

- [ ] Gateway health monitoring cron job installed

---

### ✅ Step 7: Pre-commit Hooks (Optional)

**What this is:** Git hooks that prevent committing secrets (gitleaks), run linters, format code

**Why it matters:** Accidentally committing API keys is a common security breach

**Implementation:**

```bash
# Install gitleaks
cd /tmp
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
gitleaks version

# Install pre-commit in your repos
cd ~/clawd/vault/dev/repos/your-repo
curl -o .pre-commit-config.yaml \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/.pre-commit-config.yaml

# Install pre-commit tool
pip install pre-commit
pre-commit install
```

**Verify:**

```bash
# Test pre-commit hooks
cd ~/clawd/vault/dev/repos/your-repo
pre-commit run --all-files
```

- [ ] Pre-commit hooks installed (optional - skip if not using git workflows)

---

### ✅ Step 8: Dashboard Setup (Optional)

**What this is:** Web dashboard for kanban board, system monitoring, Tommy/Stocks pages

**Why it matters:** Nice UI for managing your agent, tracking tasks, viewing metrics

**Implementation:**

```bash
# Fork claw-interface
# Go to https://github.com/victor-brechbill/claw-interface
# Click "Fork" button

# Clone your fork
cd ~/clawd/vault/dev/repos/
git clone https://github.com/YOUR-USERNAME/claw-interface.git dashboard

# Install dependencies
cd dashboard
npm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Build and start
npm run build
./deploy.sh
```

**Verify:**

```bash
# Check dashboard is running
curl http://localhost:3080/api/cards
```

- [ ] Dashboard forked, deployed, and running (optional)

---

### ✅ Step 9: System Maintenance Cron

**What this is:** Daily maintenance job (OS updates, cleanup, health checks)

**Why it matters:** Keeps system healthy, prevents disk space issues, applies security patches

**Implementation:**

This is typically set up via OpenClaw's built-in cron system rather than system cron.

**Via OpenClaw:**

```javascript
// Daily at 5am local time
{
  "name": "Daily System Maintenance",
  "schedule": { "kind": "cron", "expr": "0 5 * * *" },
  "payload": {
    "kind": "systemEvent",
    "text": "Run daily system maintenance: OS updates, cleanup, security audit, backup verification, cron health check"
  },
  "delivery": { "mode": "announce" },
  "sessionTarget": "main",
  "enabled": true
}
```

**Verify:**

```bash
# Check OpenClaw cron jobs
# (The bot can do this via cron tool)
```

- [ ] Daily system maintenance cron job configured

---

### ✅ Step 10: Memory System

**What this is:** Daily memory logs + long-term curated MEMORY.md

**Why it matters:** Your agent wakes up fresh each session. Memory files provide continuity.

**Implementation:**

```bash
# Create memory directory
mkdir -p ~/clawd/memory

# Memory files are auto-created by the agent
# Daily: ~/clawd/memory/YYYY-MM-DD.md (raw logs)
# Long-term: ~/clawd/MEMORY.md (curated insights)
```

**The bot will:**

- Write to `memory/YYYY-MM-DD.md` during sessions
- Periodically review daily logs and update `MEMORY.md`
- Load `MEMORY.md` at session start for context

**Verify:**

```bash
# Check memory directory exists
ls ~/clawd/memory/
```

- [ ] Memory directory created and system explained

---

### ✅ Step 11: Documentation Review

**What this is:** Quick review of key docs to know where to find help

**Key docs:**

- **AGENTS.md** - Operating manual, workspace structure, skills
- **SOUL.md** - Agent personality and voice
- **USER.md** - Information about you
- **TOOLS.md** - Local notes (API keys, camera names, etc.)
- **HEARTBEAT.md** - Periodic check checklist

**Verify:**

```bash
# Check docs exist
ls ~/clawd/AGENTS.md ~/clawd/SOUL.md ~/clawd/USER.md ~/clawd/TOOLS.md ~/clawd/HEARTBEAT.md
```

- [ ] Reviewed documentation structure

---

## ✅ Setup Complete!

When all boxes above are checked:

1. Congratulate the user 🎉
2. Summarize what's now in place:
   - OAuth tokens refresh automatically
   - Daily backups to Google Drive
   - Security hardened (firewall, SSH, fail2ban)
   - Gateway health monitoring
   - System maintenance scheduled
3. Ask: "Should I delete this SETUP.md file? You won't need it anymore."
4. If yes → delete the file

---

## Quick Reference (For the Bot)

**Checking progress:**

```bash
# Count completed steps
grep -c "^\- \[x\]" ~/clawd/SETUP.md

# List remaining steps
grep "^\- \[ \]" ~/clawd/SETUP.md
```

**When returning after interruption:**

```bash
# Find first incomplete step
grep -n "^\- \[ \]" ~/clawd/SETUP.md | head -1
```
