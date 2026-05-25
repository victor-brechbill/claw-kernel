---
title: "HEARTBEAT.md Template"
summary: "Kanban workflow checklist for heartbeat-driven task management"
read_when:
  - Bootstrapping a workspace manually
  - Setting up a coding workflow with kanban integration
---

# HEARTBEAT.md

## ⏸️ Already Working?

If you're mid-task when this fires, **continue what you're doing**. Only run this checklist if idle.

---

## 📚 LOAD THE CODING SKILL FIRST!

Before processing ANY kanban work, **read the Coding skill:**

```
~/YOUR-WORKSPACE/skills/coding/SKILL.md
```

This skill defines the complete workflow. Do not skip steps or improvise.

---

## 🚨 AGENT CONCURRENCY (Per Project)

- Max 1 active implementation/review lane per repo by default.
- Check `sessions_list` and `coding/active-tasks.json` before spawning or advancing Developer/Reviewer work.
- If the same repo already has active implementation or review work → **DEFER/QUEUE** by default.
- Only override with a written reason: active task bypassed, why it is safe, and expected non-overlap.
- Different repos can still run in parallel.

---

## The Checklist (IN ORDER)

### 1. Check Running Agents

Check both sessions and the JSON registry:

```bash
# Check active sessions
sessions_list

# Check JSON registry for task states
jq -r '.tasks | to_entries[] | "\(.key): dev=\(.value.developer.status // "none"), review=\(.value.reviewer.status // "none"), ready=\(.value.definitionOfDone.readyToMerge)"' ~/YOUR-WORKSPACE/coding/active-tasks.json
```

Handle completed agents before anything else:

- If developer complete → check definition of done, spawn reviewer
- If reviewer complete → check result, merge or send back to developer
- If ready to merge → approve and merge PR
- Before spawning reviewer or sending fixes back to developer → rerun the same-repo active-work gate

When you defer/queue/override, write a short audit note in the card/status file before moving on.

### 2. Check ALL Repos for Unmerged PRs

**BEFORE starting new work,** check ALL project repos for pending PRs and resolve them:

```bash
# Check each repo (add/remove repos as needed)
cd /path/to/repos/project-one && gh pr list --json number,title,state,reviews,statusCheckRollup
cd /path/to/repos/project-two && gh pr list --json number,title,state,reviews,statusCheckRollup
```

**For each unmerged PR, resolve the blocker:**

- ❌ **CI failed:** Investigate failure, fix the issue, push fix
- ⚠️ **Missing review:** Spawn code reviewer if it's your PR
- ⏳ **Review failed:** Address feedback (send back to developer or fix directly)
- 🔄 **Needs rebase:** Rebase onto main before review; verify mergeability before spending reviewer time
- 🗑️ **Superseded:** Close stale PRs if work was completed elsewhere

**Goal:** Get to zero pending PRs before picking new backlog tasks.

Before spawning a reviewer for any PR:

```bash
git fetch origin
git rev-list --left-right --count origin/main...origin/{feature-branch}
gh pr view {number} --repo {owner}/{repo} --json mergeable,mergeStateStatus,headRefName,baseRefName
```

If stale or conflicted, rebase/cherry-pick first, push, and record the decision/result in the card/status file.

### 3. Backlog: Cards Need PRDs?

Any card in backlog assigned to you without a PRD → **write the PRD, upload the file, flag it**.

⚠️ **ATTACH THE ACTUAL FILE!** Don't just mention the PRD in a comment — use the attachments API:

```bash
curl -X POST "http://localhost:YOUR-PORT/api/cards/{id}/attachments" \
  -F "file=@/path/to/workspace/coding/prds/TICKET-XXX-prd.md"
```

Verify: Check that `.attachments | length > 0` before flagging.
If updating an existing PRD, always remove the old file and upload a new one with a different file name (to prevent cached file from re-loading).

### 4. Unanswered User Comments (ALL CARDS!)

Check **every card** (backlog, in_progress, review, AND done) for user comments without a response → **respond now**.

Don't skip cards just because they're in `done` — users may have follow-up questions!

### 5. Review Column: PRs to Check?

Cards in review → check status, spawn review agent if needed, merge if passed.

Before spawning review: verify same-repo active work, branch freshness, and PR mergeability. Defer/queue if another same-repo implementation or review is active unless you write an explicit override.

### 6. In Progress: Stuck Cards?

Cards in progress → check if implementation done, spawn developer if needed.

Before spawning or re-spawning implementation: verify no same-repo implementation/review lane is active. Preserve parallelism by picking work from a different repo when available.

### 7. New Work (ONLY if steps 1-6 are clear)

Pick an approved card assigned to you → move to `in_progress`, begin work.

---

## 🛑 BEFORE YOU SAY HEARTBEAT_OK

You are **NOT ALLOWED** to say HEARTBEAT_OK until you verify ALL of these:

- [ ] `sessions_list` checked — no completed agents waiting
- [ ] `active-tasks.json` checked — no same-repo implementation/review collision before spawning or advancing work
- [ ] **ALL repos checked for unmerged PRs — all blockers resolved**
- [ ] Review candidates checked for branch freshness and PR mergeability before reviewer spawn
- [ ] Any defer, queue, override, or rebase decision recorded in a card/status file
- [ ] ALL backlog cards (assigned to you) have PRDs
- [ ] ALL user comments have responses
- [ ] NO cards stuck in review or in_progress
- [ ] NO approved cards waiting to be picked up (check `approved: true`, NOT `flagged`!)

**If ANY box is unchecked → DO THE WORK. Don't skip it.**

Late night (3:00-08:00)? Still check. Only skip if truly nothing to do.

---

## Secondary Checks (Lower Priority, Rotate Through)

- **Dependabot PRs** (weekly): `gh pr list --label automated` — merge minor/patch if CI passes
- **Memory maintenance** (every few days): Review daily logs, update MEMORY.md
- **Git hygiene** (weekly): Delete merged branches

---

## Quick Reference

API examples and curl commands → see **TOOLS.md** (Kanban API Quick Reference section)
