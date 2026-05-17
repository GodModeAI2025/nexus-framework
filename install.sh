#!/bin/bash
# Nexus Framework - Installer
# Usage: curl -sSL https://raw.githubusercontent.com/your-org/nexus-framework/main/install.sh | bash

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         NEXUS FRAMEWORK INSTALLER                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Determine install location
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/.nexus-framework}"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install it first."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git is required. Install it first."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ is required. Current: $(node -v)"
  exit 1
fi

echo "📦 Installing Nexus Framework to $INSTALL_DIR..."

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
  echo "   Updating existing installation..."
  cd "$INSTALL_DIR" && git pull --quiet
else
  echo "   Cloning repository..."
  git clone --quiet https://github.com/your-org/nexus-framework.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install dependencies and build
echo "   Installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --silent 2>/dev/null
else
  npm install --silent 2>/dev/null
fi

echo "   Building..."
npx tsc 2>/dev/null

# Create symlink
LINK_DIR="$HOME/.local/bin"
mkdir -p "$LINK_DIR"
ln -sf "$INSTALL_DIR/bin/nexus.js" "$LINK_DIR/nexus"
chmod +x "$INSTALL_DIR/bin/nexus.js"

# Check if PATH includes the link dir
if [[ ":$PATH:" != *":$LINK_DIR:"* ]]; then
  echo ""
  echo "⚠️  Add this to your shell profile (.bashrc, .zshrc, etc.):"
  echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

echo ""
echo "✅ Nexus Framework installed successfully!"
echo ""
echo "   Quick start:"
echo "   cd your-project"
echo "   nexus init --install-hooks"
echo ""
echo "   Set your agent identity:"
echo "   export NEXUS_ACTOR_NAME=\"YourAgentName\""
echo ""
