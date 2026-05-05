# State Directory

These files are mutable runtime artifacts for the Ralph loop.

- `current-task.txt`: the active task id
- `last-result.txt`: final message from the last worker Codex run
- `evaluation.json`: latest deterministic + evaluator result
- `blocker-tracker.json`: repeated blocker signatures and RCA branch state
- `task-history.md`: promotion history
- `run-log.md`: append-only operational log
- `backlog.md`: rendered queue snapshot
- `current-cycle.json`: current phase/status, including `stalled` when the worker heartbeat goes silent
