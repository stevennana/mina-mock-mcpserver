#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

node scripts/ralph/ensure-state.mjs >/dev/null

echo "## loop start $(date -Iseconds)" >> state/run-log.md

while true; do
  if ./scripts/ralph/run-once.sh; then
    :
  else
    EXIT_CODE="$?"
    if [[ "$EXIT_CODE" -eq 75 ]]; then
      echo "Worker stalled. Stopping loop for triage." | tee -a state/run-log.md
      exit "$EXIT_CODE"
    fi
    echo "run-once failed with exit code ${EXIT_CODE}. Stopping loop." | tee -a state/run-log.md
    exit "$EXIT_CODE"
  fi
  TASK_ID="$(tr -d '\n' < state/current-task.txt || true)"
  if [[ -z "${TASK_ID}" || "${TASK_ID}" == "NONE" ]]; then
    echo "No remaining task. Stopping loop." | tee -a state/run-log.md
    break
  fi
  sleep "${RALPH_LOOP_SLEEP_SECONDS:-30}"
done
