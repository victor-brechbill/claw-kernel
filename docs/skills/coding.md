# Coding Workflow — Orchestration Guide

> This guide explains how OpenClaw's coding workflow uses agent orchestration for autonomous development.

## Overview

OpenClaw's coding workflow uses **orchestration** — the main agent doesn't write code directly. Instead, it spawns specialized sub-agents that use Claude Code to implement features, review code, and maintain quality.

## The Flow

```
1. Task Identified  →  Main agent picks up work (from kanban board or human request)
2. PRD Created      →  Requirements defined in a Product Requirements Document
3. Developer Spawns →  Sub-agent implements the feature using Claude Code
4. Code Review      →  Reviewer sub-agent reviews the PR
5. Merge            →  Main agent merges after review passes
```

## Roles

### Main Agent (Orchestrator)

The main agent is a project manager. It:

- Picks tasks from the backlog
- Writes or reviews PRDs
- Spawns developer and reviewer sub-agents
- Monitors progress via status files
- Makes merge/reject decisions
- Handles escalation

### Developer Agent (Sub-agent)

Spawned per-task in an isolated session:

- Receives task requirements and branch name
- Launches Claude Code to implement
- Runs tests (unit + integration)
- Creates a PR
- Writes status file when done

### Code Review Agent (Sub-agent)

Spawned after the developer completes:

- Reviews the PR diff against requirements
- Checks code quality, correctness, security
- Runs tests independently
- Submits a GitHub review (approve/request changes)
- Writes review report

## Key Concepts

### PRDs (Product Requirements Documents)

Every significant task needs a PRD before development begins:

```markdown
# PRD: TICKET-ID — Title

## Problem Statement

What problem does this solve?

## Goals

- Goal 1
- Goal 2

## Technical Approach

High-level implementation plan

## Requirements

1. Specific requirement
2. Another requirement

## Acceptance Criteria

How do we know it's done?
```

### Kanban Workflow

Tasks flow through stages:

```
Backlog → In Progress → Review → Done
```

- **Backlog**: Prioritized tasks waiting to be picked up
- **In Progress**: Developer agent is implementing
- **Review**: Code review agent is reviewing the PR
- **Done**: Merged to main, deployed

### Branch Naming

| Type    | Pattern                     | Example             |
| ------- | --------------------------- | ------------------- |
| Feature | `feat/TICKET-ID-short-desc` | `feat/42-user-auth` |
| Bug fix | `fix/TICKET-ID-short-desc`  | `fix/43-null-crash` |

### Concurrency Rules

- Max **1 Developer** agent per project at a time
- Max **1 Reviewer** agent per project at a time
- Developer + Reviewer **can** run concurrently on different branches
- Always spawn **fresh sessions** for each task (never reuse)

## Status Files

Sub-agents communicate via status files:

| File                             | Written By | Read By    |
| -------------------------------- | ---------- | ---------- |
| `coding/status/TICKET-dev.md`    | Developer  | Main agent |
| `coding/status/TICKET-review.md` | Reviewer   | Main agent |

Status files include: state (completed/failed/blocked), branch name, commit hash, test results, and any issues encountered.

## Quality Standards

- **Quality over speed** — Always implement reviewer suggestions
- **Tests are required** — Developer runs tests before PR; reviewer verifies independently
- **No direct pushes to main** — Everything goes through feature branches + PR + review
- **Feature branches are temporary** — Delete after merge

## Getting Started

1. Read this guide to understand the workflow
2. Set up your kanban board (in claw-interface or a markdown file)
3. Create your first task with a simple PRD
4. Let the main agent spawn a developer sub-agent
5. Watch the developer implement, then spawn a reviewer
6. Review the results and merge

## File Locations

| File                              | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `skills/coding/SKILL.md`          | Full orchestration manual (if using skill system) |
| `.agents/developer/AGENTS.md`     | Developer agent instructions                      |
| `.agents/code-reviewer/AGENTS.md` | Code reviewer agent instructions                  |
| `HEARTBEAT.md`                    | Kanban checklist and periodic checks              |
| `coding/prds/`                    | PRD documents                                     |
| `coding/status/`                  | Agent status files                                |

## Tips

- **Start small**: Your first orchestrated task should be simple (a small bug fix or minor feature)
- **Read status files**: They tell you exactly what happened in each sub-agent session
- **Fresh sessions always**: Never reuse sub-agent sessions — they accumulate context and overflow
- **Monitor, don't micromanage**: The system notifies you when agents complete; you don't need to poll
