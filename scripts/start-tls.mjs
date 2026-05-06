import { createServer } from "node:https";
import { readFile } from "node:fs/promises";
import next from "next";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || "3443");
const certFile = process.env.TLS_CERT_FILE;
const keyFile = process.env.TLS_KEY_FILE;
const caFile = process.env.TLS_CA_FILE;
const passphrase = process.env.TLS_KEY_PASSPHRASE;
const supportedLevels = new Set(["trace", "debug", "info", "warn", "error"]);
const logLevel = supportedLevels.has(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info";

if (!certFile || !keyFile) {
  console.error("TLS_CERT_FILE and TLS_KEY_FILE are required for npm run start:tls.");
  process.exit(1);
}

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`PORT must be a valid TCP port. Received: ${process.env.PORT}`);
  process.exit(1);
}

async function readTlsOptions() {
  return {
    cert: await readFile(certFile),
    key: await readFile(keyFile),
    ...(caFile ? { ca: await readFile(caFile) } : {}),
    ...(passphrase ? { passphrase } : {}),
  };
}

const app = next({ dev: false, hostname: host, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer(await readTlsOptions(), (request, response) => {
  void handle(request, response);
});

server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`MCP Mock Server HTTPS ready at https://${host}:${port}`);
  console.log(`LOG_LEVEL=${logLevel}`);
});

function shutdown(signal) {
  server.close(() => {
    console.log(`HTTPS server stopped after ${signal}.`);
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
