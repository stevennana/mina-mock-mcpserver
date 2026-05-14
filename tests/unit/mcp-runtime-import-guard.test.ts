import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const scanRoots = ["app", "lib", "tests"];
const ignoredFiles = new Set(["lib/mcp/protocol.ts", "lib/mcp/types.ts"]);
const forbiddenImportPattern = /from\s+["']@\/lib\/mcp\/(?:protocol|types)["']|import\s*\(\s*["']@\/lib\/mcp\/(?:protocol|types)["']\s*\)/;

async function tsFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return tsFiles(path);
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) return [path];
      return [];
    }),
  );
  return files.flat();
}

test("active app and test code imports MCP runtime package instead of old app-local protocol modules", async () => {
  const files = (await Promise.all(scanRoots.map(tsFiles))).flat();
  const offenders: string[] = [];

  for (const file of files) {
    const path = relative(process.cwd(), file);
    if (ignoredFiles.has(path)) continue;
    const source = await readFile(file, "utf8");
    if (forbiddenImportPattern.test(source)) offenders.push(path);
  }

  assert.deepEqual(offenders, []);
});
