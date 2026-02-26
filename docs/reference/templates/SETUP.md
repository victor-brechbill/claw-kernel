---
title: "SETUP.md Template"
summary: "Post-onboarding infrastructure checklist"
read_when:
  - Setting up workspace infrastructure after onboarding
---

# SETUP.md - Infrastructure Checklist

_Onboarding complete. Now let's wire up the rest._

Work through these together. Check each box as you go. When all 10 are done, this file auto-removes.

## Infrastructure

- [ ] **Verify workspace files** — Confirm IDENTITY.md, USER.md, and SOUL.md contain accurate info. Run `cat IDENTITY.md USER.md SOUL.md` and review together.
- [ ] **Configure AGENTS.md** — Review the agent capabilities file. Add any custom tools, integrations, or behavioral rules. `cat AGENTS.md`
- [ ] **Set up TOOLS.md** — Define available tools, MCP servers, or external APIs. If none needed yet, confirm defaults are fine. `cat TOOLS.md`
- [ ] **Configure HEARTBEAT.md** — Set up scheduled tasks, cron behaviors, or heartbeat intervals. Skip if not using autonomous mode. `cat HEARTBEAT.md`
- [ ] **Initialize memory** — Create MEMORY.md with any persistent context: project notes, preferences, or reference material the agent should always have access to.

## Automation

- [ ] **Test agent loop** — Send a test message and verify the agent responds correctly through the configured channel. Confirm round-trip works.
- [ ] **Configure notifications** — Set up alerts for errors, completions, or important events. Decide what's worth notifying about.

## Integrations

- [ ] **Connect messaging channel** — If not done during onboarding, set up Telegram, WhatsApp, or another channel. Test sending and receiving.
- [ ] **Link external services** — Connect any external APIs, databases, or services the agent needs. Add credentials to the appropriate config.

## Verification

- [ ] **End-to-end smoke test** — Run a complete workflow: send a message, agent processes it, agent responds, verify the output is correct. Confirm everything works together.

---

_When every box is checked, this file disappears. You're fully operational._
