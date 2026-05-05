import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import {
  GENERATED_DIR,
  STATE_DIR,
  ensureDir,
  findTaskDoc,
  readCurrentTaskId,
  readText,
  safeJsonParse,
  timestamp,
  writeText,
  fileExists,
} from "./lib/task-utils.mjs";

function slugifyCommand(command) {
  return command
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "command";
}

function getCurrentCycleArtifactDir() {
  const cyclePath = path.join(STATE_DIR, "current-cycle.json");
  if (!fileExists(cyclePath)) {
    return null;
  }

  const cycle = safeJsonParse(readText(cyclePath), null);
  return typeof cycle?.artifact_dir === "string" ? cycle.artifact_dir : null;
}

function commandNeedsE2ePortCleanup(command) {
  return /playwright|test:e2e/.test(command) || command.includes("npm run verify");
}

function ensureE2ePortIsFree(command) {
  if (!commandNeedsE2ePortCleanup(command)) {
    return null;
  }

  const cleanup = spawnSync(
    path.join("scripts", "ralph", "ensure-e2e-port-free.sh"),
    ["3100"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return {
    command: "ensure-e2e-port-free.sh 3100",
    error: cleanup.stderr ?? "",
    ok: cleanup.status === 0,
    output: cleanup.stdout ?? "",
  };
}

function buildCommandEnvironment(command) {
  if (!commandNeedsE2ePortCleanup(command)) {
    return null;
  }

  const artifactDir = getCurrentCycleArtifactDir();
  const nextServerLogPath = artifactDir
    ? path.join(process.cwd(), artifactDir, `${slugifyCommand(command)}-next-server.log`)
    : path.join(STATE_DIR, `${slugifyCommand(command)}-next-server.log`);

  return {
    nextServerLogPath,
    value: {
      ...process.env,
      MINAKEEP_NEXT_SERVER_LOG: nextServerLogPath,
    },
  };
}

function runShellCommand(command) {
  const preflight = ensureE2ePortIsFree(command);
  const commandEnvironment = buildCommandEnvironment(command);
  if (preflight && !preflight.ok) {
    return {
      command,
      ok: false,
      output: preflight.output,
      error:
        preflight.error ||
        "Failed to clear the Playwright web server port before running verification.",
      preflight,
      ...(commandEnvironment
        ? { next_server_log_path: commandEnvironment.nextServerLogPath }
        : {}),
    };
  }

  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf8",
      ...(commandEnvironment ? { env: commandEnvironment.value } : {}),
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      command,
      ok: true,
      output,
      ...(preflight ? { preflight } : {}),
      ...(commandEnvironment
        ? { next_server_log_path: commandEnvironment.nextServerLogPath }
        : {}),
    };
  } catch (error) {
    return {
      command,
      ok: false,
      output: error.stdout?.toString?.() ?? "",
      error: error.stderr?.toString?.() ?? error.message,
      ...(preflight ? { preflight } : {}),
      ...(commandEnvironment
        ? { next_server_log_path: commandEnvironment.nextServerLogPath }
        : {}),
    };
  }
}

function usesDeterministicOnlyPromotion(taskMeta) {
  return String(taskMeta?.promotion_mode ?? "").trim().toLowerCase() === "deterministic_only";
}

ensureDir(STATE_DIR);
ensureDir(GENERATED_DIR);

const taskId = readCurrentTaskId();
if (!taskId || taskId === "NONE") {
  writeText(
    path.join(STATE_DIR, "evaluation.json"),
    JSON.stringify({ status: "blocked", reason: "No active task configured." }, null, 2),
  );
  process.exit(0);
}

const task = findTaskDoc(taskId);
if (!task) {
  writeText(
    path.join(STATE_DIR, "evaluation.json"),
    JSON.stringify({ status: "blocked", reason: `Task '${taskId}' not found.` }, null, 2),
  );
  process.exit(0);
}

const commandResults = [];
for (const command of task.meta.required_commands ?? ["npm run verify"]) {
  commandResults.push(runShellCommand(command));
}

const missingFiles = [];
for (const relativePath of task.meta.required_files ?? []) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fileExists(absolutePath)) {
    missingFiles.push(relativePath);
  }
}

const deterministic = {
  checked_at: timestamp(),
  task_id: task.id,
  commands: commandResults,
  missing_files: missingFiles,
  pass: commandResults.every((result) => result.ok) && missingFiles.length === 0,
};

writeText(path.join(STATE_DIR, "deterministic-checks.json"), JSON.stringify(deterministic, null, 2));

if (!deterministic.pass) {
  const finalResult = {
    checked_at: timestamp(),
    task_id: task.id,
    status: "not_done",
    promotion_eligible: false,
    deterministic,
    llm: null,
    summary: "Deterministic checks failed; task is not ready for promotion.",
    missing_requirements: [
      ...missingFiles.map((file) => `Missing required file: ${file}`),
      ...commandResults.filter((r) => !r.ok).map((r) => `Failed required command: ${r.command}`),
    ],
  };
  writeText(path.join(STATE_DIR, "evaluation.json"), JSON.stringify(finalResult, null, 2));
  console.log(`evaluation: ${finalResult.status} promotion=${finalResult.promotion_eligible}`);
  process.exit(0);
}

if (usesDeterministicOnlyPromotion(task.meta)) {
  const finalResult = {
    checked_at: timestamp(),
    task_id: task.id,
    status: "done",
    promotion_eligible: true,
    deterministic,
    llm: null,
    summary: "Deterministic checks passed; task is eligible for automatic promotion.",
    missing_requirements: [],
  };
  writeText(path.join(STATE_DIR, "evaluation.json"), JSON.stringify(finalResult, null, 2));
  console.log(`evaluation: ${finalResult.status} promotion=${finalResult.promotion_eligible}`);
  process.exit(0);
}

spawnSync("node", [path.join("scripts", "ralph", "render-evaluator-prompt.mjs")], {
  cwd: process.cwd(),
  stdio: "inherit",
});

const evaluatorPromptPath = path.join(GENERATED_DIR, "current-evaluator-prompt.txt");
const schemaPath = path.join(process.cwd(), "scripts", "ralph", "schemas", "task-evaluation.schema.json");
const llmOutputPath = path.join(STATE_DIR, "evaluation.llm.json");
const evaluatorPrompt = readText(evaluatorPromptPath);

const codexArgs = [
    "exec",
    "--sandbox",
    "read-only",
    "--output-schema",
    schemaPath,
    "-o",
    llmOutputPath,
    evaluatorPrompt,
];


const evaluatorRun = spawnSync("codex", codexArgs, {
  cwd: process.cwd(),
  stdio: "inherit",
  encoding: "utf8",
});

let llm = null;
if (evaluatorRun.status === 0 && fileExists(llmOutputPath)) {
  llm = safeJsonParse(readText(llmOutputPath), null);
}

const finalStatus =
  llm?.decision === "done" && llm?.recommend_promotion === true ? "done" :
  llm?.decision === "blocked" ? "blocked" :
  "not_done";

const finalResult = {
  checked_at: timestamp(),
  task_id: task.id,
  status: finalStatus,
  promotion_eligible: finalStatus === "done",
  deterministic,
  llm,
  summary:
    llm?.summary ??
    (finalStatus === "done"
      ? "Task eligible for promotion."
      : "Task remains active after evaluator review."),
};

writeText(path.join(STATE_DIR, "evaluation.json"), JSON.stringify(finalResult, null, 2));
console.log(`evaluation: ${finalResult.status} promotion=${finalResult.promotion_eligible}`);
