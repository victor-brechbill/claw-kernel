#!/bin/bash
# Sync Claude Code OAuth tokens to OpenClaw auth-profiles.json
# This keeps OpenClaw's OAuth in sync with Claude Code's credentials
# Syncs to ALL agent directories (main, developer, code-reviewer, etc.)
#
# Setup:
#   chmod +x scripts/sync-oauth-tokens.sh
#   cp scripts/sync-oauth-tokens.sh ~/scripts/
#
# Usually called automatically by refresh-claude-token.sh

set -euo pipefail

CLAUDE_CREDS="$HOME/.claude/.credentials.json"
OPENCLAW_AGENTS_DIR="$HOME/.openclaw/agents"

log() {
    echo "[$(date -Iseconds)] $*"
}

# Verify source exists
if [ ! -f "$CLAUDE_CREDS" ]; then
    log "ERROR: Claude credentials not found at $CLAUDE_CREDS"
    exit 1
fi

# Extract tokens from Claude Code credentials
ACCESS_TOKEN=$(python3 -c "import json; print(json.load(open('$CLAUDE_CREDS'))['claudeAiOauth']['accessToken'])" 2>/dev/null)
REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$CLAUDE_CREDS'))['claudeAiOauth']['refreshToken'])" 2>/dev/null)
EXPIRES_AT=$(python3 -c "import json; print(json.load(open('$CLAUDE_CREDS'))['claudeAiOauth']['expiresAt'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
    log "ERROR: Failed to extract tokens from Claude credentials"
    exit 1
fi

# Check if agents directory exists
if [ ! -d "$OPENCLAW_AGENTS_DIR" ]; then
    log "WARNING: OpenClaw agents directory not found at $OPENCLAW_AGENTS_DIR"
    log "Skipping token sync (OpenClaw may not be configured yet)."
    exit 0
fi

# Create or update OpenClaw auth-profiles.json for ALL agent directories
python3 << PYEOF
import json
import os
import glob
import datetime

AGENTS_DIR = "$OPENCLAW_AGENTS_DIR"

# Find all agent directories with an agent/ subdirectory
agent_dirs = []
for agent_path in glob.glob(os.path.join(AGENTS_DIR, "*")):
    if os.path.isdir(agent_path):
        auth_file = os.path.join(agent_path, "agent", "auth-profiles.json")
        if os.path.exists(os.path.dirname(auth_file)) or agent_path.endswith('/main'):
            agent_dirs.append(auth_file)

if not agent_dirs:
    print("WARNING: No agent directories found in " + AGENTS_DIR)
    exit(0)

# Sync tokens to each agent directory
synced_count = 0
for AUTH_FILE in agent_dirs:
    os.makedirs(os.path.dirname(AUTH_FILE), exist_ok=True)

    # Load existing profiles or create new structure
    if os.path.exists(AUTH_FILE):
        with open(AUTH_FILE) as f:
            auth_data = json.load(f)
    else:
        auth_data = {"version": 1, "profiles": {}}

    # Update the anthropic:manual profile with OAuth tokens
    auth_data["profiles"]["anthropic:manual"] = {
        "type": "oauth",
        "provider": "anthropic",
        "access": "$ACCESS_TOKEN",
        "refresh": "$REFRESH_TOKEN",
        "expires": $EXPIRES_AT
    }

    # Also update anthropic:default to point to the same tokens
    auth_data["profiles"]["anthropic:default"] = {
        "type": "oauth",
        "provider": "anthropic",
        "access": "$ACCESS_TOKEN",
        "refresh": "$REFRESH_TOKEN",
        "expires": $EXPIRES_AT
    }

    # Set lastGood pointer
    if "lastGood" not in auth_data:
        auth_data["lastGood"] = {}
    auth_data["lastGood"]["anthropic"] = "anthropic:manual"

    # Write with restrictive permissions
    import tempfile
    fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(AUTH_FILE), text=True)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(auth_data, f, indent=2)
        os.chmod(temp_path, 0o600)
        os.rename(temp_path, AUTH_FILE)
        agent_name = os.path.basename(os.path.dirname(os.path.dirname(AUTH_FILE)))
        print(f"Synced to {agent_name}")
        synced_count += 1
    except:
        os.unlink(temp_path)
        raise

expiry = datetime.datetime.fromtimestamp($EXPIRES_AT / 1000)
print(f"\nSynced OAuth tokens to {synced_count} agent directories")
print(f"Token expires: {expiry}")
PYEOF
