# NOVA-336 Batch 2/6 — Continue (Extensions 3-5)

**Branch:** `refactor/NOVA-336-batch-2` (already exists, has 2 commits)

**Status:** Extensions 1-2 complete, continuing with 3-5

**Already completed:**

- ✅ googlechat (commit 0ff98c0)
- ✅ imessage (commit bd49440)

**Your task:** Remove remaining 3 extensions using sequential chunking

---

## Extensions to Remove (3 remaining)

### Chunk 3/5: Remove irc

**Scope:** ONLY irc - ignore line and llm-task for now

1. Search for all irc references in the codebase
2. Remove from type definitions, schemas, config files
3. Delete irc-specific files
4. Verify build passes: `npm run build`
5. Commit: `git commit -m "NOVA-336 Batch 2 Chunk 3/5: Remove irc references"`

**DO NOT touch:** line, llm-task (we'll do those next)

### Chunk 4/5: Remove line

**Scope:** ONLY line (~40 files - this is the largest)

**Note:** Line has ~40 files. If too large for one Claude Code session, break into sub-chunks:

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

## Implementation Strategy

**FOR EACH EXTENSION:**

1. **Launch fresh Claude Code session:**

   ```bash
   exec(command="cd ~/clawd/vault/dev/repos/nova-kernel && claude --model opus", pty=true, background=true, timeout=1800)
   ```

2. **Switch to plan mode** (Shift+Tab = hex `1b 5b 5a`)

3. **Send the task** for ONE extension only

4. **Review plan, approve** (option 3: manual approve edits recommended)

5. **Wait for Claude Code to complete**

6. **Verify build:** `npm run build && npm test`

7. **Commit** with chunk number in message

8. **Exit Claude Code** (Ctrl+D or type `exit`)

9. **Repeat** for next extension with fresh Claude Code session

---

## Final Steps (After All 3 Extensions)

### Squash All Commits

After completing chunks 3, 4, and 5, you'll have 5 total commits on the branch. **You MUST squash them into ONE commit before ending your task:**

```bash
# Check current commits
git log --oneline main..HEAD
# Should show 5 commits: googlechat, imessage, irc, line, llm-task

# Squash all 5 into ONE
git reset --soft main
git add --all

# Create single atomic commit
git commit -m "NOVA-336 Batch 2/6: Remove 5 extensions (googlechat, imessage, irc, line, llm-task)

Sequential chunking approach - processed one extension per Claude Code session
to avoid context overflow.

Extensions removed:
- googlechat: All type defs, schemas, registry, plugins, runtime, CLI, tests, docs
- imessage: 68 files modified, net -311 lines
- irc: [will be filled in]
- line: [will be filled in]
- llm-task: [will be filled in]

Build verified after each chunk.
Final build status: PASSING

Co-Authored-By: Claude Sonnet 4 <noreply@anthropic.com>"

# Force push (replaces 5 commits with 1)
git push --force-with-lease origin refactor/NOVA-336-batch-2
```

### Final Verification

```bash
# Verify ALL 5 extensions are completely removed
grep -r "googlechat\|imessage\|irc\|line\|llm-task" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.md" \
  .

# Should return 0 matches (except this instruction file and commit messages)

# Final build and test
npm run build
npm test
```

### Create PR

```bash
gh pr create \
  --title "NOVA-336 Batch 2/6: Remove 5 extensions (googlechat, imessage, irc, line, llm-task)" \
  --body "## Summary
Sequential removal of 5 extension references from nova-kernel codebase.

## Approach
Used sequential chunking - one extension per Claude Code session to avoid context overflow.

## Extensions Removed
1. googlechat ✅
2. imessage ✅ (68 files, -311 lines)
3. irc ✅
4. line ✅
5. llm-task ✅

## Verification
- Build passes after each chunk
- Final grep verification: 0 matches
- Tests pass
- Pre-commit hooks pass

## Related
- Part of NOVA-336 cleanup (27 total extensions across 6 batches)
- Batch 1 merged: #18" \
  --base main \
  --head refactor/NOVA-336-batch-2
```

---

## Key Constraints

1. **ONE extension per Claude Code session** - prevents context overflow
2. **Fresh CC session for each chunk** - no context accumulation
3. **Build must pass after each chunk** - catches cascading breakage early
4. **SQUASH before creating PR** - final deliverable is ONE commit
5. **Verify zero grep matches** - ensures complete removal

---

## Why Sequential Chunking?

Previous attempts to process all 5 at once failed with context overflow. By processing one at a time with fresh sessions:

- Each chunk fits in CC's context window ✅
- Build verification after each prevents cascading issues ✅
- Fresh session = no token accumulation ✅
- Checkpoint commits protect against crashes ✅
- Final squash keeps git history clean ✅
