---
title: "TOOLS.md Template"
summary: "Workspace template for TOOLS.md"
read_when:
  - Bootstrapping a workspace manually
---

# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Device names and locations
- SSH hosts and aliases
- API keys and service endpoints
- Speaker/room names
- Environment-specific conventions
- Anything the agent should know about your local setup

## Examples

```markdown
### Devices

- living-room-speaker → Main area, Sonos
- front-door-cam → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### Services

- TTS → ElevenLabs, preferred voice: "Rachel"
- Search → Brave Search API
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## ⏱️ Enforcing Real Waits (Sleep Commands)

LLMs have no concept of time passing. If you need to physically wait (for a build, a deploy, a rate limit), use `sleep` in an exec command:

```bash
exec(command="sleep 45 && ps -p <pid> || echo done", timeout=60)
```

Without this, the agent will just keep polling or hallucinate that time has passed.

---

## 🧹 Git Hygiene

Delete merged branches regularly (weekly is a good cadence):

```bash
# Delete local branches that have been merged into main
git branch --merged main | grep -v 'main\|master' | xargs -r git branch -d

# Prune remote tracking refs
git fetch --prune
```

Add this to your Weekly Cleanup cron job (see `docs/examples/cron-jobs.md`).

---

## ⏱️ Time Estimation — LLM Agent Time

When estimating how long a coding task takes for an LLM agent (not a human):

| Category | Time      | Examples                            |
| -------- | --------- | ----------------------------------- |
| Trivial  | <2 min    | CSS tweak, config change, typo fix  |
| Small    | 2-10 min  | Single file change, simple endpoint |
| Medium   | 10-20 min | Multi-file change, new component    |
| Large    | 20-45 min | Major feature, architecture change  |

**If your estimate exceeds 30 min, you're probably wrong.** Only valid reasons: slow test suites, external API calls, multi-repo dependencies.

---

## 📋 Kanban API Quick Reference

If you're running a kanban dashboard (like claw-interface), here are common API patterns:

```bash
# List all cards
curl -s http://localhost:YOUR-PORT/api/cards

# Filter by column
curl -s http://localhost:YOUR-PORT/api/cards | jq '[.[] | select(.column == "in_progress")]'

# Filter by assignee
curl -s http://localhost:YOUR-PORT/api/cards | jq '[.[] | select(.assignee == "YOUR-AGENT-NAME")]'

# Find approved cards ready for work
curl -s http://localhost:YOUR-PORT/api/cards | jq '[.[] | select(.approved == true and .column == "backlog")]'

# Get specific card by number
curl -s http://localhost:YOUR-PORT/api/cards | jq '.[] | select(.number == 123)'

# List all cards sorted by number
curl -s http://localhost:YOUR-PORT/api/cards | jq '[.[] | select(.number != null)] | sort_by(.number) | .[] | {number, title, column, approved, assignee}'

# Attach a file to a card (e.g., PRD)
curl -X POST "http://localhost:YOUR-PORT/api/cards/{id}/attachments" \
  -F "file=@/path/to/file.md"
```

**Note:** Cards typically use a `.number` field, not `.cardNumber`. Check your dashboard's API docs.

---

Add whatever helps you do your job. This is your cheat sheet.
