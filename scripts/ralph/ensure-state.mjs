import path from "node:path";
import {
  ACTIVE_TASK_DIR,
  COMPLETED_TASK_DIR,
  GENERATED_DIR,
  STATE_DIR,
  ensureDir,
  fileExists,
  listTaskDocs,
  readCurrentTaskId,
  renderBacklogMarkdown,
  syncCurrentTaskState,
  writeText,
} from "./lib/task-utils.mjs";

ensureDir(STATE_DIR);
ensureDir(GENERATED_DIR);
ensureDir(path.join(STATE_DIR, "artifacts"));

syncCurrentTaskState();

const defaults = [
  ["run-log.md", "# Ralph Loop Run Log\n"],
  ["task-history.md", "# Task History\n\n"],
  ["last-result.txt", ""],
  ["evaluation.json", '{\n  "status": "not_run"\n}\n'],
  ["blocker-tracker.json", '{\n  "version": 1,\n  "updated_at": "",\n  "tasks": {}\n}\n'],
  ["current-cycle.json", '{\n  "status": "idle"\n}\n'],
  ["backlog.md", "# Backlog\n\n"],
];

for (const [name, content] of defaults) {
  const fullPath = path.join(STATE_DIR, name);
  if (!fileExists(fullPath)) {
    writeText(fullPath, content);
  }
}

const currentTaskId = readCurrentTaskId();
const tasks = [
  ...listTaskDocs(ACTIVE_TASK_DIR),
  ...listTaskDocs(COMPLETED_TASK_DIR),
].sort((a, b) => (a.meta.order ?? Number.MAX_SAFE_INTEGER) - (b.meta.order ?? Number.MAX_SAFE_INTEGER));

writeText(path.join(STATE_DIR, "backlog.md"), renderBacklogMarkdown(tasks, currentTaskId));
