#!/usr/bin/env bash
# GrabCredit BNPL — one-command demo setup
# Usage: ./scripts/demo.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo -e "${BOLD}  GrabCredit BNPL${NC} — Demo Setup"
echo "  ───────────────────────────────────"

# ── 1. Node.js version check ──────────────────────────────────────────────────
required_node=18
if ! command -v node &>/dev/null; then
  echo -e "${RED}  ✗ Node.js not found. Install Node.js ${required_node}+ from https://nodejs.org${NC}"
  exit 1
fi
actual_node=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$actual_node" -lt "$required_node" ]; then
  echo -e "${RED}  ✗ Node.js ${required_node}+ required (found: $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v)${NC}"

# ── 2. Anthropic API key ──────────────────────────────────────────────────────
# Load from web-app/.env.local if not already in environment
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -f "$ROOT/web-app/.env.local" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$ROOT/web-app/.env.local"
  set +o allexport
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo ""
  echo -e "${YELLOW}  ⚠  ANTHROPIC_API_KEY not set — Claude narratives will be disabled${NC}"
  echo "     Fix: create web-app/.env.local with:"
  echo "          ANTHROPIC_API_KEY=sk-ant-..."
  echo "     (copy from .env.example)"
  echo ""
else
  echo -e "${GREEN}  ✓ ANTHROPIC_API_KEY found${NC}"
fi

# ── 3. Build MCP server ───────────────────────────────────────────────────────
echo ""
echo "  Installing MCP server dependencies..."
(cd "$ROOT/mcp-server" && npm install --prefer-offline --silent 2>/dev/null) \
  || (cd "$ROOT/mcp-server" && npm install --silent)
echo -e "${GREEN}  ✓ MCP server: dependencies installed${NC}"

echo "  Building MCP server..."
(cd "$ROOT/mcp-server" && npm run build --silent 2>/dev/null) \
  || (cd "$ROOT/mcp-server" && npm run build)
echo -e "${GREEN}  ✓ MCP server: compiled → dist/${NC}"

# ── 4. Install web-app ────────────────────────────────────────────────────────
echo ""
echo "  Installing web-app dependencies..."
(cd "$ROOT/web-app" && npm install --prefer-offline --silent 2>/dev/null) \
  || (cd "$ROOT/web-app" && npm install --silent)
echo -e "${GREEN}  ✓ Web app: dependencies installed${NC}"

# ── 5. Launch ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  Everything ready — starting web app...${NC}"
echo "  → Switch between 5 personas at the top of the page"
echo "  → Each persona shows a different approval tier and AI narrative"
echo "  → Press Ctrl+C to stop"
echo ""

# Pipe Next.js output through tee so we can detect the actual port
# (Next.js bumps to 3001, 3002 etc. if 3000 is already in use)
cd "$ROOT/web-app"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" npm run dev 2>&1 | tee /tmp/grabcredit-dev.log | while IFS= read -r line; do
  echo "$line"
  if echo "$line" | grep -qE "Local:.*http://localhost:[0-9]+"; then
    port=$(echo "$line" | grep -oE "localhost:[0-9]+" | grep -oE "[0-9]+$")
    echo ""
    echo -e "${GREEN}${BOLD}  ✓ Open → http://localhost:${port}${NC}"
    echo ""
  fi
done
