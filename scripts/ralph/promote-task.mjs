import fs from "node:fs";
import path from "node:path";
import { clearTaskBlockers } from "./lib/blocker-utils.mjs";
import {
  ACTIVE_TASK_DIR,
  COMPLETED_TASK_DIR,
  appendTaskProgressNote,
  ensureDir,
  fileExists,
  findTaskDoc,
  normalizeTaskId,
  readCurrentTaskId,
  readText,
  replaceTaskMeta,
  timestamp,
  writeCurrentTaskId,
  writeText,
} from "./lib/task-utils.mjs";

const DEFAULT_MANUAL_PROMOTION_REASON = "operator manual promotion";

function normalizeNextTaskTarget(raw) {
  if (raw === null || raw === undefined) return null;
  const normalized = normalizeTaskId(raw);
  if (!normalized || normalized === "NONE") {
    return null;
  }
  return normalized;
}

function parseTaskMeta(markdown, label) {
  const match = markdown.match(/```json taskmeta\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error(`${label} is missing a taskmeta block.`);
  }

  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    throw new Error(`${label} has invalid taskmeta JSON: ${error.message}`);
  }
}

function buildNextTaskUpdate({ nextTaskId, parentTaskId, currentTaskId, completedAt, blockerSignature }) {
  if (!nextTaskId) {
    return {
      nextCurrentTaskId: "NONE",
      apply: null,
    };
  }

  const nextTask = findTaskDoc(nextTaskId);
  const fallbackNextTaskPath = path.join(ACTIVE_TASK_DIR, `${nextTaskId}.md`);
  if (!nextTask && !fileExists(fallbackNextTaskPath)) {
    throw new Error(`Next task '${nextTaskId}' does not exist in active plans.`);
  }

  const nextTaskPath = nextTask?.filePath ?? fallbackNextTaskPath;
  const nextMarkdown = nextTask?.markdown ?? readText(nextTaskPath);
  const nextMeta = parseTaskMeta(nextMarkdown, `Next task '${nextTaskId}'`);
  if (normalizeTaskId(nextMeta.id) !== nextTaskId) {
    throw new Error(`Next task '${nextTaskId}' resolved to a taskmeta.id mismatch.`);
  }
  if (nextMeta.status === "completed") {
    throw new Error(`Next task '${nextTaskId}' is already marked completed and cannot become current.`);
  }

  const isRcaReturn =
    parentTaskId && normalizeTaskId(parentTaskId) === normalizeTaskId(nextTaskId);
  const restoredMeta = {
    ...nextMeta,
    status: "active",
  };

  if (isRcaReturn) {
    delete restoredMeta.blocked_by_task_id;
    delete restoredMeta.blocker_signature;
    delete restoredMeta.blocked_at;
  }

  const progressNote = isRcaReturn
    ? `${completedAt}: blocker RCA task ${currentTaskId} completed; restored as current task after resolving blocker ${blockerSignature ?? "unknown"}.`
    : `${completedAt}: restored as current task after ${currentTaskId} promotion.`;

  return {
    nextCurrentTaskId: nextTaskId,
    apply: {
      path: nextTaskPath,
      content: appendTaskProgressNote(replaceTaskMeta(nextMarkdown, restoredMeta), progressNote),
    },
  };
}

function parseArgs(argv) {
  const parsed = {
    manual: false,
    reason: DEFAULT_MANUAL_PROMOTION_REASON,
    artifact: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manual") {
      parsed.manual = true;
      continue;
    }
    if (arg === "--reason") {
      parsed.reason = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--artifact") {
      parsed.artifact = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

const options = parseArgs(process.argv.slice(2));
const evaluationPath = path.join(process.cwd(), "state", "evaluation.json");
if (!options.manual && !fileExists(evaluationPath)) {
  console.log("No evaluation.json found; skipping promotion.");
  process.exit(0);
}

const evaluation = fileExists(evaluationPath) ? JSON.parse(readText(evaluationPath)) : null;
if (!options.manual && !evaluation?.promotion_eligible) {
  console.log(`Task ${evaluation.task_id ?? "(unknown)"} not eligible for promotion.`);
  process.exit(0);
}

const currentTaskId = readCurrentTaskId();
const task = findTaskDoc(currentTaskId);
if (!task) {
  console.log(`Current task ${currentTaskId} not found; skipping promotion.`);
  process.exit(0);
}

const completedAt = timestamp();
const nextTaskId = normalizeNextTaskTarget(task.meta.next_task_on_success);
const parentTaskId = task.meta.rca_for_task_id ?? null;
const overrideArtifact = options.artifact.trim();
const manualOverride = options.manual
  ? {
      reason: options.reason.trim() || DEFAULT_MANUAL_PROMOTION_REASON,
      artifact: overrideArtifact || null,
      previous_evaluation_status: evaluation?.status ?? null,
      promoted_at: completedAt,
    }
  : null;

const completedMeta = {
  ...task.meta,
  status: "completed",
  completed_at: completedAt,
  ...(manualOverride ? { manual_override: manualOverride } : {}),
};

let completedMarkdown = replaceTaskMeta(task.markdown, completedMeta);
completedMarkdown = appendTaskProgressNote(
  completedMarkdown,
  manualOverride
    ? `${completedAt}: manually promoted by operator override. Reason: ${manualOverride.reason}${manualOverride.artifact ? ` Artifact: ${manualOverride.artifact}.` : ""}`
    : `${completedAt}: automatically promoted after deterministic checks and evaluator approval.`,
);

ensureDir(COMPLETED_TASK_DIR);
const completedPath = path.join(COMPLETED_TASK_DIR, path.basename(task.filePath));
const nextTaskUpdate = buildNextTaskUpdate({
  nextTaskId,
  parentTaskId,
  currentTaskId: task.id,
  completedAt,
  blockerSignature: task.meta.blocker_signature,
});

if (nextTaskUpdate.apply) {
  writeText(nextTaskUpdate.apply.path, nextTaskUpdate.apply.content);
}
writeText(completedPath, completedMarkdown);
fs.unlinkSync(task.filePath);
writeCurrentTaskId(nextTaskUpdate.nextCurrentTaskId);

const historyPath = path.join(process.cwd(), "state", "task-history.md");
const nextTaskLabel = nextTaskId ?? "NONE";
const historyEntry = manualOverride
  ? `- ${completedAt}: manually promoted ${task.id} -> ${nextTaskLabel} | reason=${manualOverride.reason}${manualOverride.artifact ? ` | artifact=${manualOverride.artifact}` : ""}\n`
  : `- ${completedAt}: promoted ${task.id} -> ${nextTaskLabel}\n`;
fs.appendFileSync(historyPath, historyEntry, "utf8");

clearTaskBlockers(task.id);
if (parentTaskId) {
  clearTaskBlockers(parentTaskId);
}

if (manualOverride) {
  const manualEvaluation = {
    checked_at: completedAt,
    task_id: task.id,
    status: "done",
    promotion_eligible: true,
    deterministic: evaluation?.deterministic ?? null,
    llm: evaluation?.llm ?? null,
    summary: `Task manually promoted by operator override. Reason: ${manualOverride.reason}`,
    missing_requirements: evaluation?.missing_requirements ?? [],
    manual_override: manualOverride,
  };
  writeText(evaluationPath, JSON.stringify(manualEvaluation, null, 2));
}

console.log(
  manualOverride
    ? `Manually promoted ${task.id} -> ${nextTaskLabel}`
    : `Promoted ${task.id} -> ${nextTaskLabel}`
);
