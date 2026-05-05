import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function taskDoc(meta: Record<string, unknown>) {
  return [
    "# Task",
    "",
    "```json taskmeta",
    JSON.stringify(meta, null, 2),
    "```",
    "",
    "## Progress log",
    "",
    "- Start here.",
    "",
  ].join("\n");
}

test("Ralph promotion resolves ordered successor filenames by taskmeta id", async () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "ralph-promote-"));
  const repoRoot = process.cwd();

  try {
    await mkdir(path.join(tempRoot, "docs/exec-plans/active"), { recursive: true });
    await mkdir(path.join(tempRoot, "docs/exec-plans/completed"), { recursive: true });
    await mkdir(path.join(tempRoot, "state"), { recursive: true });

    writeFileSync(
      path.join(tempRoot, "docs/exec-plans/active/001-current-task.md"),
      taskDoc({
        id: "current-task",
        title: "Current task",
        order: 1,
        status: "active",
        next_task_on_success: "next-task",
      }),
    );
    writeFileSync(
      path.join(tempRoot, "docs/exec-plans/active/002-next-task.md"),
      taskDoc({
        id: "next-task",
        title: "Next task",
        order: 2,
        status: "queued",
        next_task_on_success: null,
      }),
    );
    writeFileSync(path.join(tempRoot, "state/current-task.txt"), "current-task\n");
    writeFileSync(
      path.join(tempRoot, "state/evaluation.json"),
      JSON.stringify({ task_id: "current-task", promotion_eligible: true }, null, 2),
    );
    writeFileSync(path.join(tempRoot, "state/task-history.md"), "# Task History\n\n");
    writeFileSync(path.join(tempRoot, "state/blocker-tracker.json"), JSON.stringify({ tasks: {} }, null, 2));

    execFileSync("node", [path.join(repoRoot, "scripts/ralph/promote-task.mjs")], {
      cwd: tempRoot,
      stdio: "pipe",
    });

    assert.equal(readFileSync(path.join(tempRoot, "state/current-task.txt"), "utf8").trim(), "next-task");
    assert.match(
      readFileSync(path.join(tempRoot, "docs/exec-plans/active/002-next-task.md"), "utf8"),
      /"status": "active"/,
    );
    assert.match(
      readFileSync(path.join(tempRoot, "docs/exec-plans/completed/001-current-task.md"), "utf8"),
      /"status": "completed"/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
