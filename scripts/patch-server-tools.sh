#!/bin/bash
# patch-server-tools.sh — Patch pi-ai for Anthropic server-side tool content blocks
# This runs automatically via npm postinstall. Also used by rebuild-kernel.sh.
#
# What it does:
# 1. Stores server_tool_use blocks in streaming output (not as toolCall — avoids client execution)
# 2. Stores web_search_tool_result / web_fetch_tool_result blocks in streaming output
# 3. Accumulates input_json_delta for server_tool_use blocks
# 4. Passes server tool blocks through in convertMessages (history replay)
#
# Related: NOVA-362 — Enable Anthropic server-side tools (web_search, web_fetch)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ANTHRO="$ROOT_DIR/node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js"

echo "Patching pi-ai for Anthropic server-side tools..."

if [ ! -f "$ANTHRO" ]; then
  echo "  ⚠️  anthropic.js not found — skipping"
  exit 0
fi

if grep -q "server_tool_use" "$ANTHRO"; then
  echo "  ℹ️  anthropic.js already patched for server tools"
  exit 0
fi

node "$SCRIPT_DIR/patch-server-tools.cjs" "$ANTHRO"

echo "Done!"
