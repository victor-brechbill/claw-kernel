# Troubleshooting

Quick fixes for the most common issues. If you're stuck, start with the [Quick Diagnostics](#quick-diagnostics) section.

## Quick Diagnostics

Run these commands in order — they cover 90% of issues:

```bash
openclaw status              # Overview of channels and auth
openclaw status --all        # Full report (shareable)
openclaw gateway status      # Gateway process state + RPC check
openclaw doctor              # Automated config/service diagnostics
openclaw channels status --probe   # Channel connectivity
openclaw logs --follow       # Live log stream
```

**What "healthy" looks like:**

- `openclaw status` — shows configured channels, no auth errors
- `openclaw gateway status` — `Runtime: running`, `RPC probe: ok`
- `openclaw doctor` — no blocking errors
- `openclaw channels status --probe` — channels report `connected` or `ready`
- `openclaw logs --follow` — steady activity, no repeating errors

---

## Installation Issues

### Node.js version too old

```
Error: Node.js 22+ required (found v18)
```

**Fix:** Upgrade Node.js to 22 or newer.

```bash
# Using nvm
nvm install 22
nvm use 22
nvm alias default 22

# Verify
node -v
```

### pnpm build fails

```
ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY
```

**Fix:** The lockfile may be out of sync. Try:

```bash
cd ~/claw-kernel
pnpm install     # without --frozen-lockfile
pnpm build
```

If that fails, clean and rebuild:

```bash
rm -rf node_modules
pnpm install
pnpm build
```

### `openclaw` command not found after install

**Fix:** The global npm bin directory may not be in your PATH.

```bash
# Find where npm installs global packages
npm config get prefix

# Add to PATH (add to ~/.bashrc or ~/.zshrc for persistence)
export PATH="$(npm config get prefix)/bin:$PATH"

# Verify
openclaw --version
```

### Permission errors during `npm install -g .`

**Fix:** Avoid using `sudo` with npm. Instead, configure a user-level global directory:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g .
```

---

## Onboarding Issues

### Onboarding wizard hangs or exits

**Fix:** Run with verbose output to see what's happening:

```bash
openclaw onboard --verbose
```

If it hangs at the auth step, check that you have a working internet connection and your API provider credentials are correct.

### Can't find channel tokens

**Telegram:** Create a bot via [@BotFather](https://t.me/botfather) on Telegram. Use the `/newbot` command and copy the token.

**Discord:** Create a bot at [discord.com/developers](https://discord.com/developers/applications). Go to Bot > Token > Copy.

**WhatsApp:** The onboarding wizard handles WhatsApp pairing via QR code. Make sure you have WhatsApp installed on your phone.

---

## Gateway Issues

### Gateway won't start

```
Gateway start blocked: set gateway.mode=local
```

**Fix:** The gateway mode needs to be set. Run:

```bash
openclaw config set gateway.mode "local"
openclaw gateway start
```

### Port already in use

```
EADDRINUSE: address already in use :::18789
```

**Fix:** Another gateway instance (or another process) is using port 18789.

```bash
# Find what's using the port
lsof -i :18789

# If it's a stale gateway process, kill it
kill $(lsof -t -i :18789)

# Or change the port in config
openclaw config set gateway.port 18790
```

### Gateway crashes on startup with config error

```
Config validation failed
```

**Fix:** The config file has invalid content.

```bash
# Run the doctor to diagnose
openclaw doctor

# Auto-fix common issues
openclaw doctor --fix

# Or restore from backup
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json
```

### Gateway won't bind on non-localhost

```
refusing to bind gateway ... without auth
```

**Fix:** If binding to a non-loopback address, authentication is required:

```bash
openclaw config set gateway.auth.token "your-secret-token"
```

---

## Channel Issues

### Bot doesn't respond to messages

Run the diagnostic ladder:

```bash
openclaw channels status --probe
openclaw pairing list telegram   # or discord, whatsapp
openclaw logs --follow
```

**Common causes:**

| Log message                             | Meaning                      | Fix                                             |
| --------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `drop guild message (mention required)` | Discord group mention gating | Mention the bot with @name                      |
| `pairing request`                       | Sender not approved          | Approve the pairing request                     |
| `blocked` / `allowlist`                 | Sender filtered              | Add sender to `allowFrom` in config             |
| `401` / `403` / `Forbidden`             | Token expired or invalid     | Re-enter channel token via `openclaw configure` |

### WhatsApp QR code won't scan

**Fix:**

1. Make sure your phone has WhatsApp open
2. Go to Settings > Linked Devices > Link a Device
3. Scan the QR code displayed in the terminal
4. If the QR expires, restart the gateway: `openclaw gateway restart`

### Telegram bot works in DMs but not in groups

**Fix:** Ensure the bot has the right permissions:

1. Add the bot to the group
2. Make it an admin (or at least grant "Read Messages" permission)
3. If mention gating is on, mention the bot with @botname

Check your config for group settings:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
}
```

