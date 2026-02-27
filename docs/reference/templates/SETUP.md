---
title: "SETUP.md Template"
summary: "Post-onboarding infrastructure checklist"
read_when:
  - Setting up production infrastructure after onboarding
---

# SETUP.md - Production Infrastructure Checklist

_Onboarding complete. Now let's build out your production environment._

---

## 🤖 Instructions for the Bot

**On first user message after onboard:**

1. Immediately offer to work through this setup checklist together
2. Explain this covers critical infrastructure (OAuth refresh, backups, security, etc.)
3. Start working through sections below in order

**During setup:**

- If the user wants to do something else → **that's fine, help them**
- After handling their request → **return to the setup checklist**
- Say something like: "Done! Now let's get back to the setup checklist. We were on: [section name]"
- Keep returning until all checkboxes are complete

**Completion:**

- When ALL checkboxes below are checked ✅
- Confirm with user: "Setup complete! Should I delete SETUP.md now?"
- If yes → delete this file
- The user won't need it again (infrastructure is built)

**Tracking progress:** Check each box as you complete sections together. The user can see progress.

---

## Repository Architecture

Before you begin, understand how claw-kernel and claw-interface work together:

### claw-kernel (Your OpenClaw Runtime)

**What it is:** The OpenClaw runtime — the code that runs your agent.

**What you should do:**

- Install via npm: `npm install -g @claw/claw-kernel`
- Monitor for updates: Watch the GitHub repo, pull updates regularly
- Contribute bugfixes: Submit PRs for bugs you find
- Fork only if adding major features — otherwise, stay on upstream

**Updating:**

```bash
npm update -g @claw/claw-kernel
```

### claw-interface (Your Dashboard)

**What it is:** The web dashboard for managing your agent, kanban board, system monitoring.

**What you should do:**

- Fork immediately: `git clone https://github.com/YOUR-USERNAME/claw-interface.git`
- Customize freely: This is YOUR dashboard — change colors, add pages, modify layouts
- Stay generic: Don't add hardcoded personal data (keep it configurable)
- Pull upstream updates periodically if you want new features

### Summary

| Repo               | Install Method | Customization Strategy                         |
| ------------------ | -------------- | ---------------------------------------------- |
| **claw-kernel**    | npm install    | Stay on upstream, fork only for major features |
| **claw-interface** | Fork & clone   | Fork immediately, customize freely             |

---

## Authentication & Token Management

- [ ] **Set up OAuth token refresh** — Prevent agent death after 24h

**Why this is critical:** Claude Code's OAuth token expires after ~24 hours. Without automatic refresh, your agent stops working silently.

**Note:** Tokens are automatically synced to OpenClaw during `openclaw onboard`. This cron job keeps them refreshed after expiry.

**Install refresh scripts:**

```bash
# Copy scripts from claw-kernel repo
mkdir -p ~/scripts ~/logs
cp ~/claw-kernel/scripts/refresh-claude-token.sh ~/scripts/
cp ~/claw-kernel/scripts/sync-oauth-tokens.sh ~/scripts/
chmod +x ~/scripts/refresh-claude-token.sh ~/scripts/sync-oauth-tokens.sh
```

**Set up cron job (refreshes every 6 hours):**

```bash
crontab -e

# Add this line (replace YOUR-USERNAME with your actual username):
0 */6 * * * /home/YOUR-USERNAME/scripts/refresh-claude-token.sh >> /home/YOUR-USERNAME/logs/token-refresh.log 2>&1
```

**How it works:**

- `refresh-claude-token.sh` refreshes the OAuth token in `~/.claude/.credentials.json`
- Then automatically calls `sync-oauth-tokens.sh` to sync tokens to all OpenClaw agent directories

**Verification:**

```bash
# Check token expiry
python3 -c "import json, datetime; c=json.load(open('$HOME/.claude/.credentials.json')); print('Expires:', datetime.datetime.fromtimestamp(c['claudeAiOauth']['expiresAt']/1000))"

# Verify cron entry exists
crontab -l | grep refresh-claude-token

# Check recent refresh logs
tail -20 ~/logs/token-refresh.log
```

**Without this cron job, your agent will stop responding after ~24 hours when the OAuth token expires.**

---

## Dashboard

- [ ] **Install claw-interface (Dashboard)** — Set up the web dashboard for managing agents, tasks, and monitoring.

