# Claw Kernel

A streamlined, production-focused fork of [OpenClaw](https://github.com/openclaw/openclaw) — the multi-channel AI gateway runtime.

Claw Kernel removes 27 unused extensions from upstream OpenClaw and keeps a focused set of channels (Telegram, Discord, WhatsApp) for a leaner, easier-to-maintain deployment.

## Why Claw Kernel?

|                | OpenClaw                                                                  | Claw Kernel                         |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| **Channels**   | 20+ (Telegram, Discord, WhatsApp, Signal, Slack, IRC, Matrix, Teams, ...) | 3 (Telegram, Discord, WhatsApp)     |
| **Extensions** | Full set (~40)                                                            | Streamlined (13 removed categories) |
| **Focus**      | Broad platform support                                                    | Single-user production deployment   |
| **Updates**    | Rolling releases                                                          | Selective merges from upstream      |

**What's included:**

- Core runtime, tool system, and session management
- Telegram (primary), Discord, and WhatsApp channels
- Multi-agent orchestration (main agent + developer/reviewer/tester sub-agents)
- Browser automation, cron/scheduling, memory system
- Pre-loaded agent configs for developer and code-reviewer workflows
- Generic workspace templates for quick bootstrapping

**Forked from:** [OpenClaw v2026.2.17](https://github.com/openclaw/openclaw/tree/v2026.2.17)

## Quick Start

### Prerequisites

Before installing, you'll need:

#### 1. Server Setup (AWS EC2 Recommended)

**Recommended EC2 settings:**

- **Instance type:** t3.medium or larger (2 vCPU, 4GB RAM minimum)
- **Storage:** 50GB+ GP3 SSD
- **OS:** Ubuntu 22.04 LTS (or 24.04 LTS)
- **Security Group:** Allow inbound SSH (port 22) from your IP

**Launch instance:**

```bash
# Via AWS Console:
# 1. EC2 → Launch Instance
# 2. Choose Ubuntu Server 22.04 LTS
# 3. Select t3.medium (or larger for production)
# 4. Configure 50GB+ storage
# 5. Create/select key pair for SSH access
# 6. Launch and note the public IP

# Connect via SSH:
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

**Install Node.js 22+ on the server:**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs
```

```bash
node -v
```

(Should show v22.x.x or higher)

#### 2. Anthropic Account (Claude API Access)

**Requirements:**

- Anthropic account with **OAuth-enabled subscription**
- **Pro Max ($200/month)** or **Pro ($20/month + $100 monthly spend)** plan
- API-only accounts do NOT work (must have web access for OAuth)

**Setup:**

1. **Sign up for Anthropic:**
   - Go to [claude.ai](https://claude.ai) and create an account
   - Subscribe to Pro Max ($200/mo) or Pro plan ($20/mo + $100 usage)

2. **Install Claude Code on your EC2 server:**

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

   ```bash
   source ~/.bashrc
   ```

   ```bash
   claude --version
   ```

   (Should show Claude Code version)

3. **Get your OAuth token:**

   ```bash
   claude setup-token
   ```

   - This opens a browser link — visit it and authorize
   - Copy the token it provides
   - **Save this token** — you'll paste it during `openclaw onboard`

**Note:** API keys are supported but NOT recommended (expensive, ~$100/day). OAuth uses your Pro subscription and is much more cost-effective.

#### 3. Telegram Bot

**Create a bot with BotFather:**

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to choose a name and username
4. BotFather will give you a **bot token** (save this!)
5. Get your Telegram user ID:
   - Search for `@userinfobot` in Telegram
   - Send `/start`
   - Note your user ID (e.g., `123456789`)

**Example:**

```
You: /newbot
BotFather: Alright, a new bot. How are we going to call it?
You: My Assistant
BotFather: Good. Now let's choose a username for your bot.
You: my_assistant_bot
BotFather: Done! Your token is: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

Save the token and your user ID - you'll need both during onboarding.

---

### Install

**Run the install script:**

```bash
curl -fsSL https://raw.githubusercontent.com/victor-brechbill/claw-kernel/main/install-claw-kernel.sh | bash
```

**Reload your shell config:**

```bash
source ~/.bashrc
```

(or `source ~/.zshrc` if using zsh)

### Set up

```bash
# Configure channels and API keys
openclaw onboard

# Start the gateway
openclaw gateway start

# (Optional) Install as a persistent service
openclaw gateway install
```

### Verify

```bash
openclaw --version
openclaw gateway status
openclaw doctor
```

**See [Prerequisites](#prerequisites) above for server, Anthropic account, and Telegram bot setup. Full details: [Installation Guide](docs/distribution/installation.md)**

## Configuration

Located at `~/.openclaw/openclaw.json` (JSON5 format):

```json5
{
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
    },
  },
  channels: {
    telegram: {
      botToken: "YOUR_BOT_TOKEN",
      allowFrom: ["YOUR_USER_ID"],
    },
  },
}
```

Edit with `openclaw configure` (interactive) or directly. The gateway hot-reloads most changes automatically.

## Architecture

```
Telegram / Discord / WhatsApp
               |
               v
+-------------------------------+
|       Claw Kernel Gateway     |
|        (control plane)        |
|     ws://127.0.0.1:18789      |
+---------------+---------------+
                |
                +-- Main agent
                +-- Developer sub-agents
                +-- Code review sub-agents
                +-- Tester sub-agents
                +-- Dashboard (claw-interface)
```

## Key Paths

| Path                           | Purpose                         |
| ------------------------------ | ------------------------------- |
| `~/.openclaw/openclaw.json`    | Configuration                   |
| `~/.openclaw/workspace/`       | Agent workspace, memory, skills |
| `/tmp/openclaw/openclaw-*.log` | Runtime logs                    |

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Full build
pnpm gateway:watch    # Dev mode with hot reload
pnpm test             # Run tests
pnpm check            # Format, lint, type check
```

## Maintenance

```bash
# Update to latest
cd ~/claw-kernel && git pull && pnpm install && pnpm build

# Restart gateway
systemctl --user restart openclaw-gateway

# Health check
curl -s http://localhost:18789/health | jq .

# View logs
journalctl --user -u openclaw-gateway -f
```

## Documentation

- **[Installation Guide](docs/distribution/installation.md)** — Prerequisites, install steps, verification
- **[Setup Walkthrough](docs/distribution/setup-walkthrough.md)** — Production infrastructure checklist
- **[Troubleshooting](docs/distribution/troubleshooting.md)** — Common issues, debug commands, getting help
- **[OpenClaw Docs](https://docs.openclaw.ai)** — Full upstream documentation

## Pre-Loaded Agent Configs

Claw Kernel ships with ready-to-use agent configurations in `.agents/`:

- **Developer agent** — Autonomous coding workflow: receives GitHub issues, creates branches, runs Claude Code, tests, and opens PRs
- **Code reviewer agent** — 3-phase review process: requirements verification, code quality analysis, and decision (approve/request changes/comment)

See `.agents/developer/AGENTS.md` and `.agents/code-reviewer/AGENTS.md` for full workflow documentation.

## Coding Workflow

Claw Kernel includes a complete **coding orchestration system** that enables autonomous development:

- **Developer agents** — Implement features using Claude Code in isolated sessions
- **Code review agents** — Review PRs for quality, correctness, and security
- **Kanban integration** — Track work through backlog > in_progress > review > done
- **PRD-driven** — Every task starts with a Product Requirements Document

**Workflow:**

1. Create card on kanban board
2. Write PRD defining requirements
3. Main agent spawns developer — implements feature — creates PR
4. Main agent spawns reviewer — reviews code — approves or requests changes
5. Main agent merges PR after approval

**Documentation:**

- [Coding Workflow Guide](docs/skills/coding.md) — Complete orchestration guide
- [Developer Agent Config](.agents/developer/AGENTS.md) — How developers work
- [Code Reviewer Config](.agents/code-reviewer/AGENTS.md) — Review process
- [Recovery Guide](docs/recovery.md) — Backup and restore procedures

## Upstream

This is a fork of **OpenClaw** by Peter Steinberger and the community.

- **Upstream:** <https://github.com/openclaw/openclaw>
- **Docs:** <https://docs.openclaw.ai>
- **Discord:** <https://discord.gg/clawd>

Claw Kernel tracks upstream selectively — merging features and fixes as needed while maintaining a streamlined fork.
