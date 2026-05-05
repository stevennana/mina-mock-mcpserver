#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f state/evaluation.json ]]; then
  echo "commit: skipped (no evaluation.json)"
  exit 0
fi

if ! node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("state/evaluation.json", "utf8"));
const ok = data?.deterministic?.pass === true;
process.exit(ok ? 0 : 1);
'; then
  echo "commit: skipped (deterministic checks not passing)"
  exit 0
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "commit: no changes"
  exit 0
fi

git add .

TIMESTAMP=$(date -Iseconds)
TASK_ID=$(cat state/current-task.txt 2>/dev/null || echo "unknown")

SUMMARY=""
if [[ -f state/last-result.txt ]]; then
  SUMMARY=$(head -n 5 state/last-result.txt | tr '\n' ' ')
fi

git commit -m "ralph: ${TASK_ID} ${TIMESTAMP}

${SUMMARY}
"

echo "commit: created"