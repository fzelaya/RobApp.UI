#!/usr/bin/env bash
#
# start-app.sh — starts the Strategy Report Extractor web app.
#
# Works on:
#   - macOS / Linux : run directly       ->  ./start-app.sh
#   - Windows       : run via Git Bash or WSL, NOT double-clicked and NOT
#                     run from cmd.exe/PowerShell directly (those don't
#                     execute .sh files). From Git Bash or a WSL terminal:
#                         bash start-app.sh
#                     Git Bash: https://git-scm.com/downloads
#                     WSL:      https://learn.microsoft.com/windows/wsl/install
#
# Usage:
#   ./start-app.sh            # starts on the default port (3000)
#   PORT=8080 ./start-app.sh  # starts on a specific port
#
set -euo pipefail

# --- Resolve the project root regardless of where this script is run from ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Colors (skipped automatically if the terminal doesn't support them) ---
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; RESET=''
fi

info()  { echo -e "${GREEN}==>${RESET} $1"; }
warn()  { echo -e "${YELLOW}==>${RESET} $1"; }
fail()  { echo -e "${RED}error:${RESET} $1" >&2; exit 1; }

# --- Check prerequisites ---
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed or not on your PATH.
  Download it from: https://nodejs.org/en/download
  (npm is bundled with the Node.js installer, so installing Node also installs npm.)"
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is not installed or not on your PATH.
  npm is bundled with Node.js -- reinstall Node from: https://nodejs.org/en/download
  See also: https://www.npmjs.com/"
fi

NODE_VERSION="$(node --version)"
NPM_VERSION="$(npm --version)"
info "Using Node.js ${NODE_VERSION}, npm ${NPM_VERSION}"

# --- Install dependencies if needed ---
if [ ! -d "node_modules" ]; then
  info "Installing dependencies (first run)..."
  npm install
else
  info "Dependencies already installed (node_modules found)."
fi

# --- Build TypeScript ---
info "Building..."
npm run build

# --- Ensure the shared data directory exists (the app also does this on
#     startup, but creating it here avoids any doubt before first launch) ---
mkdir -p data

# --- Start the server ---
PORT="${PORT:-3000}"
info "Starting server on http://localhost:${PORT} ..."
echo -e "${BOLD}Press Ctrl+C to stop.${RESET}"
echo
PORT="$PORT" npm run serve
