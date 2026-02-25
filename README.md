# ✨ Nova Kernel

**Nova's personal AI assistant runtime** — a private fork of [OpenClaw](https://github.com/openclaw/openclaw) customized for Nova's specific needs.

---

## What is this?

This is Nova's kernel — the core runtime that powers Nova, Victor's personal AI assistant. It's a fork of OpenClaw that has been streamlined and customized for a single-user, production-focused deployment.

**Forked from:** [OpenClaw v2026.2.17](https://github.com/openclaw/openclaw/tree/v2026.2.17)

## Key Differences from Upstream

**Removed 27 extensions** we don't use:

- Channels: BlueBubbles, Feishu, Google Chat, iMessage (macOS), IRC, Line, Lobster, Matrix, Mattermost, Microsoft Teams, Nextcloud Talk, Nostr, Open Prose, Qwen Portal, Signal, Slack, Thread Ownership, Tlon, Twitch, Zalo, Zalo User
- Diagnostics: OpenTelemetry
- Memory: LanceDB
- LLM: Task extension
- Auth: Copilot Proxy, Google Antigravity

**What we kept:**

- Channels: Telegram (primary), Discord, WhatsApp
- Core runtime, tool system, session management
- Browser control, Canvas, Nodes
- Cron/scheduling, sub-agents, memory system

**Why fork?**

- **Focus:** We only use Telegram/Discord/WhatsApp, no need for 20+ channel integrations
- **Maintenance:** Smaller codebase = easier to understand and modify
- **Customization:** Free to modify without worrying about upstream compatibility
- **Stability:** Pin to known-good versions, update on our schedule

## Our Setup

**Platform:** Ubuntu 24.04 on AWS EC2 (16GB RAM, 8GB swap)  
**Channels:** Telegram (primary), Discord (secondary), WhatsApp (backup)  
**Models:** Claude Sonnet 4.5 (main), GPT-5-mini (sub-agents), Opus 4.6 (special tasks)  
**Auth:** OAuth (Anthropic Pro Max, OpenAI subscription)

**Features we use:**

- Multi-agent orchestration (main Nova + developer/reviewer/tester sub-agents)
- Kanban workflow via Nova Dashboard
- Browser automation for testing
- Cron jobs for scheduled tasks
- Memory system (semantic search + daily logs)
- Self-healing (watchdog + memory limits)

**Features we don't:**

- macOS/iOS/Android apps (headless server deployment)
- Voice/speech (Telegram text-only)
- Most channel integrations (removed)
- Canvas/A2UI (not needed for our use case)

## Installation

This repo is not meant for public use — it's Nova's personal runtime. If you want to run your own AI assistant, use upstream [OpenClaw](https://github.com/openclaw/openclaw).

**For Nova's deployment:**

```bash
cd ~/clawd/vault/dev/repos/nova-kernel
pnpm install
pnpm build
pnpm openclaw gateway start
```

**Production deployment uses systemd:**

```bash
systemctl --user status openclaw-gateway
systemctl --user restart openclaw-gateway
```

## Configuration

Located at: `~/.clawdbot/clawdbot.json`

**Core config:**

```json5
{
  agent: {
    model: "anthropic/claude-sonnet-4-5",
    thinking: "low",
  },
  channels: {
    telegram: {
      botToken: "...",
      allowFrom: ["8348344586"],
    },
  },
}
```

### Server-side tools


**⚠️ Config changes are dangerous!** Always backup before editing:

```bash
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.bak
```

Invalid JSON = instant gateway death. Use `jq` to validate.

## Development

**Build from source:**

```bash
pnpm install
pnpm build
```

**Run in dev mode (auto-reload):**

```bash
pnpm gateway:watch
```

**Add Sonnet 4.6 support:**

```bash
./scripts/patch-sonnet-4-6.sh
```

## Deployment

**Rebuild after updates:**

```bash
cd ~/clawd/vault/dev/repos/nova-kernel
git pull
pnpm install
pnpm build
~/clawd/scripts/rebuild-kernel.sh  # Rebuilds + restarts gateway
```

**Rollback if something breaks:**

```bash
~/clawd/scripts/rollback-kernel.sh
```

## Key Paths

- **Installed runtime:** `~/.npm-global/lib/node_modules/openclaw/`
- **Config:** `~/.clawdbot/clawdbot.json`
- **Workspace:** `~/clawd/` (Nova's home)
- **Memory:** `~/clawd/memory/` (daily logs)
- **Skills:** `~/clawd/skills/` (custom Nova skills)
- **Logs:** `/tmp/openclaw/openclaw-*.log`

## Maintenance

**Check gateway health:**

```bash
systemctl --user status openclaw-gateway
curl -s http://localhost:18789/health | jq .
```

**View logs:**

```bash
journalctl --user -u openclaw-gateway -f
tail -f /tmp/openclaw/openclaw-*.log
```

**Restart gateway:**

```bash
systemctl --user restart openclaw-gateway
```

## Self-Healing

Nova Kernel includes self-healing protections (implemented Feb 2026):

- **Server watchdog:** Linux kernel watchdog monitors system health (60s timeout)
- **Memory limits:** User processes capped at 12GB (4GB reserved for system)
- **Swap space:** 8GB swap configured as safety net
- **Health checks:** `/var/log/watchdog`, `/var/log/gateway-health.log`

Auto-restart triggers on:

- Event loop deadlock (>60s unresponsive)
- Memory pressure (approaching OOM)
- Network failure

See: `~/clawd/SELF-HEALING-SUMMARY.md`

## Architecture

```
Telegram / Discord / WhatsApp
               │
               ▼
┌───────────────────────────────┐
│      Nova Kernel Gateway      │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Main agent (Nova)
               ├─ Developer sub-agents
               ├─ Code review sub-agents
               ├─ Tester sub-agents
               └─ Nova Dashboard (kanban)
```

## Upstream

This is a fork of **OpenClaw** by Peter Steinberger and the community.

**Upstream repo:** https://github.com/openclaw/openclaw  
**Docs:** https://docs.openclaw.ai  
**Discord:** https://discord.gg/clawd

Nova Kernel tracks upstream selectively — we merge features/fixes we need, but maintain our streamlined fork.

---

**Built for Nova** ✨  
_The Architect-Poet_
