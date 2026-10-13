#!/usr/bin/env bash
# Builds, serves and drives the app in headless Chromium (fresh + seeded learner).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null
npx vite preview --port 4173 >/dev/null 2>&1 &
PID=$!
trap 'kill $PID' EXIT
sleep 2
node e2e/walkthrough.mjs http://localhost:4173 e2e/shots
SEED=1 node e2e/walkthrough.mjs http://localhost:4173 e2e/shots-seeded
