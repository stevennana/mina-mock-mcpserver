import path from "node:path";
import {
  deriveEvaluationBlocker,
  deriveStallBlocker,
  recordBlockerOccurrence,
} from "./lib/blocker-utils.mjs";
import { readCurrentTaskId, readText, safeJsonParse } from "./lib/task-utils.mjs";

function parseArgs(argv) {
  const parsed = {
    kind: "",
    artifact: "",
    workerLog: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--kind") {
      parsed.kind = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--artifact") {
      parsed.artifact = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--worker-log") {
      parsed.workerLog = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

const options = parseArgs(process.argv.slice(2));
const taskId = readCurrentTaskId();
if (!taskId || taskId === "NONE") {
  console.log(JSON.stringify({ recorded: false, reason: "no-active-task" }));
  process.exit(0);
}

let blocker = null;
if (options.kind === "evaluation") {
  const evaluationPath = path.join(process.cwd(), "state", "evaluation.json");
  const evaluation = safeJsonParse(readText(evaluationPath), null);
  blocker = deriveEvaluationBlocker(taskId, evaluation);
} else if (options.kind === "stall") {
  blocker = deriveStallBlocker(taskId, options.artifact, options.workerLog);
} else {
  throw new Error(`Unsupported blocker kind: ${options.kind}`);
}

if (!blocker) {
  console.log(JSON.stringify({ recorded: false, reason: "no-blocker-derived" }));
  process.exit(0);
}

const recorded = recordBlockerOccurrence(taskId, blocker);
console.log(
  JSON.stringify({
    recorded: true,
    task_id: taskId,
    kind: blocker.kind,
    signature: blocker.signature,
    summary: blocker.summary,
    repeat_count: recorded.repeat_count,
    threshold_reached: recorded.threshold_reached,
  }),
);
