import path from "node:path";
import {
  GENERATED_DIR,
  extractSection,
  findTaskDoc,
  readCurrentTaskId,
  readText,
  writeText,
  fileExists,
} from "./lib/task-utils.mjs";

const taskId = readCurrentTaskId();
if (!taskId || taskId === "NONE") {
  throw new Error("No current task is configured.");
}

const task = findTaskDoc(taskId);
if (!task) {
  throw new Error(`Active task '${taskId}' not found.`);
}

const deterministicPath = path.join(process.cwd(), "state", "deterministic-checks.json");
const deterministic = fileExists(deterministicPath) ? readText(deterministicPath) : "{}";
const lastResultPath = path.join(process.cwd(), "state", "last-result.txt");
const lastResult = fileExists(lastResultPath) ? readText(lastResultPath) : "";

const objective = extractSection(task.markdown, "Objective");
const scope = extractSection(task.markdown, "Scope");
const outOfScope = extractSection(task.markdown, "Out of scope");
const exitCriteria = extractSection(task.markdown, "Exit criteria");
const evaluatorNotes = extractSection(task.markdown, "Evaluator notes");

const docsToRead = Array.from(new Set(task.meta.prompt_docs ?? []));

const prompt = `
You are the promotion evaluator for a repository-local Ralph loop.

Read these documents before deciding:
${docsToRead.map((doc) => `- ${doc}`).join("\n")}
- ${task.filePath.replace(`${process.cwd()}/`, "")}

Current task id: ${task.id}
Current task title: ${task.meta.title}

Objective:
${objective}

Scope:
${scope}

Out of scope:
${outOfScope}

Exit criteria:
${exitCriteria}

Evaluator notes:
${evaluatorNotes}

Deterministic check summary:
${deterministic}

Worker handoff summary from the last run:
${lastResult || "(empty)"}

Your job:
- inspect the repository and current implementation
- determine whether the current task is actually complete
- mark \`done\` only if the exit criteria are satisfied in substance, not just approximately
- prefer conservative decisions
- recommend promotion only if the task is truly ready

Return JSON only using the provided schema.
`.trim();

const outputPath = path.join(GENERATED_DIR, "current-evaluator-prompt.txt");
writeText(outputPath, `${prompt}\n`);
console.log(outputPath);
