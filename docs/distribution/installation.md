# Installation Guide

This guide walks you through installing claw-kernel, a streamlined fork of [OpenClaw](https://github.com/openclaw/openclaw) focused on Telegram, Discord, and WhatsApp channels.

## Prerequisites

Before you begin, make sure you have:

| Requirement | Version              | Check command    |
| ----------- | -------------------- | ---------------- |
| **Node.js** | 22.12.0 or newer     | `node -v`        |
| **Git**     | Any recent version   | `git --version`  |
| **pnpm**    | 10+ (auto-installed) | `pnpm --version` |

**Operating system:** Linux (Ubuntu 22.04+), macOS 13+, or Windows via WSL2.

**Hardware minimums:**

- 2 CPU cores
- 4 GB RAM (8+ GB recommended for multi-agent workloads)
- 2 GB free disk space

### Installing Node.js

If you don't have Node.js 22+:

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Verify
node -v   # should print v22.x.x or newer
```

## Quick Install (Recommended)

Run the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/claw-kernel/main/install-claw-kernel.sh | bash
```

The script will:

1. Verify Node.js 22+ is installed
2. Install pnpm if missing
3. Clone the repository to `~/claw-kernel`
4. Install dependencies and build
5. Install the `openclaw` CLI globally

After the script finishes, continue to [Post-Installation Setup](#post-installation-setup).

## Manual Installation

If you prefer to install step by step:

```bash
# 1. Clone the repository
git clone https://github.com/YOUR-USERNAME/claw-kernel.git ~/claw-kernel
cd ~/claw-kernel

# 2. Install pnpm (if not already installed)
npm install -g pnpm

# 3. Install dependencies
pnpm install --frozen-lockfile

# 4. Build the project
pnpm build

# 5. Install the CLI globally
npm install -g .
```

### Verify the installation

```bash
# Check the CLI is available
openclaw --version

# Check system health
openclaw doctor
```

Expected output from `openclaw --version`: a version string like `2026.2.16`.

## Post-Installation Setup

### 1. Run onboarding

The onboarding wizard configures your API keys and messaging channels:

```bash
openclaw onboard
```

The wizard will guide you through:

- **Authentication** — Set up your AI provider (Anthropic, OpenAI, etc.)
- **Channels** — Connect Telegram, Discord, or WhatsApp
- **Workspace** — Configure your agent's home directory

### 2. Start the gateway

```bash
openclaw gateway start
```

This starts the gateway process in the foreground. You should see output confirming the gateway is running on `ws://127.0.0.1:18789`.

### 3. Send a test message

Open your configured messaging channel (e.g., Telegram) and send a message to your bot. You should receive a response within a few seconds.

### 4. Install as a system service (recommended)

For production use, install the gateway as a systemd service so it runs automatically on boot:

```bash
openclaw gateway install
```

This creates a user-level systemd service. Manage it with:

```bash
# Check status
systemctl --user status openclaw-gateway

# Stop
systemctl --user stop openclaw-gateway

# Restart
systemctl --user restart openclaw-gateway

# View logs
journalctl --user -u openclaw-gateway -f
```

## Configuration

The configuration file is located at `~/.openclaw/openclaw.json` (JSON5 format, which supports comments and trailing commas).

### Minimal configuration

```json5
// ~/.openclaw/openclaw.json
{
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
    },
  },
  channels: {
    telegram: {
      botToken: "YOUR_BOT_TOKEN",
      allowFrom: ["YOUR_TELEGRAM_USER_ID"],
    },
  },
}
```

### Editing configuration

You have several options:

```bash
# Interactive wizard
openclaw configure

# Set individual values
openclaw config set agents.defaults.heartbeat.every "30m"

# View current config
openclaw config get

# Direct file edit (the gateway watches for changes and hot-reloads)
nano ~/.openclaw/openclaw.json
```

> **Warning:** Invalid JSON in the config file will prevent the gateway from starting. Always validate before saving, or use `openclaw configure` for a guided experience.

For full configuration details, see the [OpenClaw Configuration docs](https://docs.openclaw.ai/gateway/configuration).

## Key Paths

| Path                           | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `~/claw-kernel/`               | Source code and build output            |
| `~/.openclaw/openclaw.json`    | Configuration file                      |
| `~/.openclaw/workspace/`       | Agent workspace (files, memory, skills) |
| `/tmp/openclaw/openclaw-*.log` | Runtime logs                            |

## Updating

To update to the latest version:

```bash
cd ~/claw-kernel
git pull
pnpm install --frozen-lockfile
pnpm build
npm install -g .
```

Then restart the gateway:

```bash
systemctl --user restart openclaw-gateway
```

## Uninstalling

```bash
# Remove the global CLI
npm uninstall -g openclaw

# Remove the systemd service (if installed)
systemctl --user stop openclaw-gateway
systemctl --user disable openclaw-gateway
rm ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload

# Remove the source code
rm -rf ~/claw-kernel

# Remove configuration and workspace (optional — this deletes all agent data)
rm -rf ~/.openclaw
```

## Next Steps

- [Setup Walkthrough](./setup-walkthrough.md) — Complete the SETUP.md production infrastructure checklist
- [Troubleshooting](./troubleshooting.md) — Common issues and how to resolve them
- [OpenClaw Documentation](https://docs.openclaw.ai) — Full upstream documentation