```bash
# Clone the dashboard repository
cd ~/
git clone https://github.com/YOUR-USERNAME/claw-interface.git
cd claw-interface

# Install dependencies
npm install

# Build for production
npm run build

# Deploy (configure your deployment method)
npm run deploy
```

**Verification:**

- Dashboard accessible at your configured URL
- Can view agent status and task queue
- Real-time updates working

**Reference:** See claw-interface README for deployment options (Vercel, self-hosted, etc.)

## Security Hardening

- [ ] **Harden SSH access** — Disable password auth, use keys only

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Set these values:
# PasswordAuthentication no
# PubkeyAuthentication yes
# PermitRootLogin no

# Restart SSH
sudo systemctl restart sshd
```

**Verification:** Try password login from another machine — it should fail.

- [ ] **Install fail2ban** — Auto-ban brute force attempts

```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

- [ ] **Confirm closed ports (Security)** — Harden your server by closing unnecessary ports. Only essential services should be accessible.

```bash
# Check firewall status
sudo ufw status

# Expected: Only essential ports open (22 for SSH, 443 for HTTPS, etc.)
# Close any unnecessary ports
sudo ufw deny PORT_NUMBER
```

**Expected output:**

```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

**Verification:** Run `nmap localhost` - should show minimal open ports

- [ ] **Install gitleaks** — Secret scanning for repositories

```bash
# Install gitleaks
wget https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.21.2_linux_x64.tar.gz
tar -xzf gitleaks_8.21.2_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
rm gitleaks_8.21.2_linux_x64.tar.gz

# Verify
gitleaks version
```

- [ ] **Set up pre-commit hooks** — Prevent secret commits

```bash
# In each project repo
cd ~/your-project
cp /path/to/claw-kernel/scripts/setup-precommit.sh .
chmod +x setup-precommit.sh
./setup-precommit.sh
```

**Verification:**

```bash
# Test gitleaks
cd ~/your-project
gitleaks detect

# Test pre-commit hook (should block the commit)
echo "PASSWORD=secret123" > test-secret.txt
git add test-secret.txt
git commit -m "test"  # Should fail with gitleaks error
rm test-secret.txt
```

- [ ] **Configure Cloudflare Zero Trust** — Set up Cloudflare tunnel for secure access without exposing ports.

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create YOUR-TUNNEL-NAME

# Configure tunnel
# Edit ~/.cloudflared/config.yml with your tunnel settings
```

**Setup steps:**

1. Create Cloudflare tunnel
2. Configure DNS records
3. Set up Access policies for authentication
4. Test tunnel connectivity

**Reference:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

## Backup System

- [ ] **Set up Google Drive backup sync** — Protect against data loss

**Install rclone:**

```bash
curl https://rclone.org/install.sh | sudo bash
```

**Configure Google Drive:**

```bash
# Interactive setup
rclone config

# Create remote named "gdrive"
# Select: Google Drive
# Follow OAuth flow
```

**Install backup script:**

```bash
cp /path/to/claw-kernel/scripts/backup-to-gdrive.sh ~/scripts/
chmod +x ~/scripts/backup-to-gdrive.sh

# Test backup
~/scripts/backup-to-gdrive.sh
```

**Schedule daily backups:**

```bash
crontab -e

# Daily backup at 4am
0 4 * * * /home/YOUR-USERNAME/scripts/backup-to-gdrive.sh >> /home/YOUR-USERNAME/logs/backup.log 2>&1
```

**What gets backed up:**

- Workspace files (MEMORY.md, daily logs, config)
- OpenClaw config (`~/.openclaw/`)
- Skills and agent configurations

**Verification:**

```bash
# Check GDrive folder
rclone ls gdrive:OpenClaw-Backup/

# Check backup log
tail ~/logs/backup.log
```

**Recovery:** See `docs/recovery.md` for restore procedures.

## Resource Management

- [ ] **Set up RAM limits on systemd** — Prevent memory exhaustion by setting resource limits on the OpenClaw service.

```bash
# Edit systemd service file
sudo systemctl edit openclaw.service

# Add these lines in the override file:
[Service]
MemoryMax=4G
MemoryHigh=3.5G
```

**Restart service:**

```bash
sudo systemctl daemon-reload
sudo systemctl restart openclaw.service
```

**Verification:**

```bash
systemctl show openclaw.service | grep Memory
# Should show MemoryMax=4294967296 (4G) and MemoryHigh=3758096384 (3.5G)
```

