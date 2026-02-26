#!/bin/bash
# Refresh Claude Code OAuth token using the refresh token
# Run as a cron job (every 6 hours recommended) or manually
#
# Setup:
#   chmod +x scripts/refresh-claude-token.sh
#   cp scripts/refresh-claude-token.sh ~/scripts/
#
# Cron (every 6 hours):
#   0 */6 * * * /home/YOUR-USERNAME/scripts/refresh-claude-token.sh >> /home/YOUR-USERNAME/logs/token-refresh.log 2>&1

set -euo pipefail

CREDS_FILE="$HOME/.claude/.credentials.json"
TOKEN_URL="https://platform.claude.com/v1/oauth/token"
CLIENT_ID="9d1c250a-e61b-44d9-88ed-5944d1962f5e"
SCOPES="user:profile user:inference user:sessions:claude_code"

log() {
    echo "[$(date -Iseconds)] $*"
}

# Check credentials file exists
if [ ! -f "$CREDS_FILE" ]; then
    log "ERROR: Credentials file not found at $CREDS_FILE"
    log "Run 'claude' first to authenticate and create credentials."
    exit 1
fi

# Extract current refresh token
REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$CREDS_FILE'))['claudeAiOauth']['refreshToken'])" 2>/dev/null)

if [ -z "$REFRESH_TOKEN" ]; then
    log "ERROR: No refresh token found in $CREDS_FILE"
    exit 1
fi

log "Requesting new tokens..."

# Request new tokens
RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"grant_type\": \"refresh_token\",
        \"refresh_token\": \"$REFRESH_TOKEN\",
        \"client_id\": \"$CLIENT_ID\",
        \"scope\": \"$SCOPES\"
    }")

# Check for errors and update credentials
if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'access_token' in d else 1)" 2>/dev/null; then
    python3 << PYEOF
import json, time, datetime

with open('$CREDS_FILE') as f:
    creds = json.load(f)

response = json.loads('''$RESPONSE''')

creds['claudeAiOauth']['accessToken'] = response['access_token']
creds['claudeAiOauth']['refreshToken'] = response.get('refresh_token', creds['claudeAiOauth']['refreshToken'])
creds['claudeAiOauth']['expiresAt'] = int((time.time() + response['expires_in']) * 1000)

with open('$CREDS_FILE', 'w') as f:
    json.dump(creds, f, indent=2)

expiry = datetime.datetime.fromtimestamp(creds['claudeAiOauth']['expiresAt'] / 1000)
print(f"Token refreshed successfully. New expiry: {expiry}")
PYEOF
else
    log "ERROR: Token refresh failed"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Optionally sync to OpenClaw agents
SYNC_SCRIPT="$(dirname "$0")/sync-oauth-tokens.sh"
if [ -f "$SYNC_SCRIPT" ]; then
    log "Running token sync to OpenClaw agents..."
    bash "$SYNC_SCRIPT"
elif [ -f "$HOME/scripts/sync-oauth-tokens.sh" ]; then
    log "Running token sync to OpenClaw agents..."
    bash "$HOME/scripts/sync-oauth-tokens.sh"
fi

log "Token refresh complete."
