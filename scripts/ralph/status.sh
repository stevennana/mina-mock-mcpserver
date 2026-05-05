#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

node scripts/ralph/ensure-state.mjs >/dev/null

echo "Current task:"
cat state/current-task.txt
echo ""

echo "Current task validation:"
node --input-type=module <<'NODE'
import { inspectCurrentTaskState } from "./scripts/ralph/lib/task-utils.mjs";

const state = inspectCurrentTaskState();
console.log(`ok: ${state.ok}`);
console.log(`reason: ${state.reason}`);
console.log(`resolved_task_id: ${state.resolved_task_id ?? "NONE"}`);
NODE
echo ""

echo "Current cycle:"
cat state/current-cycle.json
echo ""

echo "Health summary:"
awk '
  /^- health: / {
    value = substr($0, 11)
  }
  END {
    if (value) {
      print value
    } else {
      print "(no cycles recorded yet)"
    }
  }
' state/run-log.md
echo ""

echo "Latest completed evaluation:"
cat state/evaluation.json
echo ""

echo "Blocker tracker:"
cat state/blocker-tracker.json
echo ""

echo "Backlog:"
cat state/backlog.md
