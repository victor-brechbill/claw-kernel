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
   - Core agent configuration (performance, OAuth models)
   - Telegram configuration (privacy, chat settings)
   - Hooks & memory system (automatic logging)
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
4. **Ask:** "Ready to start with Step 1: Core Agent Configuration?"

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

### ✅ Step 1: Core Agent Configuration

**What this is:** Configure agent performance settings, model registration, and behavior

**Why it matters:** These settings determine context size, caching behavior, streaming mode, and **OAuth model registration** (critical for authentication).

**What we'll configure:**

1. **Models registration** - Register your primary model (critical for OAuth!)
2. **Context window** - 200k tokens for large conversations
3. **Context pruning** - Cache optimization (cache-ttl, 5m)
4. **Compaction** - Automatic memory optimization
5. **Block streaming** - Wait for complete responses (cleaner UX)
6. **Timeout** - 1 hour for long-running tasks

**Check current config:**

```bash
# View agent defaults
cat ~/.openclaw/openclaw.json | jq '.agents.defaults'
```

**Recommended settings:**

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-opus-4-6"
      },
      "models": {
        "anthropic/claude-opus-4-6": {},
        "anthropic/claude-sonnet-4-6": {}
      },
      "contextTokens": 200000,
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m"
      },
      "compaction": {
        "mode": "default",
        "memoryFlush": {
          "enabled": true
        }
      },
      "blockStreamingDefault": "on",
      "timeoutSeconds": 3600
    }
  }
}
```

**What each setting means:**

- **`models`** - **CRITICAL:** Registers models for OAuth authentication. Without this, OAuth won't work!
- **`contextTokens: 200000`** - Full 200k context window
- **`contextPruning`** - Keeps cache fresh (5 minute TTL)
- **`compaction.memoryFlush`** - Automatically compacts memory when full
- **`blockStreamingDefault: "on"`** - Waits for full response before sending (no partial messages)
- **`timeoutSeconds: 3600`** - 1 hour timeout (important for long code reviews, etc.)

**Implementation:**

I'll update your config with these settings using the `gateway` tool's `config.patch` action. This safely merges the settings without overwriting your existing config.

**Verify:**

```bash
# Check models are registered
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.models'

# Check context window
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.contextTokens'

# Check all performance settings
cat ~/.openclaw/openclaw.json | jq '.agents.defaults | {contextPruning, compaction, blockStreamingDefault, timeoutSeconds}'
```

- [ ] Models registered (Opus 4.6, Sonnet 4.6)
- [ ] Context window set to 200k
- [ ] Performance settings configured
- [ ] Verified with config check

---

### ✅ Step 2: Sub-Agent Configuration

**What this is:** Configure developer and code-reviewer agents with appropriate models

**Why it matters:** Developer and reviewer agents should use Sonnet 4.6 (faster, cheaper) while main uses Opus 4.6 (smarter).

**Check current config:**

```bash
# View agents list
cat ~/.openclaw/openclaw.json | jq '.agents.list'
```

**Recommended agents:**

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Assistant",
        "workspace": "/home/ubuntu/clawd"
      },
      {
        "id": "developer",
        "name": "Developer",
        "workspace": "/home/ubuntu/clawd-developer",
        "model": "anthropic/claude-sonnet-4-6",
        "identity": {
          "name": "Developer",
          "emoji": "💻"
        }
      },
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/home/ubuntu/clawd-code-reviewer",
        "model": "anthropic/claude-sonnet-4-6",
        "identity": {
          "name": "Code Reviewer",
          "emoji": "🔍"
        }
      }
    ]
  }
}
```

**What this means:**

- **Main agent:** Uses Opus 4.6 (from defaults) - best for general chat, orchestration
- **Developer agent:** Uses Sonnet 4.6 - fast enough for coding tasks
- **Code reviewer agent:** Uses Sonnet 4.6 - fast for code review

**Implementation:**

I'll add developer and code-reviewer agents to your config if they don't exist.

**Verify:**

```bash
# Check agents are configured
cat ~/.openclaw/openclaw.json | jq '.agents.list[] | {id, model}'
```

- [ ] Developer agent configured (Sonnet 4.6)
- [ ] Code reviewer agent configured (Sonnet 4.6)
- [ ] Main agent uses Opus 4.6 (from defaults)

---

### ✅ Step 3: Hooks & Memory System

**What this is:** Enable automatic memory logging to daily files

**Why it matters:** Without hooks, the memory system doesn't work. Daily logs won't be created automatically.

**Check current config:**

```bash
# View hooks config
cat ~/.openclaw/openclaw.json | jq '.hooks'
```

**Recommended settings:**

