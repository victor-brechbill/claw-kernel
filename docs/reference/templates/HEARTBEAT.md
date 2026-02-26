---
title: "HEARTBEAT.md Template"
summary: "Workspace template for HEARTBEAT.md"
read_when:
  - Bootstrapping a workspace manually
---

# HEARTBEAT.md

# This file controls what your agent checks on each heartbeat poll.

# Lines starting with # are comments and won't trigger heartbeat API calls.

# To activate heartbeat checks, add task lines below the relevant section.

#

# Example task line:

# - [ ] Check inbox for urgent messages

#

# When this file has only comments/headers, heartbeats are skipped (no API cost).

# The agent reads this file every ~30 minutes when heartbeat is enabled.

## Kanban Check Workflow

# On each heartbeat, work through active tasks top-to-bottom:

# 1. Read this file for current tasks

# 2. Execute each unchecked task

# 3. Check the box or remove the task when done

# 4. If a task spawned follow-up work, add it here

# 5. If nothing needs attention, reply HEARTBEAT_OK

## Periodic Checks

# Add recurring checks below. Example:

# - [ ] Inbox — urgent unread messages?

# - [ ] Calendar — events in next 24h?

# - [ ] Projects — blocked PRs or overdue tasks?

## One-Off Tasks

# Add temporary tasks below. Remove when done. Example:

# - [ ] Remind user about meeting at 3pm

# - [ ] Check if deploy finished successfully
