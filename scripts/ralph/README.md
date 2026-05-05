# Minakeep Ralph Loop v2

This package upgrades the repository from a **repair loop** to a **task-promotion loop**.

## What changed

The first version of the loop could repeatedly work on one prompt, but it could not
reliably decide when to advance. This version adds:

- machine-readable task contracts in `docs/exec-plans/active/*.md`
- deterministic checks
- a read-only evaluator pass with structured JSON output for normal tasks
- deterministic-only promotion for tasks whose quality is fully proven by required commands
- automatic promotion to the next task when the current task is truly complete

## Why this matches the OpenAI harness pattern

OpenAI’s harness engineering article describes a system where:
- humans specify intent
- repository docs act as the system of record
- agents iterate until reviewers are satisfied
- short `AGENTS.md` files point to a structured `docs/` tree

This loop makes that concrete for Minakeep by treating the task docs as executable
contracts and adding a separate evaluator step before promotion.

## Files

- `scripts/ralph/run-once.sh`: one full worker/evaluator/promotion cycle
- `scripts/ralph/run-loop.sh`: repeated unattended cycles
- `scripts/ralph/ensure-e2e-port-free.sh`: clears port `3100` before E2E-capable verification commands
- `scripts/ralph/ensure-state.mjs`: repairs obvious task-state drift and refreshes loop-owned state files
- `scripts/ralph/status.sh`: inspect current task, latest evaluation, and backlog
- `scripts/ralph/render-task-prompt.mjs`: build the worker prompt from the current task

- `scripts/ralph/evaluate-task.mjs`: run deterministic checks and a read-only evaluator
- `scripts/ralph/record-blocker.mjs`: normalize and persist repeated blocker signatures
- `scripts/ralph/branch-rca-task.mjs`: auto-create blocker RCA tasks and switch queue priority

- `scripts/ralph/promote-task.mjs`: move a finished task forward
- `scripts/ralph/manual-promote.sh`: manually promote the current task with a recorded reason and optional artifact reference
- `state/current-task.txt`: current task id
- `state/current-cycle.json`: live cycle phase/status for the current run
- `state/evaluation.json`: latest decision
- `state/blocker-tracker.json`: repeat-blocker signature history and RCA branching state
- `state/backlog.md`: rendered queue snapshot
- `state/artifacts/`: per-cycle raw worker/evaluator/commit artifacts

## Safety defaults

The worker run uses:

- `--sandbox workspace-write`
- `--full-auto`

The evaluator run uses:

- `--sandbox read-only`
- `--output-schema ...`

This keeps the evaluator non-mutating and machine-readable.

Before Playwright-backed verification, the harness forcibly clears any listener on
`127.0.0.1:3100`. This is intentionally aggressive and can terminate unrelated
local work that is bound to that port.

## Logging

- `state/run-log.md` is the compact operator log
- `state/current-cycle.json` shows whether the current run is still active and which phase it is in
- `state/blocker-tracker.json` tracks repeated blocker signatures per task
- full raw output for each cycle is written under `state/artifacts/`
- Playwright-backed verification also writes Next.js server output to a per-cycle `*-next-server.log` artifact
- manual operator runs should use `npm run start:logged`, which writes a timestamped Next.js server log under `logs/`
- generated repos should document a server log level environment variable such as `LOG_LEVEL`, with at least `trace`, `debug`, `info`, `warn`, and `error`
- server wrappers default `MINAKEEP_DEBUG_SERVER=1`, so AI-tagging failures include debug details in the Next server logs without logging note bodies or tokens
- inspect artifact files when the compact log points to a failed phase
- `state/run-log.md` also appends a compact health line after each cycle: `o` for promoted success, `x` for completed non-promotion/failure or RCA auto-branch, and `!` for a stalled worker cycle

## Recommended usage

### Dry run one cycle

```bash
./scripts/ralph/run-once.sh
./scripts/ralph/status.sh
```

### Run a longer unattended loop

