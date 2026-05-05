import crypto from "node:crypto";
import path from "node:path";
import {
  STATE_DIR,
  ensureDir,
  fileExists,
  normalizeTaskId,
  readText,
  safeJsonParse,
  timestamp,
  writeText,
} from "./task-utils.mjs";

export const BLOCKER_TRACKER_PATH = path.join(STATE_DIR, "blocker-tracker.json");
export const RCA_REPEAT_THRESHOLD = 3;

const MAX_ARTIFACT_HISTORY = 5;
const TRACKER_VERSION = 1;

function defaultTracker() {
  return {
    version: TRACKER_VERSION,
    updated_at: timestamp(),
    tasks: {},
  };
}

function ensureTaskEntry(tracker, taskId) {
  const normalizedTaskId = normalizeTaskId(taskId);
  if (!tracker.tasks[normalizedTaskId]) {
    tracker.tasks[normalizedTaskId] = {
      last_signature: null,
      last_seen_at: null,
      signatures: {},
    };
  }
  return tracker.tasks[normalizedTaskId];
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function trimTrailingPunctuation(value) {
  return value.replace(/^[("'`]+|[)",.:;'"`]+$/g, "");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "blocker";
}

function basename(value) {
  return value.split("/").at(-1) ?? value;
}

function createShortHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function extractRelativePaths(text) {
  if (!text) return [];
  const matches = text.match(/(?:tests|src|docs)\/[A-Za-z0-9._/-]+/g) ?? [];
  return unique(
    matches
      .map((entry) => trimTrailingPunctuation(entry))
      .filter((entry) => entry.includes(".spec.") || entry.includes(".test.") || entry.endsWith(".png")),
  ).sort();
}

function appendArtifactHistory(existingPaths, nextPaths) {
  return unique([...(existingPaths ?? []), ...(nextPaths ?? [])]).slice(-MAX_ARTIFACT_HISTORY);
}

function summarizeFailedCommands(failedCommands) {
  const slugs = unique(failedCommands.map((command) => slugify(command.command)));
  return slugs.length > 0 ? slugs : ["no-command"];
}

function summarizeFailingPaths(failedCommands, missingFiles) {
  const failingPaths = unique([
    ...failedCommands.flatMap((command) => command.failing_spec_paths ?? []),
    ...(missingFiles ?? []),
  ]).sort();
  return failingPaths.length > 0 ? failingPaths : ["no-path-details"];
}

function buildDeterministicSummary(failedCommands, missingFiles) {
  const failedCommandList = unique(failedCommands.map((command) => command.command));
  const failingPaths = summarizeFailingPaths(failedCommands, missingFiles);
  const commandSummary =
    failedCommandList.length > 0
      ? `Repeated required-command failure: ${failedCommandList.join(", ")}`
      : "Repeated deterministic failure";
  const pathSummary =
    failingPaths[0] === "no-path-details"
      ? ""
      : ` (${failingPaths.map((item) => basename(item)).join(", ")})`;
  return `${commandSummary}${pathSummary}`;
}

function getLastWorkerEvent(workerLogPath) {
  if (!workerLogPath || !fileExists(workerLogPath)) {
    return null;
  }

  const lines = readText(workerLogPath)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = safeJsonParse(lines[index], null);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function loadBlockerTracker() {
  ensureDir(STATE_DIR);
  if (!fileExists(BLOCKER_TRACKER_PATH)) {
    return defaultTracker();
  }

  const parsed = safeJsonParse(readText(BLOCKER_TRACKER_PATH), null);
  if (!parsed || typeof parsed !== "object") {
    return defaultTracker();
  }

  return {
    version: TRACKER_VERSION,
    updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : timestamp(),
    tasks: typeof parsed.tasks === "object" && parsed.tasks ? parsed.tasks : {},
  };
}

export function writeBlockerTracker(tracker) {
  writeText(BLOCKER_TRACKER_PATH, `${JSON.stringify(tracker, null, 2)}\n`);
}

export function clearTaskBlockers(taskId) {
  const tracker = loadBlockerTracker();
  delete tracker.tasks[normalizeTaskId(taskId)];
  tracker.updated_at = timestamp();
  writeBlockerTracker(tracker);
}

export function markBlockerBranched(taskId, signature, branchedTaskId) {
  const tracker = loadBlockerTracker();
  const taskEntry = ensureTaskEntry(tracker, taskId);
  const entry = taskEntry.signatures[signature];
  if (!entry) {
    return;
  }

  entry.branched_to_task_id = normalizeTaskId(branchedTaskId);
  entry.branched_at = timestamp();
  tracker.updated_at = timestamp();
  writeBlockerTracker(tracker);
}

export function getLatestBlockerEntry(taskId) {
  const tracker = loadBlockerTracker();
  const taskEntry = tracker.tasks[normalizeTaskId(taskId)];
  if (!taskEntry?.last_signature) {
    return null;
  }
  return taskEntry.signatures?.[taskEntry.last_signature] ?? null;
}

export function deriveEvaluationBlocker(taskId, evaluation) {
  if (!evaluation || evaluation.promotion_eligible) {
    return null;
  }

  const failedCommands = (evaluation?.deterministic?.commands ?? [])
    .filter((result) => !result?.ok)
    .map((result) => {
      const combinedOutput = `${result?.output ?? ""}\n${result?.error ?? ""}`;
      return {
        command: result.command,
        failing_spec_paths: extractRelativePaths(combinedOutput),
        next_server_log_path: result?.next_server_log_path ?? null,
      };
    });

  const missingFiles = unique((evaluation?.deterministic?.missing_files ?? []).map((item) => trimTrailingPunctuation(item))).sort();

  if (failedCommands.length === 0 && missingFiles.length === 0) {
    return null;
  }

  const signature = [
    "deterministic_failure",
    ...summarizeFailedCommands(failedCommands),
    ...summarizeFailingPaths(failedCommands, missingFiles),
  ].join("|");

  return {
    task_id: normalizeTaskId(taskId),
    kind: "deterministic_failure",
    signature,
    summary: buildDeterministicSummary(failedCommands, missingFiles),
    branch_slug: [
      ...summarizeFailedCommands(failedCommands).slice(0, 1),
      ...summarizeFailingPaths(failedCommands, missingFiles)
        .filter((item) => item !== "no-path-details")
        .slice(0, 2)
        .map((item) => slugify(basename(item).replace(/\.[^.]+$/, ""))),
      createShortHash(signature),
    ]
      .filter(Boolean)
      .join("-")
      .slice(0, 48),
    failed_commands: unique(failedCommands.map((item) => item.command)),
    failing_spec_paths: unique(failedCommands.flatMap((item) => item.failing_spec_paths)).sort(),
    missing_files: missingFiles,
    evidence_artifact_paths: appendArtifactHistory(
      [],
      failedCommands
        .map((item) => item.next_server_log_path)
        .filter(Boolean),
    ),
  };
}

export function deriveStallBlocker(taskId, stallArtifactPath, workerLogPath) {
  const lastEvent = getLastWorkerEvent(workerLogPath);
  const eventType = String(lastEvent?.type ?? "unknown-event");
  const itemType = String(lastEvent?.item?.type ?? "unknown-item");
  const commandSlug = lastEvent?.item?.command ? slugify(lastEvent.item.command) : "no-command";
  const signature = ["worker_stall", eventType, itemType, commandSlug].join("|");
  const summary =
    lastEvent?.item?.command
      ? `Repeated worker stall after ${itemType}: ${lastEvent.item.command}`
      : `Repeated worker stall after ${eventType}`;

  return {
    task_id: normalizeTaskId(taskId),
    kind: "worker_stall",
    signature,
    summary,
    branch_slug: `worker-stall-${commandSlug}-${createShortHash(signature)}`.slice(0, 48),
    failed_commands: [],
    failing_spec_paths: [],
    missing_files: [],
    evidence_artifact_paths: appendArtifactHistory([], [stallArtifactPath, workerLogPath]),
    stall_context: {
      event_type: eventType,
      item_type: itemType,
      command: lastEvent?.item?.command ?? null,
    },
  };
}

export function recordBlockerOccurrence(taskId, blocker) {
  if (!blocker) {
    return null;
  }

  const tracker = loadBlockerTracker();
  const now = timestamp();
  const taskEntry = ensureTaskEntry(tracker, taskId);
  const signatureKey = blocker.signature;
  const existingEntry = taskEntry.signatures[signatureKey] ?? {
    signature: signatureKey,
    kind: blocker.kind,
    summary: blocker.summary,
    branch_slug: blocker.branch_slug,
    failed_commands: [],
    failing_spec_paths: [],
    missing_files: [],
    evidence_artifact_paths: [],
    repeat_count: 0,
    first_seen_at: now,
    last_seen_at: now,
    branched_to_task_id: null,
    branched_at: null,
  };

  existingEntry.kind = blocker.kind;
  existingEntry.summary = blocker.summary;
  existingEntry.branch_slug = blocker.branch_slug;
  existingEntry.failed_commands = unique([
    ...(existingEntry.failed_commands ?? []),
    ...(blocker.failed_commands ?? []),
  ]);
  existingEntry.failing_spec_paths = unique([
    ...(existingEntry.failing_spec_paths ?? []),
    ...(blocker.failing_spec_paths ?? []),
  ]).sort();
  existingEntry.missing_files = unique([
    ...(existingEntry.missing_files ?? []),
    ...(blocker.missing_files ?? []),
  ]).sort();
  existingEntry.evidence_artifact_paths = appendArtifactHistory(
    existingEntry.evidence_artifact_paths,
    blocker.evidence_artifact_paths ?? [],
  );
  existingEntry.repeat_count += 1;
  existingEntry.last_seen_at = now;
  if (blocker.stall_context) {
    existingEntry.stall_context = blocker.stall_context;
  }

  taskEntry.signatures[signatureKey] = existingEntry;
  taskEntry.last_signature = signatureKey;
  taskEntry.last_seen_at = now;
  tracker.updated_at = now;
  writeBlockerTracker(tracker);

  return {
    blocker: existingEntry,
    repeat_count: existingEntry.repeat_count,
    threshold_reached:
      existingEntry.repeat_count >= RCA_REPEAT_THRESHOLD && !existingEntry.branched_to_task_id,
  };
}
