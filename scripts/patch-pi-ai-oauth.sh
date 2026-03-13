#!/bin/bash
# Patch pi-ai to re-export OAuth utilities from main entry
# 
# pi-ai exports getOAuthApiKey/getOAuthProviders from @mariozechner/pi-ai/oauth
# but not from the main entry. If any import accidentally uses the main entry,
# the bundler will produce dist code that crashes at runtime with:
#   SyntaxError: does not provide an export named 'getOAuthApiKey'
#
# This patch adds the re-export as a safety net. The correct fix is to import
# from @mariozechner/pi-ai/oauth in source, but this prevents catastrophic
# gateway crash loops if someone gets it wrong.
#
# Lesson: 2026-03-13 — gateway crash loop + server reboot loop

set -euo pipefail

PI_AI_INDEX="node_modules/@mariozechner/pi-ai/dist/index.js"

if [ ! -f "$PI_AI_INDEX" ]; then
    echo "⚠️  pi-ai dist/index.js not found — skipping OAuth patch"
    exit 0
fi

if grep -q 'oauth/index.js' "$PI_AI_INDEX" 2>/dev/null; then
    echo "✅ pi-ai OAuth re-export already patched"
    exit 0
fi

echo 'export * from "./utils/oauth/index.js";' >> "$PI_AI_INDEX"
echo "✅ Patched pi-ai dist/index.js — added OAuth re-export"