- [ ] **Set up disk size warnings** — Monitor disk usage and get alerts before running out of space.

```bash
# Create monitoring script
cat > ~/check-disk-space.sh << 'EOF'
#!/bin/bash
THRESHOLD=80
USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "WARNING: Disk usage is at ${USAGE}%"
    # Add notification command here (e.g., telegram alert)
fi
EOF

chmod +x ~/check-disk-space.sh

# Add to crontab (runs daily at 9am)
(crontab -l 2>/dev/null; echo "0 9 * * * ~/check-disk-space.sh") | crontab -
```

**Verification:**

```bash
# Test the script
~/check-disk-space.sh

# Verify cron entry
crontab -l | grep check-disk-space
```

## Monitoring & Health Checks

- [ ] **Set up gateway watchdog** — Auto-restart on deadlock

**Install watchdog script:**

```bash
cp /path/to/claw-kernel/scripts/gateway-watchdog.sh ~/scripts/
chmod +x ~/scripts/gateway-watchdog.sh
```

**Schedule watchdog (every 5 minutes):**

```bash
crontab -e

# Check every 5 minutes
*/5 * * * * /home/YOUR-USERNAME/scripts/gateway-watchdog.sh >> /home/YOUR-USERNAME/logs/watchdog.log 2>&1
```

**What it does:**

- Checks the gateway health endpoint with a 30-second timeout
- Restarts the service automatically if unresponsive
- Logs all actions for debugging

**Verification:**

```bash
# Test watchdog
~/scripts/gateway-watchdog.sh

# Check watchdog log
tail ~/logs/watchdog.log
```

## Automation

- [ ] **Schedule cron jobs** — Set up both system-level and OpenClaw cron jobs for automated maintenance.

**Complete cron setup (combines all scripts from above):**

```bash
crontab -e

# === Token Management ===
# Refresh OAuth tokens every 6 hours
0 */6 * * * /home/YOUR-USERNAME/scripts/refresh-claude-token.sh >> /home/YOUR-USERNAME/logs/token-refresh.log 2>&1

# === Backup ===
# Daily backup at 4am
0 4 * * * /home/YOUR-USERNAME/scripts/backup-to-gdrive.sh >> /home/YOUR-USERNAME/logs/backup.log 2>&1

# === Monitoring ===
# Gateway watchdog every 5 minutes
*/5 * * * * /home/YOUR-USERNAME/scripts/gateway-watchdog.sh >> /home/YOUR-USERNAME/logs/watchdog.log 2>&1

# Disk space check daily at 9am
0 9 * * * /home/YOUR-USERNAME/check-disk-space.sh >> /home/YOUR-USERNAME/logs/disk-check.log 2>&1
```

**OpenClaw Cron Jobs** (agent behaviors):
Configure in OpenClaw's HEARTBEAT.md:

- **Maintenance:** Daily system checks, log rotation, cleanup
- **Self-improvement:** Weekly code analysis, refactoring suggestions
- **Morning brief:** Daily summary of tasks, reminders, and updates

**Verification:**

```bash
# Verify all cron entries
crontab -l
```

- [ ] **Set up daily brief** — Configure the morning brief with your preferences.

**Configure in HEARTBEAT.md or USER.md:**

```markdown
## Daily Brief Configuration

- Time: 8:00 AM YOUR-TIMEZONE
- Include:
  - Weather forecast
  - Task summary (overdue, due today, upcoming)
  - Calendar events
  - Important notifications from previous day
  - Quick stats (system health, recent completions)
```

**Verification:** Wait for next scheduled brief, or trigger manually to test

## External Services

- [ ] **Set up GitHub for bot** — Create a dedicated GitHub account for the bot and configure access.

**Steps:**

1. Create new GitHub account (e.g., YOUR-BOT-NAME)
2. Generate Personal Access Token (PAT):
   - Go to Settings > Developer settings > Personal access tokens
   - Create token with `repo` scope
3. Store token securely in Bitwarden (see next step)
4. Add token to OpenClaw configuration:
   ```bash
   # Store in secure location
   echo "YOUR-GITHUB-PAT" > ~/.config/openclaw/github-token
   chmod 600 ~/.config/openclaw/github-token
   ```

**Verification:**

```bash
# Test token
curl -H "Authorization: token $(cat ~/.config/openclaw/github-token)" \
  https://api.github.com/user
```

- [ ] **Set up Bitwarden + password skill** — Install Bitwarden CLI for secure credential management.

