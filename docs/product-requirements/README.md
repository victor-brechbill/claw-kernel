# Product Requirements Documentation

This folder contains product requirement documents (PRDs) that guide development decisions.

## Purpose

PRDs are **enforceable specifications**, not just documentation. Code changes that violate, modify, or remove functionality defined in a PRD must be flagged before implementation.

## Requirement Labels

Every PRD contains **labeled requirements** using the format:

```
**[PRD-XXX-R01]** The system MUST support multi-tenant isolation via orgId on every document.
```

Format: `PRD-{number}-R{seq}` where:

- `{number}` = PRD number (e.g., `005`)
- `{seq}` = requirement sequence within that PRD (e.g., `01`, `02`)

Keywords follow RFC 2119:

- **MUST / MUST NOT** — Absolute requirement or prohibition
- **SHOULD / SHOULD NOT** — Strong recommendation
- **MAY** — Optional

## Requirement Index

The file `REQUIREMENTS-INDEX.md` contains a machine-scannable flat index of ALL requirements. Generate it with:

```bash
./scripts/generate-requirements-index.sh
```

## Modifying Requirements

1. Identify affected requirement label(s)
2. Flag the conflict — agents must not silently violate requirements
3. Get user approval for significant changes
4. Update PRD + index in the same PR
5. Reference in commit: `Updates PRD-XXX-R01: [reason]`

## Creating a PRD

```bash
# Copy the template
cp docs/product-requirements/_template.md docs/product-requirements/XXX-feature-name.md
```

Each PRD should include: Problem Statement, Goals, Non-Goals, Design Decisions, Requirements (labeled), Implementation Notes.
