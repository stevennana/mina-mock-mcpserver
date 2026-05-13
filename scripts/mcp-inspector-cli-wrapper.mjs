#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preload = path.join(repoRoot, "scripts", "inspector-loopback-preload.mjs");
const nodeOptions = [process.env.NODE_OPTIONS, "--import", preload].filter(Boolean).join(" ");

function packageVersionFor(cliPath) {
  const packageJsonPath = path.resolve(cliPath, "..", "..", "..", "package.json");
  if (!existsSync(packageJsonPath)) return null;
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.version ?? null;
  } catch {
    return null;
  }
}

function cachedInspectorCliCandidates() {
  const npxRoot = path.join(homedir(), ".npm", "_npx");
  if (!existsSync(npxRoot)) return [];

  return readdirSync(npxRoot)
    .map((entry) =>
      path.join(npxRoot, entry, "node_modules", "@modelcontextprotocol", "inspector", "cli", "build", "cli.js"),
    )
    .filter((candidate) => existsSync(candidate) && packageVersionFor(candidate) === "0.21.2")
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
}

function resolveRealInspectorCli() {
  if (process.env.REAL_MCP_INSPECTOR_CLI && existsSync(process.env.REAL_MCP_INSPECTOR_CLI)) {
    return realpathSync(process.env.REAL_MCP_INSPECTOR_CLI);
  }

  const localPackageCli = path.join(
    repoRoot,
    "node_modules",
    "@modelcontextprotocol",
    "inspector",
    "cli",
    "build",
    "cli.js",
  );
  if (existsSync(localPackageCli) && packageVersionFor(localPackageCli) === "0.21.2") {
    return realpathSync(localPackageCli);
  }

  const [cachedCli] = cachedInspectorCliCandidates();
  if (cachedCli) return realpathSync(cachedCli);

  throw new Error("Cached @modelcontextprotocol/inspector@0.21.2 CLI was not found.");
}

const realInspectorCli = resolveRealInspectorCli();
const result = spawnSync(process.execPath, [realInspectorCli, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
