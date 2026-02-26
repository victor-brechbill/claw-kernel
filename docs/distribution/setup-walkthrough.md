# Setup Walkthrough

After onboarding (`openclaw onboard`), a `SETUP.md` file appears in your agent's workspace. This is a production infrastructure checklist — 10 items that take your installation from "working" to "production-ready."

This guide walks through each checklist item with detailed explanations, expected outcomes, and tips.

> When every checkbox in SETUP.md is complete, the file auto-removes.

## Overview

| #   | Section                                                     | What it does                               |
| --- | ----------------------------------------------------------- | ------------------------------------------ |
| 1   | [Dashboard](#1-install-the-dashboard)                       | Web UI for managing agents and tasks       |
| 2   | [Closed Ports](#2-confirm-closed-ports)                     | Harden server firewall                     |
| 3   | [Cloudflare Zero Trust](#3-configure-cloudflare-zero-trust) | Secure tunnel access without exposed ports |
| 4   | [RAM Limits](#4-set-up-ram-limits)                          | Prevent memory exhaustion                  |
| 5   | [Disk Warnings](#5-set-up-disk-size-warnings)               | Monitor disk usage                         |
| 6   | [Cron Jobs](#6-schedule-cron-jobs)                          | Automated maintenance and agent behaviors  |
| 7   | [Daily Brief](#7-set-up-daily-brief)                        | Morning summary of tasks and updates       |
| 8   | [GitHub Bot](#8-set-up-github-for-bot)                      | Dedicated GitHub account for agent         |
| 9   | [Bitwarden](#9-set-up-bitwarden--password-skill)            | Secure credential management               |
| 10  | [Test Workflow](#10-test-interface--workflow)               | End-to-end verification                    |

---

## 1. Install the Dashboard

**What:** The claw-interface dashboard is a web-based control center for managing agents, viewing task queues, and monitoring system health.

**Steps:**

```bash
# Clone the dashboard repository
cd ~/
git clone https://github.com/YOUR-USERNAME/claw-interface.git
cd claw-interface

# Install dependencies
npm install

# Build for production
npm run build

# Deploy (see claw-interface README for options)
npm run deploy
```

**Expected outcome:**

- Dashboard accessible at your configured URL
- Agent status visible on the home page
- Task queue showing in the kanban board
- Real-time updates working (status refreshes every few seconds)

**Tips:**

- The dashboard is a Go backend + React frontend. See the [claw-interface README](https://github.com/YOUR-USERNAME/claw-interface) for full deployment options.
- For development, use `./dev.sh` to run both backend and frontend with hot reload.
- The dashboard connects to the OpenClaw gateway via WebSocket for real-time agent status.

**Screenshot:** [Dashboard home screen](./screenshots/SCREENSHOTS.md#dashboard-home)

---

## 2. Confirm Closed Ports

**What:** Ensure only essential ports are open on your server. Every unnecessary open port is a potential attack vector.

**Steps:**

```bash
# Check current firewall status
sudo ufw status

# If UFW is not active, enable it
sudo ufw enable

# Allow only what you need
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 443/tcp   # HTTPS (if applicable)

# Close anything unnecessary
sudo ufw deny PORT_NUMBER
```

**Expected outcome:**

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

**Verification:**

```bash
# Scan for open ports
nmap localhost
# Should show minimal open ports (just SSH and HTTPS)
```

**Tips:**

- If you're using Cloudflare Tunnel (next step), you may not need port 443 open at all.
- The OpenClaw gateway listens on `127.0.0.1:18789` by default — this is localhost-only and not exposed to the internet.
- Check for any unexpected listeners: `ss -tlnp`

---

## 3. Configure Cloudflare Zero Trust

**What:** Cloudflare Tunnel creates a secure connection from your server to the internet without exposing any ports. Combined with Zero Trust, it adds email-based authentication to your dashboard.

**Steps:**

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# Authenticate with your Cloudflare account
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create my-agent-tunnel

# Configure the tunnel
# Edit ~/.cloudflared/config.yml:
```

Example `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR-TUNNEL-ID
credentials-file: /home/YOUR-USER/.cloudflared/YOUR-TUNNEL-ID.json

ingress:
  - hostname: agent.yourdomain.com
    service: http://localhost:3080
  - service: http_status:404
```

```bash
# Add DNS record
cloudflared tunnel route dns my-agent-tunnel agent.yourdomain.com

# Test the tunnel
cloudflared tunnel run my-agent-tunnel
```

**Expected outcome:**

- Dashboard accessible at `https://agent.yourdomain.com`
- Zero Trust authentication prompt before accessing the dashboard
- No public ports exposed on your server

**Tips:**

- Set up cloudflared as a systemd service for persistence: `cloudflared service install`
- Configure Zero Trust Access policies in the Cloudflare dashboard to control who can access your agent.
- Reference: [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

---

## 4. Set Up RAM Limits

**What:** Prevent the OpenClaw gateway from consuming all available memory. This is especially important for long-running agent sessions.

**Steps:**

```bash
# Edit the systemd service override
systemctl --user edit openclaw-gateway.service
```

Add these lines:

```ini
[Service]
MemoryMax=4G
MemoryHigh=3.5G
```

```bash
# Apply changes
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway.service
```

**Expected outcome:**

```bash
systemctl --user show openclaw-gateway.service | grep Memory
# MemoryMax=4294967296 (4G)
# MemoryHigh=3758096384 (3.5G)
```

**Tips:**

- `MemoryHigh` is a soft limit — the process gets throttled when it exceeds this. `MemoryMax` is the hard kill limit.
- Adjust values based on your server's total RAM. A good rule of thumb: leave at least 2-4 GB for the OS and other services.
- For servers with 16 GB RAM, `MemoryMax=12G` / `MemoryHigh=10G` is reasonable.
- If using swap (recommended), configure it as a safety net: `sudo fallocate -l 8G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`

---

## 5. Set Up Disk Size Warnings

**What:** Get alerted before your server runs out of disk space. Agent memory logs, conversation history, and build artifacts can accumulate over time.

**Steps:**

```bash
# Create monitoring script
cat > ~/check-disk-space.sh << 'EOF'
#!/bin/bash
THRESHOLD=80
USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "WARNING: Disk usage is at ${USAGE}%"
    # Add your notification method here:
    # - Send a Telegram message via bot API
    # - Write to a monitored log file
    # - Trigger an alert via webhook
fi
EOF

chmod +x ~/check-disk-space.sh

# Schedule to run daily at 9am
(crontab -l 2>/dev/null; echo "0 9 * * * ~/check-disk-space.sh") | crontab -
```

**Verification:**

```bash
# Test the script manually
~/check-disk-space.sh

# Verify the cron entry exists
crontab -l | grep check-disk-space
```

**Tips:**

- Customize the `THRESHOLD` value based on your disk size. 80% is a good default.
- Common disk space consumers: `/tmp/openclaw/` (logs), `~/.openclaw/workspace/memory/` (agent memory), and `node_modules/`.
- To clean up old logs: `find /tmp/openclaw/ -name "*.log" -mtime +7 -delete`

---

## 6. Schedule Cron Jobs

**What:** Set up automated tasks at both the system level (server maintenance) and the agent level (periodic behaviors).

### System-Level Cron Jobs

```bash
# Edit your crontab
crontab -e

# Add maintenance jobs:
# Refresh auth tokens daily at 2am
0 2 * * * /home/YOUR-USER/scripts/refresh-tokens.sh

# Backup config daily at 3am
0 3 * * * cp ~/.openclaw/openclaw.json ~/.openclaw/backups/openclaw-$(date +\%Y\%m\%d).json

# Clean old logs weekly
0 4 * * 0 find /tmp/openclaw/ -name "*.log" -mtime +14 -delete
```

### Agent-Level Cron (Heartbeat)

Configure periodic agent behaviors in your OpenClaw config:

```json5
// ~/.openclaw/openclaw.json
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last", // deliver to the last active channel
      },
    },
  },
}
```

The heartbeat system uses `HEARTBEAT.md` in your workspace to define what the agent checks periodically (inbox, projects, environment health, etc.).

**Verification:**

```bash
# Check system cron jobs
crontab -l

# Check OpenClaw cron status
openclaw cron status
openclaw cron list
```

---

## 7. Set Up Daily Brief

**What:** Configure your agent to send a daily summary with task updates, system health, and reminders.

**Configure in your workspace's HEARTBEAT.md or USER.md:**

```markdown
## Daily Brief Configuration

- Time: 8:00 AM (your timezone)
- Include:
  - Task summary (overdue, due today, upcoming)
  - System health (disk, memory, service status)
  - Recent completions and activity log
  - Quick stats and reminders
```

You can also set up a dedicated cron job for the brief:

```json5
// In openclaw.json
{
  cron: {
    enabled: true,
    maxConcurrentRuns: 2,
  },
}
```

**Expected outcome:** A daily message in your configured channel with a summary of status, tasks, and any actionable items.

**Tips:**

- Start simple — you can always add more sections to the brief later.
- The heartbeat system checks `HEARTBEAT.md` for tasks to run each cycle. Lines starting with `#` are comment-only (zero API cost).

---

## 8. Set Up GitHub for Bot

**What:** Create a dedicated GitHub account for your agent so it can create branches, commits, and pull requests autonomously.

**Steps:**

1. **Create a GitHub account** for your agent (e.g., `my-agent-bot`)

2. **Generate a Personal Access Token (PAT):**
   - Go to Settings > Developer settings > Personal access tokens > Fine-grained tokens
   - Create a token with `repo` scope for your repositories
   - Set an appropriate expiration (90 days recommended)

3. **Store the token securely:**

   ```bash
   mkdir -p ~/.config/openclaw
   echo "YOUR_GITHUB_PAT" > ~/.config/openclaw/github-token
   chmod 600 ~/.config/openclaw/github-token
   ```

4. **Configure Git on the server:**

   ```bash
   git config --global user.name "My Agent Bot"
   git config --global user.email "bot@yourdomain.com"
   ```

5. **Add the bot as a collaborator** to your repositories

**Verification:**

```bash
curl -H "Authorization: token $(cat ~/.config/openclaw/github-token)" \
  https://api.github.com/user
# Should return the bot account's profile
```

**Tips:**

- Use fine-grained tokens scoped to specific repositories for better security.
- Set up branch protection rules to require PR reviews, so the bot can't push directly to main.
- The pre-loaded developer agent config (`.agents/developer/`) includes a complete PR workflow.

---

## 9. Set Up Bitwarden + Password Skill

**What:** Use Bitwarden CLI for secure credential management so your agent can retrieve secrets without them being stored in plaintext config files.

**Steps:**

```bash
# Install Bitwarden CLI
npm install -g @bitwarden/cli

# Log in
bw login YOUR_EMAIL

# Unlock vault (needed each terminal session)
export BW_SESSION=$(bw unlock --raw)

# Test credential retrieval
bw get item "GitHub PAT" --session $BW_SESSION
```

**Set up encryption for OpenClaw:**

```bash
mkdir -p ~/.config/openclaw
openssl rand -base64 32 > ~/.config/openclaw/encryption-key
chmod 600 ~/.config/openclaw/encryption-key
```

**Expected outcome:**

- Bitwarden CLI installed and authenticated
- Can retrieve credentials programmatically
- Encryption key generated for secure local storage

**Tips:**

- Configure auto-lock for the Bitwarden session (e.g., 1-hour timeout).
- Store all sensitive values (API keys, tokens, passwords) in Bitwarden rather than in config files.
- Reference: [Bitwarden CLI docs](https://bitwarden.com/help/cli/)

---

## 10. Test Interface + Workflow

**What:** Verify the complete workflow end-to-end — from creating a task to agent completion.

### Test Checklist

1. **Access the dashboard**
   - Open your dashboard URL
   - Verify authentication works
   - Confirm agent status is visible on the home screen

2. **Create a test card**
   - Go to the Kanban board
   - Create a simple task card (e.g., "Create a test file")
   - Verify the card appears in the Backlog column

3. **Spawn an agent**
   - Move the card to "In Progress" or assign it to trigger the developer agent
   - Monitor agent activity in the dashboard's system page
   - Watch for status updates in real-time

4. **Test the PR workflow**
   - Agent should create a feature branch
   - Make changes and commit
   - Create a pull request automatically
   - Verify the PR appears in GitHub

5. **Test notifications**
   - Confirm you receive a completion notification in your messaging channel
   - Check that error alerts work by observing any failed operations

### Success Criteria

- Dashboard shows real-time agent status
- Can create and track tasks through the web interface
- Agents can autonomously complete coding tasks
- PRs are created and linked to task cards
- Notifications arrive in your configured messaging channel

**Screenshot:** [Kanban board with test card](./screenshots/SCREENSHOTS.md#kanban-board)

---

## You're Done

When every box in SETUP.md is checked, the file auto-removes from your workspace. Your agent is now fully operational with:

- A web dashboard for task management
- Secure, tunneled access with authentication
- Resource limits and monitoring
- Automated maintenance and health checks
- GitHub integration for autonomous development
- Secure credential management
- A verified end-to-end workflow

### What's Next

- Customize your agent's personality and workspace files (`AGENTS.md`, `IDENTITY.md`, `SOUL.md`)
- Add custom skills to the `skills/` directory
- Configure additional messaging channels with `openclaw configure`
- Explore the [OpenClaw documentation](https://docs.openclaw.ai) for advanced features

If you run into issues, see the [Troubleshooting Guide](./troubleshooting.md).
