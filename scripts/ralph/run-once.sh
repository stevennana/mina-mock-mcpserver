#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

mkdir -p state scripts/ralph/generated docs/exec-plans/completed
node scripts/ralph/ensure-state.mjs >/dev/null
node scripts/ralph/render-backlog.mjs >/dev/null

RUN_LOG="state/run-log.md"
CYCLE_STATE_FILE="state/current-cycle.json"
STALL_EXIT_CODE=75
WORKER_STALL_SECONDS="${RALPH_WORKER_STALL_SECONDS:-900}"
WORKER_POLL_SECONDS="${RALPH_WORKER_POLL_SECONDS:-30}"

append_log() {
  printf '%s\n' "$1" >> "$RUN_LOG"
}

last_nonempty_line() {
  local file_path="$1"
  awk 'NF { last = $0 } END { if (last) print last }' "$file_path"
}

read_health_marks() {
  awk '
    /^- health: / {
      value = substr($0, 11)
    }
    END {
      if (value) print value
    }
  ' "$RUN_LOG"
}

append_health_mark() {
  local symbol="$1"
  local previous
  previous="$(read_health_marks)"
  append_log "- health: ${previous}${symbol}"
}

write_cycle_state() {
  local phase="$1"
  local status="$2"
  node - "$CYCLE_STATE_FILE" "$TASK_ID" "$CYCLE_STARTED_AT" "$CYCLE_DIR" "$phase" "$status" <<'NODE'
const fs = require("fs");
const [filePath, taskId, startedAt, cycleDir, phase, status] = process.argv.slice(2);
fs.writeFileSync(
  filePath,
  `${JSON.stringify(
    {
      task_id: taskId,
      started_at: startedAt,
      artifact_dir: cycleDir,
      phase,
      status,
      updated_at: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  "utf8",
);
NODE
}

write_worker_cycle_state() {
  local status="$1"
  local worker_pid="$2"
  local last_heartbeat_at="$3"
  local stall_detected_at="${4:-}"
  local stall_artifact="${5:-}"
  node - "$CYCLE_STATE_FILE" "$TASK_ID" "$CYCLE_STARTED_AT" "$CYCLE_DIR" "$status" "$worker_pid" "$last_heartbeat_at" "$WORKER_STALL_SECONDS" "$stall_detected_at" "$stall_artifact" <<'NODE'
const fs = require("fs");
const [filePath, taskId, startedAt, cycleDir, status, workerPid, lastHeartbeatAt, stallTimeoutSeconds, stallDetectedAt, stallArtifact] = process.argv.slice(2);
const payload = {
  task_id: taskId,
  started_at: startedAt,
  artifact_dir: cycleDir,
  phase: "worker",
  status,
  updated_at: new Date().toISOString(),
  worker_pid: Number(workerPid),
  last_worker_heartbeat_at: lastHeartbeatAt,
  stall_timeout_seconds: Number(stallTimeoutSeconds),
};
if (stallDetectedAt) payload.stall_detected_at = stallDetectedAt;
if (stallArtifact) payload.stall_artifact = stallArtifact;
fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
NODE
}

write_worker_stall_artifact() {
  local worker_pid="$1"
  local last_heartbeat_at="$2"
  local detected_at="$3"
  local artifact_path="${CYCLE_DIR}/worker-stall.json"
  node - "$artifact_path" "$TASK_ID" "$CYCLE_STARTED_AT" "$CYCLE_DIR" "$worker_pid" "$last_heartbeat_at" "$detected_at" "$WORKER_STALL_SECONDS" "$WORKER_LOG" <<'NODE'
const fs = require("fs");
const [filePath, taskId, startedAt, cycleDir, workerPid, lastHeartbeatAt, detectedAt, stallSeconds, workerLog] = process.argv.slice(2);
fs.writeFileSync(
  filePath,
  `${JSON.stringify(
    {
      task_id: taskId,
      cycle_started_at: startedAt,
      artifact_dir: cycleDir,
      worker_pid: Number(workerPid),
      last_worker_heartbeat_at: lastHeartbeatAt,
      stall_detected_at: detectedAt,
      stall_timeout_seconds: Number(stallSeconds),
      worker_log_path: workerLog,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
NODE
  printf '%s\n' "$artifact_path"
}

write_stall_result() {
  local artifact_path="$1"
  local detected_at="$2"
  cat > state/last-result.txt <<EOF
**Result**

Task \`${TASK_ID}\` stalled during the worker phase. The Ralph harness detected no new \`worker.jsonl\` progress for ${WORKER_STALL_SECONDS} seconds and stopped the worker at ${detected_at}.

Inspect:
- \`${WORKER_LOG}\`
- \`${artifact_path}\`
- \`state/current-cycle.json\`
- \`state/run-log.md\`

This cycle did not reach evaluator, commit, or promotion.
EOF

  node - "$TASK_ID" "$artifact_path" "$WORKER_LOG" "$detected_at" <<'NODE'
const fs = require("fs");
const [taskId, artifactPath, workerLog, detectedAt] = process.argv.slice(2);
const payload = {
  checked_at: new Date().toISOString(),
  task_id: taskId,
  status: "not_done",
  promotion_eligible: false,
  deterministic: {
    checked_at: new Date().toISOString(),
    task_id: taskId,
    pass: false,
    commands: [],
    missing_files: [],
  },
  summary: `Worker stalled before evaluator at ${detectedAt}. Inspect ${workerLog} and ${artifactPath}.`,
};
fs.writeFileSync("state/evaluation.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");
NODE
}

stop_worker_process() {
  local worker_pid="$1"
  if kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
    sleep 2
  fi
  if kill -0 "$worker_pid" 2>/dev/null; then
    kill -9 "$worker_pid" 2>/dev/null || true
  fi
}

read_json_field() {
  local file_path="$1"
  local expression="$2"
  node -e '
const fs = require("fs");
const [filePath, expression] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const value = Function("data", `return (${expression});`)(data);
if (value === undefined || value === null) process.exit(0);
if (typeof value === "object") {
  process.stdout.write(JSON.stringify(value));
} else {
  process.stdout.write(String(value));
}
' "$file_path" "$expression"
}

record_blocker() {
  local kind="$1"
  shift
  local output_path="${CYCLE_DIR}/blocker-${kind}.json"
  local error_path="${output_path}.log"
  if node scripts/ralph/record-blocker.mjs --kind "$kind" "$@" >"$output_path" 2>"$error_path"; then
    :
  else
    append_log "- blocker: failed to record ${kind} -> ${error_path}"
    return 1
  fi

  local recorded summary repeat_count signature
  recorded="$(read_json_field "$output_path" "data.recorded")"
  if [[ "$recorded" != "true" ]]; then
    return 1
  fi
  summary="$(read_json_field "$output_path" "data.summary")"
  repeat_count="$(read_json_field "$output_path" "data.repeat_count")"
  signature="$(read_json_field "$output_path" "data.signature")"
  append_log "- blocker: signature=${signature} repeat=${repeat_count} kind=${kind} ${summary}"
  printf '%s\n' "$output_path"
}

branch_blocker_if_needed() {
  local blocker_record_path="$1"
  if [[ -z "$blocker_record_path" || ! -f "$blocker_record_path" ]]; then
    return 1
  fi

  local threshold_reached
  threshold_reached="$(read_json_field "$blocker_record_path" "data.threshold_reached")"
  if [[ "$threshold_reached" != "true" ]]; then
    return 1
  fi

  local branch_output="${CYCLE_DIR}/blocker-branch.json"
  local branch_error="${branch_output}.log"
  if node scripts/ralph/branch-rca-task.mjs >"$branch_output" 2>"$branch_error"; then
    local rca_task_id blocker_signature
    rca_task_id="$(read_json_field "$branch_output" "data.rca_task_id")"
    blocker_signature="$(read_json_field "$branch_output" "data.blocker_signature")"
    append_log "- blocker: auto-branched signature=${blocker_signature} -> ${rca_task_id}"
    printf '%s\n' "$branch_output"
    return 0
  fi

  append_log "- blocker: RCA branch failed -> ${branch_error}"
  return 1
}

TASK_ID="$(tr -d '\n' < state/current-task.txt || true)"
if [[ -z "${TASK_ID}" || "${TASK_ID}" == "NONE" ]]; then
  echo "No active task. Exiting run-once."
  exit 0
fi

CYCLE_STARTED_AT="$(date -Iseconds)"
CYCLE_STAMP="$(date +%Y%m%dT%H%M%S)"
CYCLE_DIR="state/artifacts/${CYCLE_STAMP}-${TASK_ID}"
mkdir -p "$CYCLE_DIR"

{
  echo ""
  echo "### cycle ${CYCLE_STARTED_AT} task=${TASK_ID}"
  echo "- artifacts: ${CYCLE_DIR}"
} >> "$RUN_LOG"

TASK_PROMPT_LOG="${CYCLE_DIR}/task-prompt.log"
write_cycle_state "prompt" "running"
if node scripts/ralph/render-task-prompt.mjs >"$TASK_PROMPT_LOG" 2>&1; then
  append_log "- prompt: rendered -> scripts/ralph/generated/current-task-prompt.txt"
else
  PROMPT_FAILURE_SUMMARY="$(last_nonempty_line "$TASK_PROMPT_LOG")"
  if [[ -z "${PROMPT_FAILURE_SUMMARY}" ]]; then
    PROMPT_FAILURE_SUMMARY="task prompt rendering failed"
  fi
  append_log "- prompt: failed -> ${TASK_PROMPT_LOG} | ${PROMPT_FAILURE_SUMMARY}"
  write_cycle_state "prompt" "failed"
  printf '%s\n' "Prompt phase failed for task ${TASK_ID}: ${PROMPT_FAILURE_SUMMARY}" > state/last-result.txt
  append_health_mark "x"
  exit 1
fi

WORKER_LOG="${CYCLE_DIR}/worker.jsonl"
append_log "- worker: started"
codex exec \
  --full-auto \
  --sandbox workspace-write \
  --json \
  --output-last-message state/last-result.txt \
  "$(cat scripts/ralph/generated/current-task-prompt.txt)" \
  >"$WORKER_LOG" 2>&1 &
WORKER_PID=$!
LAST_HEARTBEAT_EPOCH="$(date +%s)"
LAST_HEARTBEAT_AT="${CYCLE_STARTED_AT}"
write_worker_cycle_state "running" "$WORKER_PID" "$LAST_HEARTBEAT_AT"

WORKER_STALLED=0
STALL_ARTIFACT_PATH=""
STALL_DETECTED_AT=""
while kill -0 "$WORKER_PID" 2>/dev/null; do
  if [[ -f "$WORKER_LOG" ]]; then
    CURRENT_MTIME="$(stat -f %m "$WORKER_LOG" 2>/dev/null || echo "$LAST_HEARTBEAT_EPOCH")"
    if [[ "$CURRENT_MTIME" -gt "$LAST_HEARTBEAT_EPOCH" ]]; then
      LAST_HEARTBEAT_EPOCH="$CURRENT_MTIME"
      LAST_HEARTBEAT_AT="$(date -Iseconds)"
      write_worker_cycle_state "running" "$WORKER_PID" "$LAST_HEARTBEAT_AT"
    fi
  fi

  NOW_EPOCH="$(date +%s)"
  if (( NOW_EPOCH - LAST_HEARTBEAT_EPOCH > WORKER_STALL_SECONDS )); then
    WORKER_STALLED=1
    STALL_DETECTED_AT="$(date -Iseconds)"
    STALL_ARTIFACT_PATH="$(write_worker_stall_artifact "$WORKER_PID" "$LAST_HEARTBEAT_AT" "$STALL_DETECTED_AT")"
    append_log "- worker: stalled (no worker.jsonl progress for ${WORKER_STALL_SECONDS}s) -> ${STALL_ARTIFACT_PATH}"
    write_worker_cycle_state "stalled" "$WORKER_PID" "$LAST_HEARTBEAT_AT" "$STALL_DETECTED_AT" "$STALL_ARTIFACT_PATH"
    stop_worker_process "$WORKER_PID"
    break
  fi

  sleep "$WORKER_POLL_SECONDS"
done

if wait "$WORKER_PID"; then
  WORKER_EXIT_CODE=0
else
  WORKER_EXIT_CODE=$?
fi

if (( WORKER_STALLED )); then
  write_stall_result "$STALL_ARTIFACT_PATH" "$STALL_DETECTED_AT"
  STALL_BLOCKER_PATH="$(record_blocker "stall" --artifact "$STALL_ARTIFACT_PATH" --worker-log "$WORKER_LOG" || true)"
  append_health_mark "!"
  if BRANCH_OUTPUT_PATH="$(branch_blocker_if_needed "${STALL_BLOCKER_PATH:-}")"; then
    BACKLOG_LOG="${CYCLE_DIR}/backlog.log"
    write_cycle_state "backlog" "running"
    if node scripts/ralph/render-backlog.mjs >"$BACKLOG_LOG" 2>&1; then
      NEXT_TASK="$(tr -d '\n' < state/current-task.txt || true)"
      append_log "- backlog: rendered current=${NEXT_TASK:-NONE}"
    else
      append_log "- backlog: failed -> ${BACKLOG_LOG}"
    fi
    write_cycle_state "finished" "finished"
    append_log "- cycle: finished"
    exit 0
  fi
  exit "$STALL_EXIT_CODE"
fi

if [[ "$WORKER_EXIT_CODE" -eq 0 ]]; then
  append_log "- worker: completed -> ${WORKER_LOG}"
else
  append_log "- worker: failed -> ${WORKER_LOG}"
fi

if [[ -s state/last-result.txt ]]; then
  append_log "- worker-summary: $(head -n 1 state/last-result.txt)"
fi

EVALUATOR_LOG="${CYCLE_DIR}/evaluator.log"
write_cycle_state "evaluator" "running"
append_log "- evaluator: started"
if node scripts/ralph/evaluate-task.mjs >"$EVALUATOR_LOG" 2>&1; then
  :
fi

if [[ -f state/evaluation.json ]]; then
  EVALUATION_SUMMARY="$(node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("state/evaluation.json", "utf8"));
const summary = (data.summary ?? "").replace(/\s+/g, " ").trim();
const head = `status=${data.status ?? "unknown"} promotion=${String(data.promotion_eligible ?? false)}`;
process.stdout.write(summary ? `${head} ${summary}` : head);
')"
  append_log "- evaluator: ${EVALUATION_SUMMARY} -> ${EVALUATOR_LOG}"
  NEXT_SERVER_LOG_PATH="$(node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("state/evaluation.json", "utf8"));
const commands = Array.isArray(data?.deterministic?.commands) ? data.deterministic.commands : [];
const logPath = commands.find((command) => typeof command?.next_server_log_path === "string")?.next_server_log_path ?? "";
process.stdout.write(logPath);
')"
  if [[ -n "${NEXT_SERVER_LOG_PATH}" ]]; then
    append_log "- next-server-log: ${NEXT_SERVER_LOG_PATH}"
  fi
else
  append_log "- evaluator: failed -> ${EVALUATOR_LOG}"
fi

COMMIT_LOG="${CYCLE_DIR}/commit.log"
write_cycle_state "commit" "running"
if ./scripts/ralph/commit-if-changed.sh >"$COMMIT_LOG" 2>&1; then
  append_log "- commit: $(last_nonempty_line "$COMMIT_LOG")"
else
  append_log "- commit: failed -> ${COMMIT_LOG}"
fi

BLOCKER_RECORD_PATH=""
if [[ -f state/evaluation.json ]]; then
  PROMOTION_ELIGIBLE="$(read_json_field state/evaluation.json "data.promotion_eligible")"
  if [[ "$PROMOTION_ELIGIBLE" != "true" ]]; then
    BLOCKER_RECORD_PATH="$(record_blocker "evaluation" || true)"
  fi
fi

if BRANCH_OUTPUT_PATH="$(branch_blocker_if_needed "${BLOCKER_RECORD_PATH:-}")"; then
  BACKLOG_LOG="${CYCLE_DIR}/backlog.log"
  write_cycle_state "backlog" "running"
  if node scripts/ralph/render-backlog.mjs >"$BACKLOG_LOG" 2>&1; then
    NEXT_TASK="$(tr -d '\n' < state/current-task.txt || true)"
    append_log "- backlog: rendered current=${NEXT_TASK:-NONE}"
  else
    append_log "- backlog: failed -> ${BACKLOG_LOG}"
  fi
  append_health_mark "x"
  write_cycle_state "finished" "finished"
  append_log "- cycle: finished"
  exit 0
fi

PROMOTE_LOG="${CYCLE_DIR}/promote.log"
PROMOTION_SUCCEEDED=0
write_cycle_state "promote" "running"
if node scripts/ralph/promote-task.mjs >"$PROMOTE_LOG" 2>&1; then
  append_log "- promote: $(last_nonempty_line "$PROMOTE_LOG")"
  if grep -q "^Promoted " "$PROMOTE_LOG"; then
    PROMOTION_SUCCEEDED=1
  fi
else
  append_log "- promote: failed -> ${PROMOTE_LOG}"
fi

BACKLOG_LOG="${CYCLE_DIR}/backlog.log"
write_cycle_state "backlog" "running"
if node scripts/ralph/render-backlog.mjs >"$BACKLOG_LOG" 2>&1; then
  NEXT_TASK="$(tr -d '\n' < state/current-task.txt || true)"
  append_log "- backlog: rendered current=${NEXT_TASK:-NONE}"
else
  append_log "- backlog: failed -> ${BACKLOG_LOG}"
fi

HEALTH_MARK="x"
if [[ "$PROMOTION_SUCCEEDED" -eq 1 ]]; then
  HEALTH_MARK="o"
fi
append_health_mark "$HEALTH_MARK"

write_cycle_state "finished" "finished"
append_log "- cycle: finished"
