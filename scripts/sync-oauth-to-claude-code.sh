#!/bin/bash
# Sync OAuth tokens FROM OpenClaw auth-profiles.json TO Claude Code .credentials.json
#
# OpenClaw is the source of truth for token refresh. This script keeps
# Claude Code's credentials in sync so developer/reviewer agents (which
# use Claude Code) have valid tokens.
#
# Direction: OpenClaw → Claude Code (reverse of sync-oauth-tokens.sh)
#
# Retry logic: 3 attempts with 10s backoff if OpenClaw tokens are expired
# (gives OpenClaw's lazy refresh time to fire on next API call)

set -euo pipefail

OPENCLAW_MAIN_AUTH="$HOME/.openclaw/agents/main/agent/auth-profiles.json"
CLAUDE_CREDS="$HOME/.claude/.credentials.json"
LOG_PREFIX="[sync-to-claude-code]"
MAX_RETRIES=3
RETRY_DELAY=10

log() { echo "$LOG_PREFIX $(date -u '+%Y-%m-%d %H:%M:%S UTC') $*"; }

# --- Find the best OpenClaw token ---

get_best_token() {
    python3 << 'PYEOF'
import json, sys, os, time

AUTH_FILE = os.path.expanduser("~/.openclaw/agents/main/agent/auth-profiles.json")

if not os.path.exists(AUTH_FILE):
    print("ERROR: auth-profiles.json not found", file=sys.stderr)
    sys.exit(1)

with open(AUTH_FILE) as f:
    data = json.load(f)

profiles = data.get("profiles", {})
last_good_key = data.get("lastGood", {}).get("anthropic", "")

# Strategy: pick the profile with the latest expiry
best = None
best_key = None
now_ms = int(time.time() * 1000)

for key, prof in profiles.items():
    if prof.get("provider") != "anthropic":
        continue
    if prof.get("type") != "oauth":
        continue
    expires = prof.get("expires", 0)
    if best is None or expires > best.get("expires", 0):
        best = prof
        best_key = key

if not best:
    print("ERROR: No anthropic OAuth profile found", file=sys.stderr)
    sys.exit(1)

expires = best.get("expires", 0)

if expires <= now_ms:
    print(f"EXPIRED\t{best_key}\t{expires}", file=sys.stdout)
    sys.exit(2)

# Tab-delimited to avoid splitting on colons in tokens
print(f"OK\t{best_key}\t{best['access']}\t{best['refresh']}\t{expires}")
PYEOF
}

# --- Write tokens to Claude Code credentials ---

write_to_claude_code() {
    local access="$1"
    local refresh="$2"
    local expires="$3"

    python3 << PYEOF
import json, os, tempfile

CREDS_FILE = os.path.expanduser("~/.claude/.credentials.json")

if os.path.exists(CREDS_FILE):
    with open(CREDS_FILE) as f:
        creds = json.load(f)
else:
    creds = {}

if "claudeAiOauth" not in creds:
    creds["claudeAiOauth"] = {}

creds["claudeAiOauth"]["accessToken"] = "$access"
creds["claudeAiOauth"]["refreshToken"] = "$refresh"
creds["claudeAiOauth"]["expiresAt"] = $expires

# Atomic write
fd, temp = tempfile.mkstemp(dir=os.path.dirname(CREDS_FILE), suffix=".tmp")
try:
    with os.fdopen(fd, 'w') as f:
        json.dump(creds, f, indent=2)
    os.chmod(temp, 0o600)
    os.rename(temp, CREDS_FILE)
except:
    os.unlink(temp)
    raise

import datetime
exp = datetime.datetime.fromtimestamp($expires / 1000, tz=datetime.timezone.utc)
remaining = (exp - datetime.datetime.now(datetime.timezone.utc))
hours = remaining.total_seconds() / 3600
print(f"Synced to Claude Code. Expires: {exp.strftime('%Y-%m-%d %H:%M UTC')} ({hours:.1f}h remaining)")
PYEOF
}

# --- Main ---

for ((attempt=1; attempt<=MAX_RETRIES; attempt++)); do
    log "Attempt $attempt/$MAX_RETRIES"

    result=$(get_best_token 2>&1) || exit_code=$?
    exit_code=${exit_code:-0}

    if [ "$exit_code" -eq 0 ]; then
        # Parse tab-delimited: OK\tkey\taccess\trefresh\texpires
        IFS=$'\t' read -r _status profile_key access refresh expires <<< "$result"

        log "Using profile '$profile_key'"
        write_to_claude_code "$access" "$refresh" "$expires"
        log "✅ Sync complete"
        exit 0

    elif [ "$exit_code" -eq 2 ]; then
        # Token expired — OpenClaw may refresh it on next API call
        IFS=$'\t' read -r _status profile_key _expires <<< "$result"
        log "⚠️ Token expired (profile: $profile_key). Waiting ${RETRY_DELAY}s for OpenClaw to refresh..."
        if [ "$attempt" -lt "$MAX_RETRIES" ]; then
            sleep "$RETRY_DELAY"
        fi
    else
        log "ERROR: $result"
        exit 1
    fi
done

log "❌ All attempts failed — OpenClaw tokens are expired and not refreshing."
log "Manual intervention needed: use Dashboard 'Refresh OAuth Token' button"
exit 1
