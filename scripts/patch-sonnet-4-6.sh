#!/bin/bash
# Patch to add Claude Sonnet 4.6 to @mariozechner/pi-ai model library
# Run this after npm install or kernel rebuild

set -e

MODELS_FILE="node_modules/@mariozechner/pi-ai/dist/models.generated.js"

if [ ! -f "$MODELS_FILE" ]; then
    echo "❌ Error: $MODELS_FILE not found"
    echo "Run this script from nova-kernel root after npm install"
    exit 1
fi

# Check if already patched
if grep -q '"claude-sonnet-4-6"' "$MODELS_FILE"; then
    echo "✅ Already patched - claude-sonnet-4-6 found in models"
    exit 0
fi

echo "📝 Backing up models.generated.js..."
cp "$MODELS_FILE" "$MODELS_FILE.bak"

echo "🔧 Adding claude-sonnet-4-6 models..."

node << 'EOF'
const fs = require('fs');
const path = 'node_modules/@mariozechner/pi-ai/dist/models.generated.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Add claude-sonnet-4-6 (anthropic direct) after claude-sonnet-4-5-20250929
const anthropicModel = `        "claude-sonnet-4-6": {
            id: "claude-sonnet-4-6",
            name: "Claude Sonnet 4.6 (latest)",
            api: "anthropic-messages",
            provider: "anthropic",
            baseUrl: "https://api.anthropic.com",
            reasoning: true,
            input: ["text", "image"],
            cost: {
                input: 3,
                output: 15,
                cacheRead: 0.3,
                cacheWrite: 3.75,
            },
            contextWindow: 200000,
            maxTokens: 64000,
        },
`;

const anthropicPattern = /"claude-sonnet-4-5-20250929": \{[\s\S]*?maxTokens: \d+,\s+\},/;
const anthropicMatch = content.match(anthropicPattern);
if (anthropicMatch) {
    const pos = content.indexOf(anthropicMatch[0]) + anthropicMatch[0].length;
    content = content.slice(0, pos) + '\n' + anthropicModel + content.slice(pos);
    console.log('✅ Added claude-sonnet-4-6 (anthropic)');
}

// 2. Add anthropic/claude-sonnet-4.6 (openrouter) after anthropic/claude-sonnet-4.5
const openrouterModel = `        "anthropic/claude-sonnet-4.6": {
            id: "anthropic/claude-sonnet-4.6",
            name: "Anthropic: Claude Sonnet 4.6",
            api: "openai-completions",
            provider: "openrouter",
            baseUrl: "https://openrouter.ai/api/v1",
            reasoning: true,
            input: ["text", "image"],
            cost: {
                input: 3,
                output: 15,
                cacheRead: 0.3,
                cacheWrite: 3.75,
            },
            contextWindow: 1000000,
            maxTokens: 64000,
        },
`;

const openrouterPattern = /"anthropic\/claude-sonnet-4\.5": \{[^}]*provider: "openrouter"[\s\S]*?maxTokens: \d+,\s+\},/;
const openrouterMatch = content.match(openrouterPattern);
if (openrouterMatch) {
    const pos = content.indexOf(openrouterMatch[0]) + openrouterMatch[0].length;
    content = content.slice(0, pos) + '\n' + openrouterModel + content.slice(pos);
    console.log('✅ Added anthropic/claude-sonnet-4.6 (openrouter)');
}

// 3. Add anthropic/claude-sonnet-4.6 (vercel-ai-gateway) after anthropic/claude-sonnet-4.5
const vercelModel = `        "anthropic/claude-sonnet-4.6": {
            id: "anthropic/claude-sonnet-4.6",
            name: "Claude Sonnet 4.6",
            api: "anthropic-messages",
            provider: "vercel-ai-gateway",
            baseUrl: "https://ai-gateway.vercel.sh",
            reasoning: true,
            input: ["text", "image"],
            cost: {
                input: 3,
                output: 15,
                cacheRead: 0.3,
                cacheWrite: 3.75,
            },
            contextWindow: 1000000,
            maxTokens: 64000,
        },
`;

const vercelPattern = /"anthropic\/claude-sonnet-4\.5": \{[^}]*provider: "vercel-ai-gateway"[\s\S]*?maxTokens: \d+,\s+\},/;
const vercelMatch = content.match(vercelPattern);
if (vercelMatch) {
    const pos = content.indexOf(vercelMatch[0]) + vercelMatch[0].length;
    content = content.slice(0, pos) + '\n' + vercelModel + content.slice(pos);
    console.log('✅ Added anthropic/claude-sonnet-4.6 (vercel-ai-gateway)');
}

fs.writeFileSync(path, content);
EOF

echo "✅ Patch complete!"
echo "📋 Backup saved to: $MODELS_FILE.bak"
echo ""
echo "Verify with: grep -c '\"claude-sonnet-4-6\"' $MODELS_FILE"