```bash
RALPH_LOOP_SLEEP_SECONDS=45 ./scripts/ralph/run-loop.sh
```

Default sleep is `30` seconds when `RALPH_LOOP_SLEEP_SECONDS` is not set.

### Observe progress

```bash
tail -f state/run-log.md
cat state/last-result.txt
cat state/evaluation.json
cat state/current-cycle.json
ls logs/
tail -f logs/next-server-*.log
```

### Manual promotion for stalled-but-done tasks

Use this only when the task is substantively complete but the loop stalled or the latest evaluation is no longer trustworthy.

```bash
./scripts/ralph/manual-promote.sh

./scripts/ralph/manual-promote.sh \
  --reason "task is complete; loop stalled after implementation" \
  --artifact state/artifacts/<cycle-dir>
```

If no reason is supplied, the override records the default reason `operator manual promotion`.

## Operator guidance

- Keep tasks small and vertically sliced.
- Prefer deterministic gates over “try harder” loops, and use evaluator review only when the task contract still needs semantic judgment.
- Do not mix multiple feature fronts into one task.
- `run-once.sh` always rewrites `state/current-cycle.json`, `state/evaluation.json`, `state/backlog.md`, and `state/last-result.txt`; treat those as loop-owned state.
- if the worker goes silent and `worker.jsonl` stops changing past the stall timeout, the harness marks the cycle as `stalled`, writes a stall artifact, appends `!` to the health line, and stops the unattended loop for operator triage unless that identical stall has already repeated enough times to auto-branch into RCA
- a single `!` does not automatically mean “create the RCA task now”; the loop records the blocker signature first and only auto-branches into the RCA/fix plan after the same blocker repeats enough times to satisfy the environment-blocker rule
- when a repeated blocker hits the threshold, the loop auto-generates a blocker-specific RCA task, marks the original task as blocked, switches `state/current-task.txt` to the RCA task, and restores the original task when the RCA task promotes
- promotion fails closed: if the successor task cannot be restored or validated, `promote-task.mjs` exits non-zero and leaves the current task unchanged instead of advancing `state/current-task.txt`
- Required commands come from each task doc’s `taskmeta.required_commands`; `evaluate-task.mjs` runs exactly those commands plus required-file checks.
- If `taskmeta.promotion_mode` is `deterministic_only`, `evaluate-task.mjs` promotes the task based on required command and required-file results alone.
- `manual-promote.sh` is an explicit operator override; use it only for exceptional stalled-but-done cases. If you omit `--reason`, it records `operator manual promotion`.
- Port cleanup is executed automatically only by the evaluator path for `npm run verify`, `npm run test:e2e`, or other Playwright-bearing commands. Manual local runs do not get that cleanup for free.
- `ensure-e2e-port-free.sh` is intentionally aggressive and may terminate unrelated processes bound to `127.0.0.1:3100`.
- `state/current-task.txt` must point at a task that still exists in `docs/exec-plans/active/` with status `active` or `queued`, or be `NONE` only when the runnable queue is exhausted.
- `docs/exec-plans/completed/` is history only. Plans in that directory are never runnable current tasks.
- `ensure-state.mjs` repairs obvious drift before status/loop runs by rewriting `state/current-task.txt` to the current runnable task or `NONE`, and it refreshes `state/backlog.md`.
- if prompt rendering fails, `run-once.sh` stops immediately, records the prompt-phase failure in `state/current-cycle.json` and `state/last-result.txt`, appends `x` to the health line, and does not launch the worker/evaluator/promotion phases.
- if `current-task.txt` is invalid and there is no runnable task to repair to, treat that as queue exhaustion or operator repair work; do not keep rerunning the loop expecting progress.
- If the evaluator repeatedly returns `not_done`, tighten the active task doc instead of making the prompt larger.
- If a task is semantically done but not promotable, fix the contract or the deterministic checks; if you must override, use `manual-promote.sh` so the reason is recorded instead of silently skipping ahead.
