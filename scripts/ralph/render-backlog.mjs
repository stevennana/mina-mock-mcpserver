import path from "node:path";
import {
  ACTIVE_TASK_DIR,
  COMPLETED_TASK_DIR,
  STATE_DIR,
  listTaskDocs,
  readCurrentTaskId,
  renderBacklogMarkdown,
  writeText,
} from "./lib/task-utils.mjs";

const currentTaskId = readCurrentTaskId();
const tasks = [
  ...listTaskDocs(ACTIVE_TASK_DIR),
  ...listTaskDocs(COMPLETED_TASK_DIR),
].sort((a, b) => (a.meta.order ?? Number.MAX_SAFE_INTEGER) - (b.meta.order ?? Number.MAX_SAFE_INTEGER));

const markdown = renderBacklogMarkdown(tasks, currentTaskId);
writeText(path.join(STATE_DIR, "backlog.md"), markdown);
console.log(markdown.trim());
