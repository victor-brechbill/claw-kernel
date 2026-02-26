---
title: "SETUP.md Template"
summary: "Post-onboarding infrastructure checklist"
read_when:
  - Setting up production infrastructure after onboarding
---

# SETUP.md - Production Infrastructure Checklist

_Onboarding complete. Now let's build out your production environment._

Work through these infrastructure steps together. Check each box as you go. When all 10 are done, this file auto-removes.

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

## Security

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

## Automation

- [ ] **Schedule cron jobs** — Set up both system-level and OpenClaw cron jobs for automated maintenance.

**System Cron Jobs** (server maintenance):

```bash
# Edit system crontab
sudo crontab -e

# Add these jobs:
# Refresh authentication tokens (daily at 2am)
0 2 * * * /home/YOUR-USERNAME/scripts/refresh-tokens.sh

# Backup configuration (daily at 3am)
0 3 * * * /home/YOUR-USERNAME/scripts/backup-config.sh
```

**OpenClaw Cron Jobs** (agent behaviors):
Configure in OpenClaw's HEARTBEAT.md:

- **Maintenance:** Daily system checks, log rotation, cleanup
- **Self-improvement:** Weekly code analysis, refactoring suggestions
- **Morning brief:** Daily summary of tasks, reminders, and updates

**Verification:**

```bash
# System cron
sudo crontab -l

# OpenClaw cron
cat ~/HEARTBEAT.md
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
   - Go to Settings → Developer settings → Personal access tokens
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

- ✅ Dashboard shows real-time agent status
- ✅ Can create and track tasks through web interface
- ✅ Agents can autonomously complete coding tasks
- ✅ PRs are created and linked to task cards
- ✅ Notifications arrive as expected

---

_When every box is checked, this file disappears. You're fully operational._
