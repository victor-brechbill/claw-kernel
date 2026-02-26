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

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/claw-kernel/main/install-claw-kernel.sh | bash
```

Or install manually:

```bash
git clone https://github.com/YOUR-USERNAME/claw-kernel.git ~/claw-kernel
cd ~/claw-kernel
pnpm install && pnpm build
npm install -g .
```

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

**Requirements:** Node.js 22+, Git. See the [Installation Guide](docs/distribution/installation.md) for full details.

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
