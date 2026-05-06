import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DATABASE_URL = "file:./data/runtime.sqlite";

function sqlitePathFromDatabaseUrl(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return null;
  if (databaseUrl.startsWith("file://")) return fileURLToPath(databaseUrl);
  return databaseUrl.slice("file:".length);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env: { ...process.env },
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function ensureSqliteFile(databaseUrl) {
  const sqlitePath = sqlitePathFromDatabaseUrl(databaseUrl);
  if (!sqlitePath) return;

  await mkdir(dirname(sqlitePath), { recursive: true });
  await writeFile(sqlitePath, "", { flag: "a" });
}

await ensureSqliteFile(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
await run("npx", ["prisma", "migrate", "deploy"]);
await run("npx", ["prisma", "generate"]);
await run("node", ["prisma/seed.mjs"]);

console.log("Prepared SQLite runtime state with Prisma migrations and seed defaults.");
