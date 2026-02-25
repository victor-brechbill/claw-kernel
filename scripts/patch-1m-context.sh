#!/bin/bash
# patch-1m-context.sh — Apply 1M context window patch to pi-ai dependency
# This runs automatically via npm postinstall. Also used by rebuild-kernel.sh.
#
# What it does:
# 1. Adds context-1m-2025-08-07 beta header to Anthropic API calls
# 2. Updates contextWindow from 200K to 1M for opus-4-6 models
#
# Upstream issue: https://github.com/openclaw/openclaw/issues/11057

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ANTHRO="$ROOT_DIR/node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js"
MODELS="$ROOT_DIR/node_modules/@mariozechner/pi-ai/dist/models.generated.js"

echo "Patching for 1M context window (Opus 4.6)..."

# Patch 1: Add context-1m beta header
if [ -f "$ANTHRO" ]; then
  if ! grep -q "context-1m" "$ANTHRO"; then
    # Add to the betaFeatures array (non-copilot path)
    sed -i 's/const betaFeatures = \["fine-grained-tool-streaming-2025-05-14"\];/const betaFeatures = ["fine-grained-tool-streaming-2025-05-14", "context-1m-2025-08-07"];/' "$ANTHRO"
    echo "  ✅ anthropic.js patched (added context-1m beta header)"
  else
    echo "  ℹ️  anthropic.js already patched"
  fi
else
  echo "  ⚠️  anthropic.js not found — skipping"
fi

# Patch 2: Update contextWindow 200K → 1M for opus-4-6
if [ -f "$MODELS" ]; then
  COUNT=$(grep -c 'contextWindow: 200000' "$MODELS" 2>/dev/null || echo "0")
  if [ "$COUNT" -gt "0" ]; then
    # Only patch opus-4-6 entries
    sed -i '/opus-4-6/,/contextWindow/ s/contextWindow: 200000/contextWindow: 1000000/' "$MODELS"
    NEW_COUNT=$(grep -c 'contextWindow: 1000000' "$MODELS" 2>/dev/null || echo "0")
    echo "  ✅ models.generated.js patched ($NEW_COUNT entries → 1M)"
  else
    echo "  ℹ️  models.generated.js already patched"
  fi
else
  echo "  ⚠️  models.generated.js not found — skipping"
fi

echo "Done!"
