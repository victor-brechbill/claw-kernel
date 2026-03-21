#!/bin/bash
# Refresh Claude Code OAuth token using the refresh token
# Can be run as a cron job or manually
# Checks for active agents and warns Nova before proceeding

CREDS_FILE="$HOME/.claude/.credentials.json"
TOKEN_URL="https://platform.claude.com/v1/oauth/token"
CLIENT_ID="9d1c250a-e61b-44d9-88ed-5944d1962f5e"
SCOPES="user:profile user:inference user:sessions:claude_code"

if [ ! -f "$CREDS_FILE" ]; then
    echo "ERROR: Credentials file not found at $CREDS_FILE"
    exit 1
fi

# Check for active isolated/subagent sessions
ACTIVE_AGENTS=$(openclaw sessions list --format json 2>/dev/null | jq -r '.[] | select(.kind == "isolated" or .kind == "subagent") | .key' 2>/dev/null | wc -l)

if [ "$ACTIVE_AGENTS" -gt 0 ]; then
    echo "⚠️ WARNING: $ACTIVE_AGENTS active agent session(s) detected"
    echo "Token refresh will proceed in 5 minutes, which will terminate these sessions."
    
    # Alert Nova via message tool
    openclaw message send --to 8348344586 --message "⚠️ **OAuth Token Refresh in 5 Minutes**

$ACTIVE_AGENTS active agent session(s) running. Token refresh will proceed at $(date -u -d '+5 minutes' '+%H:%M UTC'), which will revoke the current token and terminate these sessions.

**Active sessions:**
\`\`\`
$(openclaw sessions list --format json 2>/dev/null | jq -r '.[] | select(.kind == "isolated" or .kind == "subagent") | "\(.key) (age: \(.ageSeconds // 0)s)"' 2>/dev/null || echo 'Unable to fetch session details')
\`\`\`

You have 5 minutes to:
- Let agents finish if close to completion
- Avoid spawning new agents
- Checkpoint work if needed

The refresh will proceed automatically." 2>&1 | grep -v "^Tool:"
    
    # Sleep for 5 minutes
    echo "Sleeping for 5 minutes before refresh..."
    sleep 300
    
    echo "5 minutes elapsed. Proceeding with token refresh..."
else
    echo "No active agent sessions detected. Proceeding with immediate refresh."
fi

# Retry backoff intervals in seconds: 0 (immediate), 60 (1m), 300 (5m), 1200 (20m), 3600 (1h)
RETRY_DELAYS=(0 60 300 1200 3600)
MAX_ATTEMPTS=${#RETRY_DELAYS[@]}

attempt_refresh() {
    # Re-read refresh token each attempt (Claude Code may have rotated it)
    REFRESH_TOKEN=$(python3 -c "import json; print(json.load(open('$CREDS_FILE'))['claudeAiOauth']['refreshToken'])")

    if [ -z "$REFRESH_TOKEN" ]; then
        echo "ERROR: No refresh token found"
        return 1
    fi

    # Request new tokens
    RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"grant_type\": \"refresh_token\",
            \"refresh_token\": \"$REFRESH_TOKEN\",
            \"client_id\": \"$CLIENT_ID\",
            \"scope\": \"$SCOPES\"
        }")

    # Check for success
    if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'access_token' in d else 1)" 2>/dev/null; then
        # Update credentials file
        python3 << PYEOF
import json, time

with open('$CREDS_FILE') as f:
    creds = json.load(f)

response = json.loads('''$RESPONSE''')

creds['claudeAiOauth']['accessToken'] = response['access_token']
creds['claudeAiOauth']['refreshToken'] = response.get('refresh_token', creds['claudeAiOauth']['refreshToken'])
creds['claudeAiOauth']['expiresAt'] = int((time.time() + response['expires_in']) * 1000)

with open('$CREDS_FILE', 'w') as f:
    json.dump(creds, f, indent=2)

import datetime
expiry = datetime.datetime.fromtimestamp(creds['claudeAiOauth']['expiresAt'] / 1000)
print(f"Token refreshed successfully. New expiry: {expiry}")
PYEOF
        return 0
    else
        echo "Refresh attempt failed:"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        return 1
    fi
}

# Attempt refresh with retries and backoff
for ((i=0; i<MAX_ATTEMPTS; i++)); do
    if [ "${RETRY_DELAYS[$i]}" -gt 0 ]; then
        echo "Retrying in ${RETRY_DELAYS[$i]}s (attempt $((i+1))/$MAX_ATTEMPTS)..."
        sleep "${RETRY_DELAYS[$i]}"
    fi

    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Attempt $((i+1))/$MAX_ATTEMPTS"

    if attempt_refresh; then
        exit 0
    fi
done

echo "ERROR: All $MAX_ATTEMPTS refresh attempts failed"
exit 1
