/* global Headers, Request */

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

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

function headersFromIncomingMessage(request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function bodyFromIncomingMessage(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

async function sendFetchResponse(fetchResponse, serverResponse) {
  for (const [key, value] of fetchResponse.headers) {
    serverResponse.setHeader(key, value);
  }
  serverResponse.statusCode = fetchResponse.status;
  const body = Buffer.from(await fetchResponse.arrayBuffer());
  serverResponse.end(body);
}

await run("npm", ["--prefix", "packages/mcp-runtime", "run", "build"]);

const { createMcpFetchHandler } = await import("../packages/mcp-runtime/dist/index.js");

const provider = {
  serverInfo: {
    name: "mcp-runtime-inspector-smoke",
    version: "0.0.0",
  },
  resources: {
    async list() {
      return {
        items: [
          {
            uri: "minakeep://articles/note/welcome",
            name: "welcome",
            title: "Welcome note",
            mimeType: "text/markdown",
          },
        ],
      };
    },
    async read({ uri }) {
      if (uri !== "minakeep://articles/note/welcome") {
        return { kind: "not_found", message: "Resource not found." };
      }

      return {
        kind: "success",
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: "# Welcome\n\nInspector smoke content.",
          },
        ],
      };
    },
    templates: {
      async list() {
        return {
          items: [
            {
              uriTemplate: "minakeep://articles/note/{slug}",
              name: "article-note-by-slug",
              title: "Article note by slug",
              mimeType: "text/markdown",
            },
          ],
        };
      },
    },
  },
};

const handler = createMcpFetchHandler(provider, {
  cors: {
    allowedOrigins: ["http://localhost:6274"],
  },
});

const server = createServer(async (request, response) => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const body = await bodyFromIncomingMessage(request);
    const fetchRequest = new Request(new URL(request.url ?? "/", baseUrl), {
      method: request.method,
      headers: headersFromIncomingMessage(request),
      ...(body ? { body, duplex: "half" } : {}),
    });
    const fetchResponse = await handler(fetchRequest);
    await sendFetchResponse(fetchResponse, response);
  } catch {
    response.statusCode = 500;
    response.end("Internal test server error");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const endpoint = `http://127.0.0.1:${port}/mcp`;

async function runInspector(method, extraArgs = []) {
  const { stdout } = await run("npx", [
    "-y",
    "@modelcontextprotocol/inspector@0.21.2",
    "--cli",
    endpoint,
    "--transport",
    "http",
    "--method",
    method,
    ...extraArgs,
  ]);
  return JSON.parse(stdout);
}

try {
  const listed = await runInspector("resources/list");
  const templates = await runInspector("resources/templates/list");
  const read = await runInspector("resources/read", ["--uri", "minakeep://articles/note/welcome"]);

  if (!listed.resources?.some((resource) => resource.uri === "minakeep://articles/note/welcome")) {
    throw new Error("resources/list did not return the expected smoke resource.");
  }
  if (!templates.resourceTemplates?.some((template) => template.uriTemplate === "minakeep://articles/note/{slug}")) {
    throw new Error("resources/templates/list did not return the expected smoke template.");
  }
  if (!read.contents?.some((content) => content.uri === "minakeep://articles/note/welcome")) {
    throw new Error("resources/read did not return the expected smoke content.");
  }

  console.log(`Verified Inspector CLI resources smoke against ${endpoint}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
