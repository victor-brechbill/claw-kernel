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

**Why it matters:** Without heartbeat, the bot only responds when you message it. With heartbeat, it can check the kanban board, monitor agents, handle background tasks, and be proactive.

**Important:** OpenClaw has an internal heartbeat feature, but we don't use it. Instead, we use a **cron-based heartbeat** which is more flexible and easier to manage.

**How it works:**

1. A cron job fires every 6 hours (or whatever frequency you choose)
2. The cron job sends a wake event to your bot
3. The bot reads `HEARTBEAT.md` in your workspace
4. The bot works through the checklist (check kanban board, agent status, unmerged PRs, etc.)
5. The bot only messages you if something needs attention (otherwise silent)

**What the bot checks each heartbeat:**

- Kanban board for new work or completed tasks
- Running developer/reviewer agents
- Unmerged PRs across all repos
- Victor comments needing responses
- Cards stuck in review or in-progress

**Implementation:**

```bash
# Create a heartbeat cron job (every 6 hours)
(crontab -l 2>/dev/null; echo "0 */6 * * * curl -X POST http://localhost:3100/api/cron/wake -H 'Content-Type: application/json' -d '{\"text\":\"Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.\"}' >> ~/clawd/logs/heartbeat.log 2>&1") | crontab -
```

**What this does:**

- Runs every 6 hours at :00 (midnight, 6am, noon, 6pm)
- Sends a wake event to the gateway with heartbeat instructions
- Bot reads `HEARTBEAT.md` and follows the checklist
- Logs to `~/clawd/logs/heartbeat.log`

**Adjusting heartbeat frequency:**

You can change the frequency anytime by editing the cron job:

```bash
# Edit cron jobs
crontab -e

# Find the line with "heartbeat.log"
# Change "0 */6 * * *" to your preferred schedule:
#   "0 */1 * * *"  = every hour
#   "0 */3 * * *"  = every 3 hours
#   "0 */12 * * *" = every 12 hours
#   "0 8,20 * * *" = 8am and 8pm daily
```

**Turning off heartbeat:**

To disable heartbeat temporarily:

```bash
# Comment out the heartbeat cron
crontab -e
# Add # at the start of the heartbeat line
```

**Important note:** When adjusting heartbeat settings, remember you're changing the **heartbeat cron job**, not the internal OpenClaw heartbeat config. The internal heartbeat (in `openclaw.json`) should stay disabled.

**Verify:**

```bash
# Check heartbeat cron is installed
crontab -l | grep heartbeat

# Test heartbeat manually (don't wait 6 hours)
curl -X POST http://localhost:3100/api/cron/wake -H 'Content-Type: application/json' -d '{"text":"Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK."}'

# Check your bot responds with HEARTBEAT_OK or takes action
# Check heartbeat log
tail ~/clawd/logs/heartbeat.log
```

- [ ] Heartbeat cron job installed (every 6 hours)
- [ ] Tested manually and bot responds correctly
- [ ] Understand how to adjust frequency or disable it

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

**How it works:**

- Runs every 5 minutes via cron
- Checks if gateway health endpoint responds within 30 seconds
- If unresponsive, automatically restarts the gateway
- Logs all activity to `~/clawd/logs/gateway-watchdog.log`

**Implementation:**

```bash
# Create logs directory if it doesn't exist
mkdir -p ~/clawd/logs

# Download the official watchdog script (DO NOT write your own!)
curl -o ~/clawd/scripts/gateway-watchdog.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/gateway-watchdog.sh

chmod +x ~/clawd/scripts/gateway-watchdog.sh

# Add to cron (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/clawd/scripts/gateway-watchdog.sh >> ~/clawd/logs/gateway-watchdog.log 2>&1") | crontab -
```

**Important:** Always use the official `gateway-watchdog.sh` script from the repository. Do not write your own watchdog script - the official one is tested and handles edge cases correctly.

**Verify:**

```bash
# Check cron job is installed
crontab -l | grep gateway-watchdog

# Check the script exists and is executable
ls -l ~/clawd/scripts/gateway-watchdog.sh

# Test the watchdog script manually (should complete without errors if gateway is healthy)
~/clawd/scripts/gateway-watchdog.sh

# Check gateway health endpoint directly
curl -sf http://localhost:18789/health

# After 5 minutes, check the watchdog log
tail ~/clawd/logs/gateway-watchdog.log
```

- [ ] Gateway watchdog script downloaded and executable
- [ ] Cron job installed (runs every 5 minutes)
- [ ] Verified script runs without errors

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

