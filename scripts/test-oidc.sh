#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

export OIDC_CLIENT_ID=uptime-kuma
export OIDC_ISSUER=http://localhost:9090
export OIDC_CLIENT_SECRET=mock-secret
export OIDC_REDIRECT_URI=http://localhost:3001/auth/oidc/callback
export OIDC_ALLOWED_USERNAME=mock@example.com

# Start mock OIDC server and kill it when this script exits
node "$SCRIPT_DIR/mock-oidc-server.mjs" &
MOCK_PID=$!
trap 'kill "$MOCK_PID" 2>/dev/null; wait "$MOCK_PID" 2>/dev/null' EXIT

# Build the frontend if dist/ is missing or stale (older than 1 hour)
if [ ! -f "$ROOT_DIR/dist/index.html" ] || [ -n "$(find "$ROOT_DIR/dist/index.html" -mmin +60)" ]; then
    echo "[test-oidc] Building frontend..."
    npm --prefix "$ROOT_DIR" run build
else
    echo "[test-oidc] Using existing dist/ (less than 1h old). Run 'npm run build' to force a rebuild."
fi

echo ""
echo "[test-oidc] App running at http://localhost:3001"
echo "[test-oidc] OIDC issuer: $OIDC_ISSUER"
echo ""

npm --prefix "$ROOT_DIR" run start-server-dev
