#!/bin/bash
# setup-precommit.sh — Install pre-commit hooks for a project
# Usage: ./setup-precommit.sh [project-dir]
#
# Installs: husky, lint-staged, gitleaks integration
# Requires: Node.js project with package.json, gitleaks installed globally

set -e

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

if [ ! -f "package.json" ]; then
    echo "ERROR: No package.json found in $PROJECT_DIR"
    echo "This script requires a Node.js project with package.json."
    exit 1
fi

if ! command -v gitleaks &> /dev/null; then
    echo "ERROR: gitleaks not installed. Install it first:"
    echo ""
    echo "  # Download latest release"
    echo "  wget https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.21.2_linux_x64.tar.gz"
    echo "  tar -xzf gitleaks_8.21.2_linux_x64.tar.gz"
    echo "  sudo mv gitleaks /usr/local/bin/"
    echo "  rm gitleaks_8.21.2_linux_x64.tar.gz"
    echo ""
    exit 1
fi

echo "Installing husky and lint-staged..."
npm install -D husky lint-staged

echo "Initializing husky..."
npx husky init

echo "Creating pre-commit hook..."
cat > .husky/pre-commit << 'EOF'
echo "Running pre-commit checks..."

# Run lint-staged (linting + formatting on staged files)
echo "  -> lint-staged"
npx lint-staged || exit 1

# TypeScript type check (if tsconfig exists)
if [ -f "tsconfig.json" ]; then
    echo "  -> typecheck"
    npm run typecheck 2>/dev/null || echo "    Warning: typecheck script not found, skipping"
fi

# Security: Check for secrets
echo "  -> gitleaks (secret detection)"
if command -v gitleaks &> /dev/null; then
    gitleaks protect --staged --verbose || exit 1
else
    echo "    Warning: gitleaks not installed, skipping secret detection"
fi

# Security: Check dependencies (non-blocking warning)
echo "  -> npm audit"
npm audit --audit-level=high 2>/dev/null || echo "    Warning: Dependency vulnerabilities found (review with 'npm audit')"

echo "Pre-commit checks passed"
EOF

chmod +x .husky/pre-commit

echo "Adding lint-staged config to package.json..."
# Check if lint-staged config already exists
if grep -q '"lint-staged"' package.json; then
    echo "   lint-staged config already exists, skipping"
else
    # Add lint-staged config using node
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg['lint-staged'] = {
        '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
        '*.{json,md,yml,yaml}': ['prettier --write']
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "   Added lint-staged config"
fi

echo ""
echo "Pre-commit hooks installed!"
echo ""
echo "Next steps:"
echo "   1. Ensure eslint and prettier are installed: npm install -D eslint prettier"
echo "   2. Add 'typecheck' script to package.json if using TypeScript"
echo "   3. Test with: git add . && git commit -m 'test'"
echo "   4. Bypass (emergency only): git commit --no-verify"
