import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fetchWithTls } from "./lib/fetch-with-tls.mjs";

const port = process.env.TLS_SMOKE_PORT || "3443";
const host = process.env.HOST || "127.0.0.1";
const baseUrl = `https://${host}:${port}`;
const certFile = process.env.TLS_CERT_FILE || "certs/localhost-cert.pem";
const keyFile = process.env.TLS_KEY_FILE || "certs/localhost-key.pem";

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
      const response = await fetchWithTls(`${baseUrl}/api/health`, {}, { insecureTls: true });
      if (response.ok) {
        const body = JSON.parse(await response.text());
        if (body.status === "ok") {
          return;
        }
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError ?? new Error(`Timed out waiting for ${baseUrl}/api/health`);
}

async function readPublicConfig() {
  const response = await fetchWithTls(`${baseUrl}/api/config`, {}, { insecureTls: true });
  if (!response.ok) {
    throw new Error(`Config check failed with HTTP ${response.status}.`);
  }
  return JSON.parse(await response.text());
}

if (!existsSync(certFile) || !existsSync(keyFile)) {
  await run("npm", ["run", "cert:dev"]);
}

await run("npm", ["run", "db:prepare"]);

if (!existsSync(".next/BUILD_ID")) {
  await run("npm", ["run", "build"]);
}

const server = spawn("npm", ["run", "start:tls"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    HOST: host,
    PORT: port,
    APP_BASE_URL: baseUrl,
    TLS_CERT_FILE: certFile,
    TLS_KEY_FILE: keyFile,
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
  },
});

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitForHealth();
  const config = await readPublicConfig();
  if (config.baseUrl?.baseUrl !== baseUrl) {
    throw new Error(`Expected base URL ${baseUrl}, got ${config.baseUrl?.baseUrl ?? "missing"}.`);
  }
  if (config.tls?.enabled !== true || config.tls?.mode !== "app_https") {
    throw new Error("Public config did not report app HTTPS TLS mode.");
  }
  console.log(`TLS startup smoke passed at ${baseUrl}/api/health`);
} finally {
  server.kill("SIGTERM");
}
