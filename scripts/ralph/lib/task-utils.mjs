import fs from "node:fs";
import path from "node:path";

export const REPO_ROOT = process.cwd();
export const ACTIVE_TASK_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "active");
export const COMPLETED_TASK_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "completed");
export const STATE_DIR = path.join(REPO_ROOT, "state");
export const GENERATED_DIR = path.join(REPO_ROOT, "scripts", "ralph", "generated");

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function timestamp() {
  return new Date().toISOString();
}

export function normalizeTaskId(raw) {
  return String(raw).trim().replace(/\.md$/, "");
}

export function readCurrentTaskId() {
  const filePath = path.join(STATE_DIR, "current-task.txt");
  if (!fileExists(filePath)) return null;
  const value = normalizeTaskId(readText(filePath));
  return value.length > 0 ? value : null;
}

export function writeCurrentTaskId(taskId) {
  writeText(path.join(STATE_DIR, "current-task.txt"), `${normalizeTaskId(taskId)}\n`);
}

export function extractTaskMeta(markdown) {
  const match = markdown.match(/```json taskmeta\s*([\s\S]*?)```/);
  if (!match) return null;
  return JSON.parse(match[1].trim());
}

export function replaceTaskMeta(markdown, nextMeta) {
  const serialized = JSON.stringify(nextMeta, null, 2);
  return markdown.replace(
    /```json taskmeta\s*[\s\S]*?```/,
    `\`\`\`json taskmeta\n${serialized}\n\`\`\``
  );
}

export function listTaskDocs(dirPath = ACTIVE_TASK_DIR) {
  if (!fileExists(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const docs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const fullPath = path.join(dirPath, entry.name);
    const markdown = readText(fullPath);
    const meta = extractTaskMeta(markdown);
    if (!meta) continue;
    docs.push({
      id: normalizeTaskId(meta.id ?? entry.name),
      fileName: entry.name,
      filePath: fullPath,
      markdown,
      meta,
    });
  }
  return docs.sort((a, b) => {
    const ao = a.meta.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.meta.order ?? Number.MAX_SAFE_INTEGER;
    return ao - bo || a.fileName.localeCompare(b.fileName);
  });
}

export function findTaskDoc(taskId, dirPath = ACTIVE_TASK_DIR) {
  const normalized = normalizeTaskId(taskId);
  return listTaskDocs(dirPath).find((task) => task.id === normalized) ?? null;
}

export function isRunnableTaskStatus(status) {
  return ["active", "queued"].includes(String(status ?? ""));
}

export function listRunnableTaskDocs(dirPath = ACTIVE_TASK_DIR) {
  return listTaskDocs(dirPath).filter((task) => isRunnableTaskStatus(task.meta.status));
}

export function getPreferredRunnableTask(tasks = listRunnableTaskDocs()) {
  return tasks.find((task) => String(task.meta.status) === "active") ?? tasks[0] ?? null;
}

export function inspectCurrentTaskState() {
  const currentTaskId = readCurrentTaskId();
  const runnableTasks = listRunnableTaskDocs();
  const resolvedTask = getPreferredRunnableTask(runnableTasks);

  if (!currentTaskId) {
    return {
      ok: false,
      current_task_id: null,
      resolved_task_id: resolvedTask?.id ?? null,
      reason: resolvedTask ? "current_task_missing" : "queue_exhausted",
      repair_applied: false,
    };
  }

  if (currentTaskId === "NONE") {
    return {
      ok: !resolvedTask,
      current_task_id: currentTaskId,
      resolved_task_id: resolvedTask?.id ?? null,
      reason: resolvedTask ? "current_task_none_with_runnable_tasks" : "queue_exhausted",
      repair_applied: false,
    };
  }

  const activeTask = findTaskDoc(currentTaskId, ACTIVE_TASK_DIR);
  if (activeTask) {
    if (String(activeTask.meta.status) === "completed") {
      return {
        ok: false,
        current_task_id: currentTaskId,
        resolved_task_id: resolvedTask?.id ?? null,
        reason: "current_task_marked_completed_in_active",
        repair_applied: false,
      };
    }

    if (!isRunnableTaskStatus(activeTask.meta.status)) {
      return {
        ok: false,
        current_task_id: currentTaskId,
        resolved_task_id: resolvedTask?.id ?? null,
        reason: `current_task_not_runnable:${String(activeTask.meta.status ?? "unknown")}`,
        repair_applied: false,
      };
    }

    return {
      ok: true,
      current_task_id: currentTaskId,
      resolved_task_id: activeTask.id,
      reason: "current_task_valid",
      repair_applied: false,
    };
  }

  const completedTask = findTaskDoc(currentTaskId, COMPLETED_TASK_DIR);
  return {
    ok: false,
    current_task_id: currentTaskId,
    resolved_task_id: resolvedTask?.id ?? null,
    reason: completedTask ? "current_task_only_in_completed" : "current_task_missing_from_active",
    repair_applied: false,
  };
}

export function syncCurrentTaskState() {
  const inspection = inspectCurrentTaskState();
  if (inspection.ok) return inspection;

  const nextTaskId = inspection.resolved_task_id ?? "NONE";
  if (inspection.current_task_id !== nextTaskId) {
    writeCurrentTaskId(nextTaskId);
    return {
      ...inspection,
      current_task_id: nextTaskId,
      repair_applied: true,
    };
  }

  return inspection;
}

export function getFirstQueuedOrActiveTask() {
  return getPreferredRunnableTask();
}

export function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const match = markdown.match(regex);
  return match ? match[1].trim() : "";
}

export function appendTaskProgressNote(markdown, noteLine) {
  const marker = "## Progress log";
  if (!markdown.includes(marker)) return `${markdown.trim()}\n\n## Progress log\n\n- ${noteLine}\n`;
  return markdown.replace(
    /## Progress log\s*([\s\S]*)$/,
    (_whole, tail) => `${marker}\n\n${tail.trim()}\n- ${noteLine}\n`
  );
}

export function renderBacklogMarkdown(tasks, currentTaskId) {
  const lines = ["# Backlog", ""];
  for (const task of tasks) {
    const isCurrent = normalizeTaskId(task.id) === normalizeTaskId(currentTaskId);
    const marker =
      task.meta.status === "completed"
        ? "x"
        : task.meta.status === "blocked"
          ? "!"
          : " ";
    const currentTag = isCurrent ? " ← current" : "";
    const statusTag = task.meta.status === "blocked" ? " (blocked)" : "";
    lines.push(`- [${marker}] ${task.id} — ${task.meta.title}${statusTag}${currentTag}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
