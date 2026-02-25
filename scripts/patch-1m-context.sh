#!/bin/bash
# patch-1m-context.sh — Safety patch for pi-ai dependency
# This runs automatically via npm postinstall. Also used by rebuild-kernel.sh.
#
# ⚠️  CRITICAL: DO NOT re-add the "context-1m-2025-08-07" beta header!
#
# History:
#   - Originally patched anthropic.js to add "context-1m-2025-08-07" beta header
#   - This caused "LLM request rejected: The long context beta is not
#     yet available for this subscription" when using OAuth (Pro Max subscription)
#   - The 1M context beta feature REQUIRES an Anthropic API key — NOT OAuth
#   - We use OAuth exclusively (API is ~$100/day, never again)
#   - FIX: Removed the beta header. Script now only STRIPS it if present.
#
# Upstream issue: https://github.com/openclaw/openclaw/issues/11057

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ANTHRO="$ROOT_DIR/node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js"

echo "Applying OpenClaw safety patches..."

# ── Safety check: strip context-1m beta header from ALL anthropic.js copies ─
# This header BREAKS OAuth/subscription auth. Must never be present.
CLEAN=true
for JS_FILE in \
    "$ANTHRO" \
    $(find "$ROOT_DIR/node_modules/.pnpm" -name "anthropic.js" -path "*/providers/anthropic.js" 2>/dev/null); do
    if grep -q "context-1m-2025-08-07" "$JS_FILE" 2>/dev/null; then
        echo "  ⚠️  DANGER: context-1m-2025-08-07 found in: $JS_FILE"
        echo "      This BREAKS OAuth/subscription auth. Removing it now..."
        sed -i 's/, "context-1m-2025-08-07"//' "$JS_FILE"
        sed -i 's/"context-1m-2025-08-07", //' "$JS_FILE"
        echo "  ✅  Removed from: $JS_FILE"
        CLEAN=false
    fi
done
if [ "$CLEAN" = true ]; then
    echo "  ✅  All anthropic.js files clean (no context-1m header)"
fi

echo "  ✅ models.generated.js: no contextWindow changes needed (200K is accurate for OAuth/subscription)"

echo ""
echo "Done."
echo ""
echo "⚠️  REMINDER: We run OAuth (Pro Max subscription), NOT the Anthropic API."
echo "    Never add API-only beta headers (like context-1m-2025-08-07) to anthropic.js."
