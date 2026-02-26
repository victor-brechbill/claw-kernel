---
title: "Cron Job Examples"
summary: "Pre-built cron job configurations for common automated tasks"
read_when:
  - Setting up automated workflows
  - Configuring recurring agent tasks
---

# Cron Job Examples

These are ready-to-use cron job configurations. All are set to `enabled: false` by default — enable them when you're ready.

To create a cron job, use the `cron` tool:

```
cron(action="create", job=<JSON below>)
```

To list existing cron jobs:

```
cron(action="list")
```

---

## A. Daily Self-Improvement (3:00 AM)

**What it does:** Reviews recent work, explores documentation for new techniques, writes improvement suggestions, and creates kanban cards for actionable improvements.

```json
{
  "name": "Daily Self-Improvement",
  "schedule": "0 3 * * *",
  "enabled": false,
  "prompt": "Self-improvement session. 1) Review yesterday's memory log (memory/YYYY-MM-DD.md) for mistakes, inefficiencies, or lessons. 2) Pick one area to explore (new tool features, better patterns, documentation gaps). 3) Write a short improvement note to today's memory log. 4) If you found something actionable, create a kanban card in backlog with a clear title and description. Keep the session under 10 minutes.",
  "channel": "main"
}
```

**Schedule:** `0 3 * * *` = Every day at 3:00 AM

**Expected output:**

- Entry in today's `memory/YYYY-MM-DD.md` with improvement notes
- Optionally: new kanban card(s) for actionable improvements
- Session completes quietly — no human notification needed

**Customization:**

- Change the hour to match your quiet period (avoid overlap with maintenance at 5 AM)
- Adjust the exploration focus: documentation, testing patterns, workflow optimization, etc.
- Add specific areas to review: "focus on test coverage" or "explore API rate limiting patterns"

---

## B. Daily System Maintenance (5:00 AM)

**What it does:** Runs routine housekeeping — OS updates, storage checks, security audit, cron health verification, and token refresh validation.

```json
{
  "name": "Daily System Maintenance",
  "schedule": "0 5 * * *",
  "enabled": false,
  "prompt": "Daily maintenance checklist:\n1. OS updates: Run `sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y`\n2. Storage check: Run `df -h /` — warn if >80% used\n3. Memory check: Run `free -h` — warn if swap usage >50%\n4. Security: Run `sudo fail2ban-client status sshd` if installed, check for suspicious login attempts\n5. Cron health: Run `cron(action=\"list\")` — verify all enabled jobs ran recently (check lastRun timestamps)\n6. Token check: Verify auth tokens are fresh and not expiring within 24h\n7. Log summary to today's memory file\n\nIf anything is broken, create a high-priority kanban card. Otherwise complete quietly.",
  "channel": "main"
}
```

**Schedule:** `0 5 * * *` = Every day at 5:00 AM

**Expected output:**

- System packages updated
- Storage/memory warnings if thresholds exceeded
- Cron health verified
- Entry in today's memory log with maintenance summary
- Kanban card created only if something needs attention

**Customization:**

- Add project-specific health checks (database connections, API endpoints, service status)
- Adjust storage/memory thresholds to match your environment
- Add backup verification: check that backup files exist and are recent
- Add custom scripts: `~/YOUR-WORKSPACE/scripts/health-check.sh`

---

## C. Weekly Cleanup (Sunday 9:00 AM)

**What it does:** Cleans up GitHub repos (merged branches, stale PRs), clears git stashes, and tidies workspace artifacts.

```json
{
  "name": "Weekly Cleanup",
  "schedule": "0 9 * * 0",
  "enabled": false,
  "prompt": "Weekly cleanup tasks:\n1. For each project repo:\n   a. Delete merged branches: `git branch --merged main | grep -v 'main\\|master' | xargs -r git branch -d`\n   b. Prune remote refs: `git fetch --prune`\n   c. List stale PRs (open >14 days with no activity): `gh pr list --json number,title,updatedAt | jq '[.[] | select((now - (.updatedAt | fromdateiso8601)) > 1209600)]'`\n   d. Clean stashes older than 30 days: `git stash list` and review\n2. Clean up workspace artifacts:\n   a. Remove completed status files from coding/status/\n   b. Archive old PRDs (>30 days, card in done) to coding/prds/archive/\n3. Log what was cleaned to today's memory file.",
  "channel": "main"
}
```

**Schedule:** `0 9 * * 0` = Every Sunday at 9:00 AM

**Expected output:**

- Merged branches deleted across all repos
- Remote refs pruned
- Stale PRs identified (optionally closed with comment)
- Old status files and PRDs archived
- Cleanup summary in memory log

**Customization:**

- Add/remove repos from the cleanup list
- Adjust staleness thresholds (14 days for PRs, 30 days for PRDs)
- Add Docker cleanup: `docker system prune -f` if using containers
- Add log rotation: compress or remove old log files

---

## D. Weekly Retrospective (Sunday 4:00 PM)

**What it does:** Reviews the week's completed work, analyzes what went well and what didn't, updates documentation, and creates improvement cards for next week.

```json
{
  "name": "Weekly Retrospective",
  "schedule": "0 16 * * 0",
  "enabled": false,
  "prompt": "Weekly retrospective:\n1. Review this week's memory logs (memory/ files from past 7 days)\n2. List completed kanban cards this week (check done column for cards moved this week)\n3. Analyze:\n   - What went well? (fast completions, clean PRs, good estimates)\n   - What didn't? (stuck cards, failed reviews, missed estimates, repeated mistakes)\n   - What surprised you? (unexpected blockers, scope changes)\n4. Update MEMORY.md with key lessons from the week\n5. Update AGENTS.md or TOOLS.md if you discovered better workflows\n6. Create 1-3 improvement kanban cards for next week based on findings\n7. Write a brief weekly summary to memory/YYYY-MM-DD.md\n\nBe honest and specific. Generic observations like 'be better at testing' aren't useful. Specific ones like 'API tests need mock setup — create a shared test fixture' are.",
  "channel": "main"
}
```

**Schedule:** `0 16 * * 0` = Every Sunday at 4:00 PM

**Expected output:**

- Weekly summary in today's memory log
- MEMORY.md updated with distilled lessons
- 1-3 improvement cards in kanban backlog
- Optionally: updates to AGENTS.md or TOOLS.md with better workflows

**Customization:**

- Move to Friday afternoon if you prefer end-of-workweek retros
- Add metrics tracking: count PRs merged, cards completed, average time-to-merge
- Include team/collaboration notes if working with multiple agents
- Add a "shoutout" section for things that worked particularly well

---

## Tips

- **Stagger your cron jobs** — don't schedule multiple jobs at the same time. Leave at least 30 minutes between jobs to avoid resource contention.
- **Start with `enabled: false`** — test each job manually first (`cron(action="run", name="Job Name")`) before enabling the schedule.
- **Monitor with maintenance** — the Daily System Maintenance job checks cron health, so enable that one first.
- **Timezone matters** — cron schedules use your system timezone. Check with `timedatectl` or `date`.
- **Channel selection** — use `"channel": "main"` for jobs that should run in the main agent session, or specify a different channel for isolated execution.
