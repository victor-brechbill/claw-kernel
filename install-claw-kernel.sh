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

# Configure npm to use user directory (prevents permission errors)
echo "📝 Configuring npm to use ~/.npm-global for global packages..."
npm config set prefix ~/.npm-global

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

# Configure PATH if needed
NPM_BIN="$HOME/.npm-global/bin"
export PATH="$NPM_BIN:$PATH"

# Determine shell config file
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    # Default to bashrc
    SHELL_CONFIG="$HOME/.bashrc"
fi

# Add PATH to shell config if not already there
if ! grep -q "\.npm-global/bin" "$SHELL_CONFIG" 2>/dev/null; then
    echo ""
    echo "📝 Adding npm global bin to PATH in $SHELL_CONFIG..."
    echo "" >> "$SHELL_CONFIG"
    echo "# Added by claw-kernel install script" >> "$SHELL_CONFIG"
    echo "export PATH=\"\$HOME/.npm-global/bin:\$PATH\"" >> "$SHELL_CONFIG"
    echo "✅ PATH updated in $SHELL_CONFIG"
fi

# Refresh command cache
hash -r 2>/dev/null || true

echo ""
echo "✅ Claw Kernel installed successfully!"
echo ""

# Verify openclaw command is available
if command -v openclaw &> /dev/null; then
    echo "✅ openclaw command is ready to use"
    echo "   Version: $(openclaw --version 2>/dev/null || echo 'unknown')"
else
    echo "⚠️  openclaw command not found in current shell"
    echo "   Run: source $SHELL_CONFIG"
    echo "   Or start a new terminal session"
fi

echo ""
echo "Next steps:"
echo "  1. Run: openclaw onboard"
echo "     (Configure channels and API keys)"
echo ""
echo "  2. Start the gateway:"
echo "     openclaw gateway start"
echo ""
echo "  3. (Optional) Install as systemd service for auto-start:"
echo "     openclaw gateway install"
echo "     systemctl --user start openclaw-gateway.service"
echo ""
echo "     Then manage with:"
echo "     systemctl --user status openclaw-gateway.service"
echo "     systemctl --user restart openclaw-gateway.service"
echo "     journalctl --user -u openclaw-gateway.service -f"
echo ""
