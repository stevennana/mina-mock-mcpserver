import fs from "node:fs";
import path from "node:path";
import {
  getLatestBlockerEntry,
  markBlockerBranched,
} from "./lib/blocker-utils.mjs";
import {
  ACTIVE_TASK_DIR,
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

function appendDebtItem(filePath, line) {
  if (!fileExists(filePath)) {
    return;
  }

  const markdown = readText(filePath);
  if (markdown.includes(line)) {
    return;
  }

  const marker = "## Current Debt";
  const next = markdown.includes(marker)
    ? markdown.replace(marker, `${marker}\n\n- ${line}`)
    : `${markdown.trim()}\n\n## Current Debt\n\n- ${line}\n`;
  writeText(filePath, next);
}

function buildRcaTitle(task) {
  return `RCA: ${task.meta.title} blocker`;
}

function buildRcaTaskMarkdown(task, blocker, rcaTaskId) {
  const createdAt = timestamp();
  const relativeTaskPath = path.relative(process.cwd(), task.filePath);
  const title = buildRcaTitle(task);
  const order =
    typeof task.meta.order === "number" ? Number(task.meta.order) + 0.01 : Number.MAX_SAFE_INTEGER;
  const requiredCommands =
    blocker.failed_commands?.length > 0
      ? blocker.failed_commands
      : Array.isArray(task.meta.required_commands) && task.meta.required_commands.length > 0
        ? task.meta.required_commands
        : ["npm run verify"];
  const promptDocs = Array.from(
    new Set(["AGENTS.md", "docs/PLANS.md", relativeTaskPath, ...(task.meta.prompt_docs ?? [])]),
  );
  const scopeLines = [
    "- isolate the repeated blocker signature without broadening back into the parent feature",
    blocker.failed_commands?.length
      ? `- restore the failing required command path: ${blocker.failed_commands.join(", ")}`
      : "- determine why the worker stalls before the parent task can complete its checks",
    "- update the parent task log and blocker evidence so the return path is explicit",
  ];
  const outOfScopeLines = [
    `- new product scope beyond ${task.id}`,
    `- unrelated cleanup outside the blocker signature \`${blocker.signature}\``,
    "- manual queue edits that bypass the normal promotion return path",
  ];
  const exitCriteriaLines = [
    "1. The repeated blocker is reproduced or conclusively explained with concrete evidence.",
    blocker.failed_commands?.length
      ? `2. ${requiredCommands.join(" and ")} pass without the blocker signature recurring.`
      : "2. The stalled worker path is resolved or replaced with a deterministic proof of forward progress.",
    `3. The RCA task can promote back to \`${task.id}\` without manual queue surgery.`,
    `4. The parent task log records the blocker resolution before work returns to \`${task.id}\`.`,
  ];
  const humanReviewTriggers = blocker.failed_commands?.length
    ? [
        "The fix broadens into unrelated product work instead of isolating the blocker.",
        "The failing command changed without proof that the original blocker is resolved.",
      ]
    : [
        "The RCA task declares success without explaining the stall evidence.",
        "The fix changes broad task orchestration instead of addressing the repeated stall.",
      ];

  const taskMeta = {
    id: rcaTaskId,
    title,
    order,
    status: "active",
    promotion_mode: "standard",
    next_task_on_success: task.id,
    prompt_docs: promptDocs,
    required_commands: requiredCommands,
    required_files: [],
    human_review_triggers: humanReviewTriggers,
    rca_for_task_id: task.id,
    blocker_signature: blocker.signature,
    blocker_kind: blocker.kind,
    blocker_summary: blocker.summary,
  };

  return `# ${title}

\`\`\`json taskmeta
${JSON.stringify(taskMeta, null, 2)}
\`\`\`

## Objective

Resolve the repeated blocker that is preventing \`${task.id}\` from promoting, then return the queue to the parent task automatically.

## Scope

${scopeLines.join("\n")}

## Out of scope

${outOfScopeLines.join("\n")}

## Exit criteria

${exitCriteriaLines.join("\n")}

## Required checks

${requiredCommands.map((command) => `- \`${command}\``).join("\n")}

## Evaluator notes

Promote only when the blocker-specific evidence is explicit and the queue can safely return to \`${task.id}\`.

## Blocker evidence

- Parent task: \`${task.id}\`
- Blocker kind: \`${blocker.kind}\`
- Blocker summary: ${blocker.summary}
- Blocker signature: \`${blocker.signature}\`
${(blocker.failing_spec_paths ?? []).map((item) => `- Related path: \`${item}\``).join("\n") || "- Related path: none captured"}
${(blocker.evidence_artifact_paths ?? []).map((item) => `- Artifact: \`${item}\``).join("\n") || "- Artifact: none captured"}

## Progress log

- ${createdAt}: Auto-generated RCA/fix plan for repeated blocker \`${blocker.signature}\` while working on \`${task.id}\`.
`;
}

const currentTaskId = readCurrentTaskId();
if (!currentTaskId || currentTaskId === "NONE") {
  throw new Error("No active task configured.");
}

const task = findTaskDoc(currentTaskId);
if (!task) {
  throw new Error(`Task '${currentTaskId}' not found.`);
}

const blocker = getLatestBlockerEntry(task.id);
if (!blocker) {
  throw new Error(`No tracked blocker exists for task '${task.id}'.`);
}

if (blocker.branched_to_task_id) {
  writeCurrentTaskId(blocker.branched_to_task_id);
  console.log(
    JSON.stringify({
      branched: false,
      task_id: task.id,
      rca_task_id: blocker.branched_to_task_id,
      reason: "existing-branch-reused",
    }),
  );
  process.exit(0);
}

const rcaTaskId = normalizeTaskId(`${task.id}-rca-${blocker.branch_slug}`);
const rcaTaskPath = path.join(ACTIVE_TASK_DIR, `${rcaTaskId}.md`);
ensureDir(ACTIVE_TASK_DIR);

if (!fileExists(rcaTaskPath)) {
  writeText(rcaTaskPath, buildRcaTaskMarkdown(task, blocker, rcaTaskId));
}

const blockedMeta = {
  ...task.meta,
  status: "blocked",
  blocked_by_task_id: rcaTaskId,
  blocker_signature: blocker.signature,
  blocked_at: timestamp(),
};

let nextTaskMarkdown = replaceTaskMeta(task.markdown, blockedMeta);
nextTaskMarkdown = appendTaskProgressNote(
  nextTaskMarkdown,
  `${timestamp()}: repeated blocker \`${blocker.signature}\` auto-branched into \`${rcaTaskId}\`. Summary: ${blocker.summary}`,
);
writeText(task.filePath, nextTaskMarkdown);

appendDebtItem(
  path.join(process.cwd(), "docs", "exec-plans", "tech-debt-tracker.md"),
  `${timestamp()}: ${task.id} auto-branched to \`${rcaTaskId}\` after repeated blocker \`${blocker.signature}\` (${blocker.summary}).`,
);

writeCurrentTaskId(rcaTaskId);
markBlockerBranched(task.id, blocker.signature, rcaTaskId);

const historyPath = path.join(process.cwd(), "state", "task-history.md");
fs.appendFileSync(
  historyPath,
  `- ${timestamp()}: branched ${task.id} -> ${rcaTaskId} | blocker=${blocker.signature}\n`,
  "utf8",
);

console.log(
  JSON.stringify({
    branched: true,
    task_id: task.id,
    rca_task_id: rcaTaskId,
    blocker_signature: blocker.signature,
    blocker_summary: blocker.summary,
  }),
);