### ✅ Step 15: Bitwarden Password Manager

**What this is:** Secure encrypted storage for all credentials, API keys, and secrets

**Why it matters:** Your bot will need to access passwords, API keys, and tokens. Never store these in plain text files. Bitwarden provides encrypted vault storage with a master password.

**Setup:**

1. **Create Bitwarden account:**
   - Go to [vault.bitwarden.com](https://vault.bitwarden.com)
   - Sign up with your bot's email (e.g., `bot@yourdomain.com`)
   - Choose a strong master password (you'll need this to unlock the vault)
   - **Save this master password securely** (you can't recover it if lost)

2. **Install Bitwarden CLI:**

```bash
# Download and install Bitwarden CLI
curl -L https://vault.bitwarden.com/download/?app=cli&platform=linux -o bw.zip
unzip bw.zip
chmod +x bw
sudo mv bw /usr/local/bin/
rm bw.zip

# Verify installation
bw --version
```

3. **Set up encrypted master key storage:**

```bash
# Create secure directory
mkdir -p ~/clawd/vault/.secrets
chmod 700 ~/clawd/vault/.secrets

# Store Bitwarden master password (encrypted with script)
# You'll be prompted for the master password
~/clawd/scripts/encrypt-master-key.sh

# Verify encryption worked
ls -la ~/clawd/vault/.secrets/
# Should see: master_key.enc
```

4. **Test vault access:**

```bash
# Unlock vault (uses encrypted master key)
export BW_SESSION=$(~/clawd/scripts/unlock-bitwarden.sh)

# List items (should show empty vault for now)
bw list items

# Lock vault
bw lock
unset BW_SESSION
```

**What to store in Bitwarden:**

- GitHub personal access tokens
- Google OAuth credentials
- API keys (Brave Search, etc.)
- Bot email password
- Database passwords
- Any other secrets

**Usage pattern:**

```bash
# 1. Unlock vault
export BW_SESSION=$(~/clawd/scripts/unlock-bitwarden.sh)

# 2. Retrieve secret
PASSWORD=$(bw get password "GitHub PAT")

# 3. Use the secret
export GH_TOKEN="$PASSWORD"

# 4. Lock vault when done
bw lock
unset BW_SESSION
```

**Important security rules:**

- Never write passwords to plain text files
- Never echo passwords to stdout/logs
- Always lock vault after use
- Encrypted master key file should NEVER be committed to git

**Verify:**

```bash
# Check Bitwarden CLI installed
bw --version

# Check encrypted master key exists
ls -la ~/clawd/vault/.secrets/master_key.enc

# Test unlock script works
~/clawd/scripts/unlock-bitwarden.sh && echo "Success"
```

- [ ] Bitwarden account created
- [ ] Bitwarden CLI installed
- [ ] Master key encrypted and stored
- [ ] Tested vault unlock/lock

---

### ✅ Step 16: GitHub SSH Key Setup

**What this is:** SSH key for bot to access your GitHub repositories

**Why it matters:** Your bot needs to clone repos, push commits, and create PRs. SSH keys are more secure than HTTPS passwords.

**Implementation:**

```bash
# Generate SSH key for bot
ssh-keygen -t ed25519 -C "bot@yourdomain.com" -f ~/.ssh/github-bot -N ""

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to agent
ssh-add ~/.ssh/github-bot

# Display public key (copy this)
cat ~/.ssh/github-bot.pub
```

**Add to GitHub:**

1. Copy the public key from above
2. Go to [github.com/settings/keys](https://github.com/settings/keys)
3. Click "New SSH key"
4. Title: "Bot on [your-server-name]"
5. Paste the public key
6. Click "Add SSH key"

**Configure SSH for GitHub:**

```bash
# Add to SSH config
cat >> ~/.ssh/config << 'EOF'

# GitHub bot key
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github-bot
  IdentitiesOnly yes
EOF

# Test connection
ssh -T git@github.com
# Should see: "Hi [username]! You've successfully authenticated..."
```

**Verify:**

```bash
# Test SSH connection to GitHub
ssh -T git@github.com 2>&1 | grep "successfully authenticated"

# Test clone (use a small public repo)
cd /tmp && git clone git@github.com:torvalds/linux.git --depth 1 && rm -rf linux
```

- [ ] SSH key generated and added to GitHub
- [ ] SSH config updated
- [ ] Verified GitHub SSH authentication works

---

### ✅ Step 17: Dashboard Setup (Claw Interface)

**What this is:** Web dashboard for kanban board, system monitoring, and agent management

**Why it matters:** Visual interface for managing your bot's work, tracking tasks, and monitoring system health.

**Architecture:**

- **Claw Interface** - Open source dashboard (you'll fork this)
- **Cloudflare Tunnel** - Secure public access without opening firewall ports
- **Subdomain** - Access via `dashboard.yourdomain.com`

**Step 1: Fork claw-interface**

```bash
# Clone your fork
cd ~/clawd/vault/dev/repos/
git clone git@github.com:YOUR-USERNAME/claw-interface.git
cd claw-interface

# Install dependencies
npm install

# Build production version
npm run build
```

**Step 2: Set up subdomain DNS**

1. Go to your domain registrar (Google Domains, Cloudflare, etc.)
2. Add CNAME record:
   - Name: `dashboard` (or `bot`, `nova`, etc.)
   - Target: `your-tunnel-id.cfargotunnel.com` (you'll get this in next step)

**Step 3: Install Cloudflare Tunnel**

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# Authenticate with Cloudflare
cloudflared tunnel login
# Opens browser - sign in to your Cloudflare account

# Create tunnel
cloudflared tunnel create bot-dashboard
# Note the tunnel ID shown

# Configure tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: bot-dashboard
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: dashboard.yourdomain.com
    service: http://localhost:3080
  - service: http_status:404
EOF

# Install tunnel as a service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

**Step 4: Configure dashboard backend**

```bash
cd ~/clawd/vault/dev/repos/claw-interface

# Create .env file
cat > .env << EOF
PORT=3080
MONGODB_URI=mongodb://localhost:27017/claw-interface
NODE_ENV=production
EOF

# Start MongoDB (if not already running)
sudo systemctl enable mongodb
sudo systemctl start mongodb

# Deploy dashboard
./deploy.sh
```

**Step 5: Verify access**

```bash
# Check dashboard is running locally
curl http://localhost:3080/api/health

# Check Cloudflare tunnel status
cloudflared tunnel info bot-dashboard

# Test public access
curl https://dashboard.yourdomain.com
```

**Verify:**

```bash
# Dashboard running locally
curl -sf http://localhost:3080/api/health && echo "✓ Local OK"

# Cloudflare tunnel active
sudo systemctl status cloudflared | grep "active (running)"

# Public access works
curl -sf https://dashboard.yourdomain.com && echo "✓ Public OK"
```

- [ ] Forked claw-interface repo
- [ ] Subdomain DNS configured
- [ ] Cloudflare tunnel installed and running
- [ ] Dashboard accessible at subdomain
- [ ] MongoDB connected

---

### ✅ Step 18: Gmail OAuth Setup

**What this is:** OAuth credentials for bot to read/send emails via Gmail API

**Why it matters:** Your bot can monitor emails, send notifications, and handle correspondence automatically.

**Step 1: Create Google Cloud Project**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: "Bot Gmail Access"
3. Enable Gmail API:
   - Go to "APIs & Services" → "Library"
   - Search "Gmail API"
   - Click "Enable"

**Step 2: Create OAuth credentials**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Desktop app"
4. Name: "Bot Gmail Access"
5. Click "Create"
6. Download credentials JSON file
7. Save as `~/clawd/vault/.secrets/gmail-credentials.json`

**Step 3: Configure OAuth consent screen**

1. Go to "OAuth consent screen"
2. User type: "Internal" (if using Google Workspace) or "External"
3. App name: "Bot Gmail Access"
4. User support email: your bot's email
5. Scopes: Add Gmail scopes:
   - `gmail.readonly` (read emails)
   - `gmail.send` (send emails)
   - `gmail.modify` (mark as read, archive, etc.)

**Step 4: Authorize bot**

```bash
# Install Gmail authentication script
curl -o ~/clawd/scripts/gmail-auth.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/gmail-auth.sh

chmod +x ~/clawd/scripts/gmail-auth.sh

# Run OAuth flow (opens browser)
~/clawd/scripts/gmail-auth.sh authorize

# Follow prompts to sign in with bot's Google account
# Accept permissions
# Script saves refresh token to Bitwarden
```

**Step 5: Test Gmail access**

```bash
# List recent emails
~/clawd/scripts/gmail-list.sh --max 10

# Send test email
~/clawd/scripts/gmail-send.sh \
  --to "you@example.com" \
  --subject "Test from bot" \
  --body "Gmail access working!"
```

**Verify:**

```bash
# OAuth credentials exist
ls -la ~/clawd/vault/.secrets/gmail-credentials.json

# Test list emails
~/clawd/scripts/gmail-list.sh --max 1 && echo "✓ Read access OK"

# Check refresh token in Bitwarden
bw list items | grep "Gmail Refresh Token"
```

- [ ] Google Cloud project created
- [ ] Gmail API enabled
- [ ] OAuth credentials downloaded
- [ ] Bot authorized via OAuth flow
- [ ] Tested email read/send

---

### ✅ Step 19: Email Monitoring Cron

**What this is:** Periodic email check for urgent messages

**Why it matters:** Your bot can respond to emails automatically or notify you of important messages.

**How it works:**

1. Cron runs every hour
2. Script checks for unread emails
3. Filters by priority:
   - From specific senders (your allowlist)
   - Marked as important
   - Certain subject keywords
4. Bot notifies you via Telegram if urgent email detected
5. Bot can auto-respond to specific email types

**Implementation:**

```bash
# Download email monitoring script
curl -o ~/clawd/scripts/email-monitor.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/email-monitor.sh

chmod +x ~/clawd/scripts/email-monitor.sh

# Configure email filters (edit this file)
cat > ~/clawd/.email-filters.json << 'EOF'
{
  "priority_senders": [
    "boss@company.com",
    "client@important.com"
  ],
  "priority_keywords": [
    "urgent",
    "asap",
    "emergency"
  ],
  "auto_reply_patterns": {
    "out of office": "I'm currently away...",
    "meeting request": "Please check my calendar..."
  }
}
EOF

# Add to cron (runs every hour)
(crontab -l 2>/dev/null; echo "0 * * * * ~/clawd/scripts/email-monitor.sh >> ~/clawd/logs/email-monitor.log 2>&1") | crontab -
```

**What the bot does:**

- **Silent monitoring** - Most emails are just logged, no notification
- **Priority alert** - Urgent emails trigger Telegram message to you
- **Auto-respond** - Optional: Bot can reply to specific email patterns
- **Smart filtering** - Learns from your responses over time

**Verify:**

```bash
# Test email monitor manually
~/clawd/scripts/email-monitor.sh --dry-run

# Check cron job installed
crontab -l | grep email-monitor

# Send yourself a test "urgent" email and wait for notification
```

- [ ] Email monitoring script installed
- [ ] Email filters configured
- [ ] Cron job added (hourly)
- [ ] Tested with dry-run

---

### ✅ Step 20: Daily System Maintenance

**What this is:** Automated daily maintenance tasks (backups, updates, cleanup, health checks)

**Why it matters:** Prevents system degradation, catches issues early, keeps everything running smoothly.

**What it does (runs at 5:00 AM daily):**

1. **OS updates** - Check for security updates, install if available
2. **Disk cleanup** - Remove old logs, temp files, Docker images
3. **Backup verification** - Ensure yesterday's backup exists in Google Drive
4. **Security audit** - Check for unauthorized access, failed login attempts
5. **Cron job health** - Verify all cron jobs ran successfully
6. **Gateway health** - Check gateway logs for errors or warnings
7. **Memory usage** - Alert if memory >80%
8. **Disk space** - Alert if disk >85%

**Implementation:**

```bash
# Download maintenance script
curl -o ~/clawd/scripts/daily-maintenance.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/daily-maintenance.sh

chmod +x ~/clawd/scripts/daily-maintenance.sh

# Test maintenance script (dry-run)
~/clawd/scripts/daily-maintenance.sh --dry-run

# Add to cron (5:00 AM daily)
(crontab -l 2>/dev/null; echo "0 5 * * * ~/clawd/scripts/daily-maintenance.sh >> ~/clawd/logs/maintenance.log 2>&1") | crontab -
```

**What you'll see:**

- **Daily summary** - Bot messages you each morning with maintenance report
- **Only alerts on issues** - If everything is healthy, just a brief "✓ All systems OK"
- **Actionable warnings** - If something needs attention, bot explains what and why

**Example daily report:**

```
🔧 Daily Maintenance (2026-02-28)

✓ OS updates: None available
✓ Disk cleanup: Freed 2.3 GB
✓ Backup: Verified in Google Drive
✓ Security: No issues
✓ Cron jobs: All 6 jobs ran successfully
✓ Gateway: Healthy (no errors)
⚠ Memory: 78% (within limits)
✓ Disk: 45% used

Status: All systems OK
```

**Verify:**

```bash
# Check maintenance script exists
ls -l ~/clawd/scripts/daily-maintenance.sh

# Run dry-run to see what it checks
~/clawd/scripts/daily-maintenance.sh --dry-run

# Check cron job scheduled
crontab -l | grep daily-maintenance

# Review sample maintenance log
tail ~/clawd/logs/maintenance.log
```

- [ ] Daily maintenance script installed
- [ ] Tested with dry-run
- [ ] Cron job scheduled (5 AM daily)
- [ ] Understand what gets checked

---

### ✅ Step 21: Self-Improvement System

**What this is:** Bot learns from mistakes and improves its own behavior over time

**Why it matters:** Your bot gets smarter the longer you use it. Errors become lessons. Corrections become permanent improvements.

**How it works:**

1. **Error capture** - When commands fail or produce unexpected results
2. **User corrections** - When you say "No, that's wrong..." or "Actually..."
3. **External failures** - API errors, timeouts, rate limits
4. **Learning synthesis** - Once per week, bot reviews all learnings and updates its knowledge
5. **Skill updates** - Bot can modify its own operating instructions based on lessons learned

**What triggers learning:**

- ❌ Command failures (exit code != 0)
- ❌ API errors (timeouts, 4xx/5xx responses)
- 🔄 User corrections ("That's wrong", "No, do it this way")
- 💡 Discoveries (better approaches, new tools, workflow improvements)
- 🐛 Bugs found and fixed

**Implementation:**

```bash
# Download self-improvement script
curl -o ~/clawd/scripts/self-improve.sh \
  https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/scripts/self-improve.sh

chmod +x ~/clawd/scripts/self-improve.sh

# Create learnings directory
mkdir -p ~/clawd/memory/learnings

# Add to cron (Sunday at 2:00 AM)
(crontab -l 2>/dev/null; echo "0 2 * * 0 ~/clawd/scripts/self-improve.sh >> ~/clawd/logs/self-improvement.log 2>&1") | crontab -
```

**What the bot does weekly:**

1. **Review error logs** from past week
2. **Extract patterns** - Similar failures, recurring issues
3. **Update MEMORY.md** - Add lessons learned
4. **Update skills** - Modify AGENTS.md, TOOLS.md if workflows improved
5. **Create reminders** - Schedule follow-ups for unresolved issues

**Example learning entry:**

```markdown
## 2026-02-28 - OAuth Token Sync Failure

**What happened:** sync-oauth-tokens.sh wrote `type: "oauth"` but needed `type: "claudeAiOauth"`

**Impact:** Fresh installations failed with "No API key found"

**Fix:** PR #42 changed sync script to use correct type

**Lesson:** Always verify token type matches Claude Code's credential format

**Prevention:** Added type validation check to sync script
```

**Verify:**

```bash
# Check self-improvement script exists
ls -l ~/clawd/scripts/self-improve.sh

# Test learning capture
echo "Test learning: Always verify before deploying" > ~/clawd/memory/learnings/$(date +%Y-%m-%d)-test.md

# Check cron job scheduled
crontab -l | grep self-improve

# Review learnings directory
ls ~/clawd/memory/learnings/
```

- [ ] Self-improvement script installed
- [ ] Learnings directory created
- [ ] Cron job scheduled (weekly)
- [ ] Understand how bot learns from errors

---

## ✅ Setup Complete!

When all boxes above are checked:

1. Congratulate the user 🎉
2. Summarize what's now in place:
   - **Core infrastructure:**
     - Opus 4.6 main agent, Sonnet 4.6 sub-agents, 200k context
     - OAuth tokens refresh automatically (every 6 hours)
     - Heartbeat enabled (proactive 6-hour check-ins)
     - Memory system with daily logs
   - **Security & backups:**
     - Bitwarden password manager (encrypted credentials)
     - GitHub SSH key configured
     - Daily backups to Google Drive (4 AM)
     - Security hardened (firewall, SSH, fail2ban)
   - **Monitoring & maintenance:**
     - Gateway health watchdog (every 5 minutes)
     - Email monitoring (hourly)
     - Daily system maintenance (5 AM)
     - Weekly self-improvement (Sunday 2 AM)
   - **Dashboard & communication:**
     - Claw Interface dashboard (public via Cloudflare tunnel)
     - Gmail OAuth configured (read/send emails)
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