```bash
# Install Bitwarden CLI
npm install -g @bitwarden/cli

# Login
bw login YOUR-EMAIL

# Unlock vault (do this in each terminal session)
export BW_SESSION=$(bw unlock --raw)

# Test retrieval
bw get item "GitHub PAT" --session $BW_SESSION
```

**Set up encryption:**

```bash
# Create encryption key for OpenClaw
openssl rand -base64 32 > ~/.config/openclaw/encryption-key
chmod 600 ~/.config/openclaw/encryption-key
```

**Configure password skill:**

- Add Bitwarden vault ID to OpenClaw config
- Test credential retrieval through OpenClaw commands
- Ensure auto-lock is configured (e.g., 1 hour timeout)

**Reference:** https://bitwarden.com/help/cli/

## Understanding the Coding Workflow

- [ ] **Read and understand the coding workflow** — How your agent develops code autonomously

OpenClaw's coding workflow uses **orchestration** — you don't write code directly, you spawn specialized developer agents that use Claude Code.

**The Flow:**

1. **PRD Creation** — Define what needs to be built (Product Requirements Document)
2. **Developer Agent** — Spawns in isolated session, uses Claude Code to implement
3. **Code Review Agent** — Reviews the PR, checks tests, validates requirements
4. **Merge** — Main agent approves and merges after review passes

**Files involved:**

- `skills/coding/SKILL.md` — Your orchestration manual (read this!)
- `.agents/developer/AGENTS.md` — Developer agent's instructions
- `.agents/code-reviewer/AGENTS.md` — Reviewer agent's instructions
- `HEARTBEAT.md` — Kanban workflow checklist

**Key concepts:**

- **Kanban board** — Cards move through: backlog > in_progress > review > done
- **PRDs** — Every significant task needs a PRD before work begins
- **Definition of Done** — PR created, tests pass, review passes, then merge
- **Quality over speed** — Always implement reviewer suggestions

**Getting started:**

1. Read `docs/skills/coding.md` for the full guide
2. Create a test card on your kanban board
3. Write a simple PRD
4. Spawn a developer agent and watch the flow
5. Review the PR, merge it

## Memory System

- [ ] **Understand the memory system** — How your agent remembers across sessions

**Two types of memory:**

1. **Short-term (Daily Logs)** — `memory/YYYY-MM-DD.md`
   - Raw notes from each day
   - Session context, decisions, events
   - Automatically created by your agent
   - Kept for reference, reviewed periodically

2. **Long-term (Curated Memory)** — `MEMORY.md`
   - Distilled insights, lessons learned, important context
   - Updated by your agent (you review and curate)
   - Loaded every session (this is your persistent memory)
   - Think of it like a human's long-term memory

**How it works:**

- Your agent wakes up fresh each session (no memory of previous sessions)
- First action: Read `MEMORY.md` + recent daily logs
- As session progresses: Write to today's daily log
- Periodically: Review daily logs, update `MEMORY.md` with important insights

**Files:**

- `MEMORY.md` — Your curated long-term memory
- `memory/YYYY-MM-DD.md` — Daily raw logs (auto-created)
- `AGENTS.md` — Instructions include "Read MEMORY.md every session"

**Why this matters:**

- Memory = continuity across sessions
- Without MEMORY.md, your agent starts from zero every time
- With MEMORY.md, your agent learns and improves over time

**No setup required** — The system is already in place. Just understand how it works.

## Testing

- [ ] **Test interface + workflow** — Verify the complete workflow end-to-end.

**Test checklist:**

1. **Access dashboard**
   - Open claw-interface URL
   - Verify authentication works
   - Check agent status is visible

2. **Create a test card**
   - Use dashboard or CLI to create a simple task card
   - Verify card appears in task queue

3. **Spawn an agent**
   - Create a test card that triggers developer agent
   - Monitor agent activity in dashboard
   - Verify agent completes task successfully

4. **Test PR workflow**
   - Agent should create feature branch
   - Make changes and commit
   - Create PR automatically
   - Verify PR appears in GitHub

5. **Test notifications**
   - Verify you receive completion notification
   - Check error alerts are working

**Success criteria:**

- Dashboard shows real-time agent status
- Can create and track tasks through web interface
- Agents can autonomously complete coding tasks
- PRs are created and linked to task cards
- Notifications arrive as expected

---

_When every box is checked, this file disappears. You're fully operational._
