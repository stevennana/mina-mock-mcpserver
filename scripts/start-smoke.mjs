import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const port = process.env.PORT || "3100";
const healthUrl = `http://127.0.0.1:${port}/api/health`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const body = await response.json();
        if (body.status === "ok") {
          return;
        }
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError ?? new Error(`Timed out waiting for ${healthUrl}`);
}

await run("npm", ["run", "db:prepare"]);

if (!existsSync(".next/BUILD_ID")) {
  await run("npm", ["run", "build"]);
}

const server = spawn("npx", ["next", "start", "--port", port], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, LOG_LEVEL: process.env.LOG_LEVEL || "info" },
});

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitForHealth();
  console.log(`Production-style startup smoke passed at ${healthUrl}`);
} finally {
  server.kill("SIGTERM");
}