```json
{
  "hooks": {
    "enabled": true,
    "path": "/hooks",
    "token": "your-webhook-token-here",
    "internal": {
      "enabled": true,
      "entries": {
        "command-logger": {
          "enabled": true
        },
        "session-memory": {
          "enabled": true
        },
        "boot-md": {
          "enabled": true
        }
      }
    }
  }
}
```

**What each hook does:**

- **`session-memory`** - Automatically writes to `memory/YYYY-MM-DD.md` after each session
- **`boot-md`** - Processes BOOTSTRAP.md on first run
- **`command-logger`** - Logs commands for debugging

**Implementation:**

I'll enable hooks with a secure random webhook token.

**Verify:**

```bash
# Check hooks are enabled
cat ~/.openclaw/openclaw.json | jq '.hooks.enabled'

# Check internal hooks
cat ~/.openclaw/openclaw.json | jq '.hooks.internal.entries | keys'

# Wait for next session, then check memory file was created
ls ~/clawd/memory/
```

- [ ] Hooks enabled with webhook token
- [ ] Session-memory hook configured
- [ ] Verified memory directory exists

---

### ✅ Step 4: Enable Agent-to-Agent Communication

**What this is:** Enable sub-agent orchestration (spawning developer, code-reviewer, and other sub-agents)

**Why it matters:** This allows your main agent to spawn specialized sub-agents for tasks like coding and code review. Without this, sub-agent spawning won't work.

**Check current config:**

```bash
# View tools config
cat ~/.openclaw/openclaw.json | jq '.tools.agentToAgent'
```

**Recommended settings:**

```json
{
  "tools": {
    "agentToAgent": {
      "enabled": true
    }
  }
}
```

**Implementation:**

I'll enable agent-to-agent communication in your config.

**Verify:**

```bash
# Check agent-to-agent is enabled
cat ~/.openclaw/openclaw.json | jq '.tools.agentToAgent.enabled'
# Should return: true
```

- [ ] Agent-to-agent communication enabled

---

### ✅ Step 5: Message & Command Settings

**What this is:** Configure message queueing, reactions, and command behavior

**Why it matters:** Controls how the agent handles concurrent messages and what commands are available.

**Check current config:**

```bash
# View message settings
cat ~/.openclaw/openclaw.json | jq '{messages, commands}'
```

**Recommended settings:**

```json
{
  "messages": {
    "queue": {
      "mode": "interrupt",
      "byChannel": {
        "telegram": "interrupt"
      }
    },
    "ackReactionScope": "group-mentions"
  },
  "commands": {
    "native": false,
    "nativeSkills": false,
    "restart": true
  }
}
```

**What each setting means:**

- **`queue.mode: "interrupt"`** - New messages interrupt current processing (responsive)
- **`ackReactionScope: "group-mentions"`** - Only react to acknowledgments in groups when mentioned
- **`commands.native: false`** - Disable built-in slash commands (use natural language instead)
- **`commands.restart: true`** - Enable `/restart` command

**Implementation:**

I'll update these settings using config.patch.

**Verify:**

```bash
# Check message queue mode
cat ~/.openclaw/openclaw.json | jq '.messages.queue.mode'

# Check commands
cat ~/.openclaw/openclaw.json | jq '.commands'
```

- [ ] Message queue set to interrupt mode
- [ ] Commands configured (native: false, restart: true)

---

### ✅ Step 6: Telegram Configuration

**What this is:** Properly configure Telegram privacy, chat settings, and behavior

**Why it matters:** Default settings might not be optimal - you want the bot private, responsive, and configured for your workflow.

**What we'll configure:**

1. **Privacy** - Ensure bot is private (only you can message it)
2. **Chat settings** - Stream mode, reactions
3. **DM policy** - Allowlist with only your Telegram ID
4. **Commands** - Disable native Telegram commands

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
    "commands": {
      "native": false
    }
  }
}
```

**What each setting means:**

- **`dmPolicy: "allowlist"`** - Only people in `allowFrom` can DM the bot (private)
- **`allowFrom: [YOUR_ID]`** - Your Telegram user ID (I can tell you this)
- **`groupPolicy: "allowlist"`** - Bot won't join groups unless explicitly allowed
- **`streamMode: "block"`** - Waits until full response ready before sending (cleaner UX)
- **`commands.native: false`** - Disables Telegram slash commands (use natural language)

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
- [ ] Chat settings optimized (stream mode: block, native commands: false)
- [ ] Verified bot ignores messages from other users

---

### ✅ Step 7: OAuth Token Refresh

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

### ✅ Step 8: Heartbeat Configuration

**What this is:** Periodic automated check-ins where the bot proactively looks for work

**Why it matters:** Without heartbeat, the bot only responds when you message it. With heartbeat, it can check the kanban board, handle background tasks, and be proactive.

**What we'll configure:**

1. **Heartbeat frequency** - How often to check in (recommended: every 1 hour for OAuth users)
2. **Heartbeat target** - Where to send check-in messages (usually "none" = silent)
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

### ✅ Step 9: Timezone Configuration

**What this is:** Set your local timezone so timestamps make sense

**Why it matters:** Logs, memory files, and cron jobs all use timestamps. Without timezone config, everything is in UTC.

**Check current timezone:**

```bash
# System timezone
timedatectl
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

