import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const packageDir = path.join(repoRoot, "packages", "mcp-runtime");
const tscBin = path.join(repoRoot, "node_modules", ".bin", "tsc");

async function run(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024 * 10,
      ...options,
    });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }
}

await run("npm", ["run", "build"], { cwd: packageDir });

const { stdout } = await run("npm", ["pack", "--silent"], { cwd: packageDir });
const tarballName = stdout.trim().split(/\s+/).at(-1);
if (!tarballName) {
  throw new Error("npm pack did not report a tarball name.");
}

const tarballPath = path.join(packageDir, tarballName);
const tempDir = await mkdtemp(path.join(tmpdir(), "mcp-runtime-consumer-"));

try {
  await mkdir(path.join(tempDir, "src"), { recursive: true });
  await writeFile(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "mcp-runtime-consumer-smoke",
        version: "0.0.0",
        type: "module",
        private: true,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(tempDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          lib: ["ES2022", "DOM"],
          skipLibCheck: false,
          types: [],
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(tempDir, "src", "index.ts"),
    `import {
  createMcpCorsHeaders,
  createMcpFetchHandler,
  handleMcpJsonRpcMessage,
  type McpRuntimeProvider,
} from "@minasoft/mcp-runtime";

const provider: McpRuntimeProvider = {
  serverInfo: { name: "consumer-smoke", version: "0.0.0" },
  resources: {
    async list() {
      return {
        items: [
          {
            uri: "published://article/welcome",
            name: "welcome",
            title: "Welcome",
            mimeType: "text/markdown",
          },
        ],
      };
    },
    async read({ uri }) {
      if (uri !== "published://article/welcome") {
        return { kind: "not_found", message: "Resource not found." };
      }

      return {
        kind: "success",
        contents: [{ uri, mimeType: "text/markdown", text: "# Welcome" }],
      };
    },
  },
};

const corsHeaders = createMcpCorsHeaders(
  { allowedOrigins: ["http://localhost:6274"] },
  new Request("https://consumer.example.test/api/mcp", {
    headers: { origin: "http://localhost:6274" },
  }),
);

if (corsHeaders.get("access-control-allow-origin") !== "http://localhost:6274") {
  throw new Error("Expected Inspector-compatible CORS helper headers.");
}

const direct = await handleMcpJsonRpcMessage(
  {
    jsonrpc: "2.0",
    id: "resources-list",
    method: "resources/list",
    params: {},
  },
  provider,
  { context: { principal: "user-1" } },
);

if (!("result" in direct)) {
  throw new Error("Expected resources/list result.");
}

const handler = createMcpFetchHandler(provider);
const response = await handler(
  new Request("https://consumer.example.test/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "resources-read",
      method: "resources/read",
      params: { uri: "published://article/welcome" },
    }),
  }),
);

const body: unknown = await response.json();
if (!body || typeof body !== "object" || !("result" in body)) {
  throw new Error("Expected resources/read JSON-RPC result.");
}
`,
  );

  await run("npm", ["install", "--silent", tarballPath], { cwd: tempDir });
  await run(tscBin, ["-p", path.join(tempDir, "tsconfig.json"), "--noEmit"], {
    cwd: tempDir,
  });
  console.log(`Verified @minasoft/mcp-runtime external consumer install in ${tempDir}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
  await rm(tarballPath, { force: true });
}
