#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3100}"
TERM_WAIT_SECONDS="${RALPH_PORT_TERM_WAIT_SECONDS:-2}"
KILL_WAIT_SECONDS="${RALPH_PORT_KILL_WAIT_SECONDS:-1}"
CURRENT_PIDS=()

read_pids() {
  lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true
}

collect_pids() {
  local raw
  raw="$(read_pids)"
  if [[ -z "${raw}" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && printf '%s\n' "${pid}"
  done <<< "${raw}" | awk '!seen[$0]++'
}

load_pids() {
  local pid
  CURRENT_PIDS=()
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && CURRENT_PIDS+=("${pid}")
  done < <(collect_pids)
}

load_pids
listening_pids=()
if (( ${#CURRENT_PIDS[@]} > 0 )); then
  listening_pids=("${CURRENT_PIDS[@]}")
fi
if (( ${#listening_pids[@]} == 0 )); then
  echo "port-cleanup: 127.0.0.1:${PORT} already free"
  exit 0
fi

echo "port-cleanup: terminating listener(s) on 127.0.0.1:${PORT}: ${listening_pids[*]}"
kill "${listening_pids[@]}" 2>/dev/null || true
sleep "${TERM_WAIT_SECONDS}"

load_pids
remaining_after_term=()
if (( ${#CURRENT_PIDS[@]} > 0 )); then
  remaining_after_term=("${CURRENT_PIDS[@]}")
fi
if (( ${#remaining_after_term[@]} > 0 )); then
  echo "port-cleanup: escalating to SIGKILL for listener(s): ${remaining_after_term[*]}"
  kill -9 "${remaining_after_term[@]}" 2>/dev/null || true
  sleep "${KILL_WAIT_SECONDS}"
fi

load_pids
remaining_after_kill=()
if (( ${#CURRENT_PIDS[@]} > 0 )); then
  remaining_after_kill=("${CURRENT_PIDS[@]}")
fi
if (( ${#remaining_after_kill[@]} > 0 )); then
  echo "port-cleanup: failed to free 127.0.0.1:${PORT}; remaining listener(s): ${remaining_after_kill[*]}" >&2
  exit 1
fi

echo "port-cleanup: 127.0.0.1:${PORT} is free"
