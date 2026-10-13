#!/usr/bin/env bash
# Builds, serves and drives the app in headless Chromium (fresh + seeded learner).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null
npx vite preview --port 4173 >/dev/null 2>&1 &
PID=$!
trap 'kill $PID' EXIT
sleep 2
# Use the preinstalled Chromium when Playwright's own download is absent.
if [ -z "${CHROME_PATH:-}" ]; then
  CHROME_PATH="$(find /opt/pw-browsers -maxdepth 3 -type f -name headless_shell 2>/dev/null | head -1 || true)"
  export CHROME_PATH
fi
node e2e/walkthrough.mjs http://localhost:4173 e2e/shots
SEED=1 node e2e/walkthrough.mjs http://localhost:4173 e2e/shots-seeded
node e2e/parent-flows.mjs http://localhost:4173
node e2e/paint.mjs
node e2e/gallery.mjs
