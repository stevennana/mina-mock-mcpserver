import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

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

await mkdir("data", { recursive: true });
await run("npx", ["prisma", "migrate", "deploy"]);
await run("npx", ["prisma", "generate"]);
await run("node", ["prisma/seed.mjs"]);

console.log("Prepared SQLite runtime state with Prisma migrations and endpoint seed defaults.");
