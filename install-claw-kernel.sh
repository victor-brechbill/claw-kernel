#!/bin/bash
# install-claw-kernel.sh
# Install script for Claw Kernel (Victor's custom OpenClaw fork)

set -e

REPO_URL="https://github.com/victor-brechbill/claw-kernel.git"
INSTALL_DIR="$HOME/claw-kernel"
KERNEL_NAME="claw-kernel"

echo "🔧 Installing Claw Kernel..."
echo ""

# Check for Node.js 22+
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    echo "   Install Node.js 22+ first: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Error: Node.js 22+ required (found v$NODE_VERSION)"
    echo "   Upgrade Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js v$(node -v) found"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm found"

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
    echo "📂 Updating existing installation at $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "📥 Cloning $KERNEL_NAME from $REPO_URL..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo ""
echo "🔨 Building $KERNEL_NAME..."
pnpm install --no-frozen-lockfile
pnpm build

echo ""
echo "📦 Installing globally..."
npm install -g .

# Get npm global bin directory
NPM_BIN=$(npm bin -g 2>/dev/null || echo "$HOME/.npm-global/bin")

echo ""
echo "✅ Claw Kernel installed successfully!"
echo ""

# Check if openclaw command is available
if ! command -v openclaw &> /dev/null; then
    echo "⚠️  The 'openclaw' command is not in your PATH"
    echo ""
    echo "Add this line to your ~/.bashrc or ~/.zshrc:"
    echo "  export PATH=\"$NPM_BIN:\$PATH\""
    echo ""
    echo "Then reload your shell:"
    echo "  source ~/.bashrc  # (or ~/.zshrc)"
    echo ""
    echo "Or run this command now:"
    echo "  export PATH=\"$NPM_BIN:\$PATH\""
    echo ""
fi

echo "Next steps:"
echo "  1. Run: openclaw onboard"
echo "  2. Configure your channels and API keys"
echo "  3. Start the gateway: openclaw gateway start"
echo ""
echo "For systemd service setup:"
echo "  openclaw gateway install"
echo ""
