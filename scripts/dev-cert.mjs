import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const certDir = process.env.TLS_DEV_CERT_DIR || "certs";
const certFile = join(certDir, "localhost-cert.pem");
const keyFile = join(certDir, "localhost-key.pem");

if (existsSync(certFile) && existsSync(keyFile) && process.argv.includes("--keep-existing")) {
  console.log(`Keeping existing development certificate files in ${certDir}.`);
  console.log(`TLS_CERT_FILE=${certFile}`);
  console.log(`TLS_KEY_FILE=${keyFile}`);
  process.exit(0);
}

await mkdir(certDir, { recursive: true });

const configPath = join(tmpdir(), `mcp-mock-dev-cert-${Date.now()}.cnf`);
await writeFile(
  configPath,
  [
    "[req]",
    "prompt = no",
    "distinguished_name = dn",
    "x509_extensions = v3_req",
    "",
    "[dn]",
    "CN = localhost",
    "",
    "[v3_req]",
    "subjectAltName = @alt_names",
    "basicConstraints = CA:FALSE",
    "keyUsage = digitalSignature, keyEncipherment",
    "extendedKeyUsage = serverAuth",
    "",
    "[alt_names]",
    "DNS.1 = localhost",
    "IP.1 = 127.0.0.1",
  ].join("\n"),
);

const result = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-nodes",
    "-days",
    "30",
    "-keyout",
    keyFile,
    "-out",
    certFile,
    "-config",
    configPath,
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error("Failed to run openssl. Install OpenSSL or provide TLS_CERT_FILE and TLS_KEY_FILE manually.");
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Created 30-day localhost development certificate files in ${certDir}.`);
console.log(`TLS_CERT_FILE=${certFile}`);
console.log(`TLS_KEY_FILE=${keyFile}`);
