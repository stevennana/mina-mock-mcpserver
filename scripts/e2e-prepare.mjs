import { access, copyFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const runtimeDbPath = "data/runtime.sqlite";
const e2eDbPath = "data/e2e-runtime.sqlite";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...options.env },
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

async function ensureRuntimeTemplate() {
  try {
    await access(runtimeDbPath);
  } catch {
    const envWithoutDatabaseUrl = { ...process.env };
    delete envWithoutDatabaseUrl.DATABASE_URL;
    await run("npm", ["run", "db:prepare"], { env: envWithoutDatabaseUrl });
  }
}

await mkdir("data", { recursive: true });
await ensureRuntimeTemplate();
await copyFile(runtimeDbPath, e2eDbPath);

process.env.DATABASE_URL = "file:./data/e2e-runtime.sqlite";

const { createPrismaClient } = await import("../lib/db/client.ts");
const { seedAllDefaults } = await import("../lib/db/seed.ts");

const client = createPrismaClient();

try {
  await client.$transaction(async (tx) => {
    await tx.oAuthIssuedToken.deleteMany({});
    await tx.oAuthAuthorizationCode.deleteMany({});
    await tx.oAuthClient.deleteMany({});
    await tx.oAuthUser.deleteMany({});
    await tx.basicUser.deleteMany({});
    await tx.auditEvent.deleteMany({});
    await tx.serverSetting.deleteMany({});
    await tx.responseCase.deleteMany({});
    await tx.endpointParam.deleteMany({});
    await tx.endpoint.deleteMany({});

    await seedAllDefaults(tx);
  });
  console.log("Prepared isolated Playwright E2E SQLite state.");
} finally {
  await client.$disconnect();
}