---

## Configuration Issues

### Config changes aren't taking effect

The gateway hot-reloads most config changes automatically. But some settings require a restart:

**Hot-reloads (no restart needed):**

- Channels, agents, models, routing
- Automation (hooks, cron, heartbeat)
- Sessions, messages, tools, media

**Requires restart:**

- `gateway.*` (port, bind, auth, TLS)
- `discovery`, `plugins`

```bash
# Force restart after config change
systemctl --user restart openclaw-gateway
```

### "Unknown key" errors in config

OpenClaw uses strict schema validation. Unknown keys cause startup failure.

```bash
# Diagnose
openclaw doctor

# Auto-fix
openclaw doctor --fix

# Or remove the offending key manually
openclaw config unset the.unknown.key
```

---

## Performance Issues

### High memory usage

```bash
# Check current memory usage
systemctl --user status openclaw-gateway | grep Memory

# Check system-wide
free -h

# View OpenClaw process specifically
ps aux | grep openclaw | grep -v grep
```

**Fixes:**

- Set systemd memory limits (see [Setup Walkthrough](./setup-walkthrough.md#4-set-up-ram-limits))
- Reduce concurrent sessions: `openclaw config set session.maxConcurrent 3`
- Add swap space as a safety net:

  ```bash
  sudo fallocate -l 8G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  ```

### Gateway becomes unresponsive

```bash
# Check if the process is alive
openclaw gateway status

# Check for event loop stalls in logs
openclaw logs --follow | grep -i "deadlock\|timeout\|unresponsive"

# Hard restart
systemctl --user restart openclaw-gateway
```

### Disk space running low

```bash
# Check disk usage
df -h /

# Find large directories
du -sh /tmp/openclaw/ ~/.openclaw/workspace/memory/ ~/claw-kernel/node_modules/

# Clean up old logs
find /tmp/openclaw/ -name "*.log" -mtime +7 -delete

# Clean up old memory files (be careful — these are agent memories)
# Only delete if you're sure they're no longer needed
```

---

## Dashboard Issues

### Dashboard shows "offline" status

**Fix:** Check that the gateway is running and the dashboard can reach it.

```bash
# Is the gateway running?
openclaw gateway status

# Can you reach the health endpoint?
curl -s http://localhost:18789/health | jq .

# Is the dashboard service running?
systemctl --user status dashboard.service   # or your dashboard service name
```

### Dashboard not loading after deployment

```bash
# Check the dashboard backend
curl http://localhost:3080/api/health

# Check logs
journalctl --user -u your-dashboard-service -f

# Verify the frontend build exists
ls -la ~/your-dashboard/frontend/dist/
```

---

## Useful Debug Commands

### Full system report

```bash
openclaw status --all > ~/openclaw-report.txt
```

This generates a shareable report with all system info, channel status, and configuration (with secrets redacted).

### Log investigation

```bash
# Follow logs in real-time
openclaw logs --follow

# Search for errors
openclaw logs --follow | grep -i "error\|fatal\|crash"

# View raw log files
ls -la /tmp/openclaw/
tail -100 /tmp/openclaw/openclaw-*.log
```

### Health checks

```bash
# Gateway health
curl -s http://localhost:18789/health | jq .

# System resources
free -h          # Memory
df -h /          # Disk
uptime           # Load average
```

### Reset to clean state

If all else fails, you can reset the gateway to a clean state:

```bash
# Stop the gateway
systemctl --user stop openclaw-gateway

# Back up your config
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup

# Reset and re-onboard
openclaw onboard

# Start fresh
openclaw gateway start
```

---

## Getting Help

### Self-service resources

- [OpenClaw Documentation](https://docs.openclaw.ai) — Full upstream documentation
- [OpenClaw Discord](https://discord.gg/clawd) — Community chat and support
- [GitHub Issues](https://github.com/openclaw/openclaw/issues) — Bug reports and feature requests

### Before asking for help

1. Run `openclaw status --all` and save the output
2. Check `openclaw logs --follow` for error messages
3. Run `openclaw doctor` and note any findings
4. Note what changed before the issue started (config change, update, etc.)

### Reporting a bug

When filing an issue, include:

- Output of `openclaw status --all`
- Relevant log lines from `openclaw logs`
- Steps to reproduce the issue
- Your OS and Node.js version (`node -v`)
- Whether you're using the systemd service or running manually
