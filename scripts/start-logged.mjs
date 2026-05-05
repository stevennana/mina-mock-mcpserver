import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

await mkdir("logs", { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = `logs/server-${stamp}.log`;
const log = createWriteStream(logPath, { flags: "a" });
const port = process.env.PORT || "3100";
const supportedLevels = new Set(["trace", "debug", "info", "warn", "error"]);
const level = supportedLevels.has(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info";

function writeLine(line) {
  const output = `${line}\n`;
  process.stdout.write(output);
  log.write(output);
}

writeLine(`Writing server logs to ${logPath}`);
writeLine(`Starting Next.js on port ${port} with LOG_LEVEL=${level}`);

const child = spawn("npx", ["next", "start", "--hostname", process.env.HOST || "127.0.0.1", "--port", port], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, LOG_LEVEL: level },
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    process.stdout.write(chunk);
    log.write(chunk);
  });
}

child.on("exit", (code) => {
  log.end();
  process.exitCode = code ?? 0;
});
