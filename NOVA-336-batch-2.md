# NOVA-336 Batch 2/6 — Remove Dead Code References

**Branch:** `refactor/NOVA-336-batch-2`

**Extensions to remove in this batch (5 total):**

1. googlechat
2. imessage (17 files)
3. irc
4. line (40 files)
5. llm-task

**Approach: Sequential Chunking (1 extension per Claude Code session)**

Because this task involves multiple large extensions, process them ONE AT A TIME with fresh Claude Code sessions to avoid context overflow.

---

## Implementation Strategy

### Chunk 1/5: Remove googlechat

**Scope:** ONLY googlechat - ignore other extensions for now

1. Search for all googlechat references in the codebase
2. Remove from type definitions, schemas, config files
3. Delete googlechat-specific files
4. Verify build passes: `npm run build`
5. Commit: `git commit -m "NOVA-336 Batch 2 Chunk 1/5: Remove googlechat references"`

**DO NOT touch:** imessage, irc, line, llm-task (we'll do those next)

### Chunk 2/5: Remove imessage

**Scope:** ONLY imessage (~17 files)

1. Search for all imessage references
2. Remove from type definitions, schemas, config files
3. Delete imessage-specific files (entire directory if applicable)
4. Verify build passes
5. Commit: `git commit -m "NOVA-336 Batch 2 Chunk 2/5: Remove imessage references"`

### Chunk 3/5: Remove irc

**Scope:** ONLY irc

1. Search for all irc references
2. Remove from type definitions, schemas, config files
3. Delete irc-specific files
4. Verify build passes
5. Commit: `git commit -m "NOVA-336 Batch 2 Chunk 3/5: Remove irc references"`

### Chunk 4/5: Remove line

**Scope:** ONLY line (~40 files - this is the largest)

**Note:** If line/ directory has 40+ files, consider breaking into sub-chunks:

- Chunk 4a: Delete src/line/ directory
- Chunk 4b: Remove line from type definitions and schemas
- Chunk 4c: Remove line from tests

Otherwise, process as a single chunk:

1. Search for all line references
2. Remove from type definitions, schemas, config files
3. Delete line-specific files
4. Verify build passes
5. Commit: `git commit -m "NOVA-336 Batch 2 Chunk 4/5: Remove line references"`

### Chunk 5/5: Remove llm-task

**Scope:** ONLY llm-task

1. Search for all llm-task references
2. Remove from type definitions, schemas, config files
3. Delete llm-task-specific files
4. Verify build passes
5. Commit: `git commit -m "NOVA-336 Batch 2 Chunk 5/5: Remove llm-task references"`

---

## Final Verification (After All 5 Chunks)

After completing all 5 chunks, run final verification:

```bash
# Verify ALL 5 extensions are completely removed
grep -r "googlechat\|imessage\|irc\|line\|llm-task" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.md" \
  .

# Should return 0 matches (except this instruction file)

# Final build and test
npm run build
npm test
```

---

## Deliverable

**One PR with 5 commits** (or more if line/ required sub-chunks):

- Each commit represents one completed chunk
- Build passes after each commit
- Final verification passes
- PR title: `NOVA-336 Batch 2/6: Remove 5 extension references (googlechat, imessage, irc, line, llm-task)`

---

## Why Sequential Chunking?

Claude Code hit context overflow when trying to process all 5 extensions at once during exploration. By breaking into 1-extension-per-session chunks:

- Each chunk fits in CC's context window
- Each chunk produces a clean, reviewable commit
- Build must pass after each chunk (catches cascading breakage early)
- Fresh CC session per chunk = no context accumulation