### ✅ Step 10: Automated Backups

**What this is:** Daily backups of your workspace, config, and databases to Google Drive

**Why it matters:** Hardware fails. Accidental deletions happen. Backups prevent data loss.

**What gets backed up:**

- Your workspace (`~/clawd/`)
- OpenClaw config (`~/.openclaw/openclaw.json`)
- Any project databases (DailyStockPick MongoDB, etc.)

**Prerequisites:**

If you haven't already:

1. Set up Google Workspace Business Starter (see [Prerequisites](../../README.md#3-google-workspace-account-recommended))
2. Create a backup folder in your Google Drive
3. Note your bot email (e.g., `bot@yourdomain.com`)

**Implementation:**

```bash
# Install rclone (Google Drive sync tool)
sudo apt-get update && sudo apt-get install -y rclone

# Configure Google Drive remote
rclone config
```

**Follow the rclone prompts:**

```
n) New remote
name> nova-gdrive
Storage> drive (Google Drive)
client_id> (leave blank, press Enter)
client_secret> (leave blank, press Enter)
scope> 1 (Full access)
service_account_file> (leave blank, press Enter)
Edit advanced config? n
Use web browser to automatically authenticate? Y

# Browser will open for OAuth - sign in with your bot Google account
# Grant permissions, then return to terminal

Configure this as a Shared Drive (Team Drive)? n
Keep this remote? y
```

**Install backup script:**

```bash
# Create scripts directory
mkdir -p ~/clawd/scripts ~/clawd/logs

# Download backup script
curl -o ~/clawd/scripts/backup-to-gdrive.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/backup-to-gdrive.sh

chmod +x ~/clawd/scripts/backup-to-gdrive.sh

# Edit the script to set your backup folder name (optional)
# Default: "Nova-Backup" - change if you created a different folder name

# Test backup (first run creates the backup folder)
~/clawd/scripts/backup-to-gdrive.sh
```

**Schedule daily backups (4:00 AM local time):**

```bash
(crontab -l 2>/dev/null; echo "0 4 * * * ~/clawd/scripts/backup-to-gdrive.sh >> ~/clawd/logs/gdrive-backup.log 2>&1") | crontab -
```

**Verify:**

```bash
# Check backup exists in Google Drive
rclone ls nova-gdrive:Nova-Backup/

# You should see folders: workspace/, config/, databases/ (if applicable)

# Check cron job is scheduled
crontab -l | grep backup-to-gdrive

# Check backup log
tail ~/clawd/logs/gdrive-backup.log
```

**Troubleshooting:**

- **"Remote not found"**: Run `rclone config` again, make sure you named it `nova-gdrive`
- **OAuth errors**: Re-run `rclone config`, delete old remote, recreate with correct Google account
- **Backup folder not created**: Check script has execute permissions (`chmod +x`)

- [ ] rclone configured with Google Drive OAuth
- [ ] Backup script tested successfully
- [ ] Daily backup cron job installed
- [ ] Verified backup appears in Google Drive

---

### ✅ Step 11: Security Hardening

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

### ✅ Step 12: Gateway Health Monitoring

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

### ✅ Step 13: Memory Directory Setup

**What this is:** Create memory directory for daily logs

**Why it matters:** The memory system (configured in Step 3) needs this directory to exist.

**Implementation:**

```bash
# Create memory directory
mkdir -p ~/clawd/memory

# Memory files are auto-created by the session-memory hook
# Daily: ~/clawd/memory/YYYY-MM-DD.md (raw logs)
# Long-term: ~/clawd/MEMORY.md (curated insights)
```

**The bot will:**

- Write to `memory/YYYY-MM-DD.md` during sessions (via session-memory hook)
- Periodically review daily logs and update `MEMORY.md`
- Load `MEMORY.md` at session start for context

**Verify:**

```bash
# Check memory directory exists
ls ~/clawd/memory/
```

- [ ] Memory directory created and system explained

---

### ✅ Step 14: Documentation Review

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
   - Core agent config (Opus 4.6 main, Sonnet 4.6 sub-agents, 200k context)
   - Hooks & memory system (automatic daily logs)
   - OAuth tokens refresh automatically
   - Heartbeat enabled (proactive check-ins)
   - Daily backups to Google Drive
   - Security hardened (firewall, SSH, fail2ban)
   - Gateway health monitoring
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
