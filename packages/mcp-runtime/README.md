# @minasoft/mcp-runtime

Framework-light MCP JSON-RPC runtime helpers for TypeScript applications that
already own their HTTP routes, auth, storage, and permissions.

This package is not a replacement for the official MCP TypeScript SDK. It is a
small runtime boundary for product backends that want to expose existing app
data as MCP resources, tools, prompts, or completion without adopting a full MCP
server framework or moving auth and routing out of the host app.

Use this package when an app already owns its HTTP route, auth, storage, and product model, but wants a reusable MCP server runtime for:

- `initialize`
- `tools/list` and `tools/call` when tools are supplied
- `resources/list`, `resources/read`, and `resources/templates/list`
- `resources/subscribe` and `resources/unsubscribe` when subscriptions are supplied
- `prompts/list` and `prompts/get`
- `completion/complete`
- provider-derived capability advertisement
- MCP/JSON-RPC error envelopes and pagination response shapes
- an optional Fetch `Request` / `Response` adapter

This package intentionally does not include MCP Mock Server admin screens, endpoint catalogs, OAuth UI, Prisma models, seed data, audit logs, SSE session storage, or fixture CRUD.

## Why Use This Runtime?

Use `@minasoft/mcp-runtime` when you want:

- a provider interface that maps existing app records, commands, and workflows to MCP objects
- host-owned Bearer, Basic, session, tenant, or custom auth
- Next.js App Router or Fetch-compatible route integration
- MCP JSON-RPC envelopes, `initialize`, capabilities, resources, tools, prompts, completion, pagination, and standard errors handled for you
- opt-in browser Inspector CORS helpers without opening CORS by default
- sanitized provider exceptions so private app errors do not leak to MCP clients
- a package that stays independent from React, Next.js, Prisma, SQLite, and Mock Server admin UI modules

Prefer the official MCP SDK when you need a broad SDK with client APIs, richer
transport abstractions, or the canonical first-stop implementation for new MCP
servers. Prefer this runtime when the server is already an application route and
MCP should be a thin protocol layer over that app.

## Provider Families

The runtime supports three MCP feature families. You can implement one, two, or
all three in the same provider.

| Family | Use it for | Runtime methods |
|---|---|---|
| Resources | Existing product data that clients can read, such as articles, files, records, docs, or templates | `resources/list`, `resources/read`, `resources/templates/list`, optional resource subscriptions |
| Tools | Product actions that clients can invoke, such as search, validation, sync, ticket creation, or calculations | `tools/list`, `tools/call` |
| Prompts | Reusable workflows and prompt templates backed by app data, plus argument completion | `prompts/list`, `prompts/get`, `completion/complete` |

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

export const provider: McpRuntimeProvider = {
  serverInfo: { name: "product-mcp", version: "0.1.0" },
  resources: {
    async list() {
      return { items: [{ uri: "content://articles/welcome", name: "welcome" }] };
    },
    async read({ uri }) {
      return { kind: "success", contents: [{ uri, mimeType: "text/markdown", text: "# Welcome" }] };
    },
  },
  tools: {
    async list() {
      return { items: [{ name: "search_content", description: "Search visible content." }] };
    },
    async call({ name }) {
      if (name !== "search_content") return { kind: "not_found", message: "Unknown tool." };
      return { kind: "success", content: [{ type: "text", text: "Search results" }] };
    },
  },
  prompts: {
    async list() {
      return { items: [{ name: "review_content", description: "Review a content item." }] };
    },
    async get({ name }) {
      if (name !== "review_content") return { kind: "not_found", message: "Unknown prompt." };
      return {
        kind: "success",
        messages: [{ role: "user", content: { type: "text", text: "Review content://articles/welcome" } }],
      };
    },
  },
};
```

## Install

Install from the public npm registry:

```bash
npm install @minasoft/mcp-runtime
```

For local package-development verification, you can still consume a tarball from this repository:

```bash
npm run mcp-runtime:build
cd packages/mcp-runtime
npm pack
```

Then install the generated `.tgz` in a separate TypeScript project.

## Developer Examples

For more integration patterns, see [Developer Examples](EXAMPLES.md). It covers
resources, tools, prompts, host-owned Bearer auth, Inspector-compatible CORS,
completion, low-level JSON-RPC dispatch, custom protocol versions,
pagination, and upstream Inspector CLI smoke checks.

## Route Example

```ts
// app/api/mcp/route.ts
import {
  createMcpFetchHandler,
  createMcpOptionsResponse,
  type McpRuntimeProvider,
} from "@minasoft/mcp-runtime";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

async function verifyBearerToken(request: Request): Promise<{ userId: string } | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  // Host app responsibility: validate the token, load the user, and check permissions.
  return { userId: "user-from-host-app" };
}

function createProvider(): McpRuntimeProvider {
  return {
    serverInfo: {
      name: "published-content",
      version: "0.1.0",
    },
    resources: {
      async list({ context }) {
        const user = context.principal as { userId: string } | null;

        return {
          items: [
            {
              uri: "content://articles/note/welcome",
              name: "welcome",
              title: "Welcome note",
              mimeType: "text/markdown",
              annotations: { audience: ["assistant"] },
            },
          ].filter(() => user),
        };
      },
      async read({ uri, context }) {
        const user = context.principal as { userId: string } | null;
        if (!user) return { kind: "forbidden", message: "Authentication required." };

        const prefix = "content://articles/note/";
        if (!uri.startsWith(prefix)) {
          return { kind: "not_found", message: "Unknown article note." };
        }

        const slug = uri.slice(prefix.length);
        return {
          kind: "success",
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: `# ${slug}\n\nPublished content from the host app.`,
            },
          ],
        };
      },
      templates: {
        async list() {
          return {
            items: [
              {
                uriTemplate: "content://articles/note/{slug}",
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
}

const handleMcp = createMcpFetchHandler(createProvider(), {
  cors,
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await verifyBearerToken(request),
    };
  },
});

export async function OPTIONS(request: Request) {
  return createMcpOptionsResponse(cors, request);
}

export async function POST(request: Request) {
  return handleMcp(request);
}
```

The Fetch helper handles JSON parsing, JSON-RPC response envelopes, `MCP-Protocol-Version` validation, response content types, per-request provider context, and opt-in CORS headers. Keep app concerns such as Bearer validation, token storage, rate limiting, tenant checks, and app-specific permission rules in the hosting route or middleware.

Provider-thrown errors are sanitized as JSON-RPC `-32603` internal errors with the generic message `Internal error`. Expected domain failures should still be returned as typed provider errors such as `not_found`, `forbidden`, or `invalid_params`.

## Minimal Family Providers

Implement only the families your app needs. Capability advertisement follows
the provider shape, so unsupported tools or prompts are not claimed.

### Minimal Resources

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

const resourcesProvider: McpRuntimeProvider = {
  serverInfo: { name: "content-app", version: "0.1.0" },
  resources: {
    async list() {
      return {
        items: [
          {
            uri: "content://articles/note/welcome",
            name: "welcome",
            title: "Welcome note",
            mimeType: "text/markdown",
          },
        ],
      };
    },
    async read({ uri }) {
      if (!uri.startsWith("content://articles/note/")) {
        return { kind: "not_found", message: "Unknown resource" };
      }

      return {
        kind: "success",
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: "# Published content",
          },
        ],
      };
    },
  },
};

```

### Minimal Tools

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

const toolsProvider: McpRuntimeProvider = {
  serverInfo: { name: "actions-app", version: "0.1.0" },
  tools: {
    async list() {
      return {
        items: [
          {
            name: "echo",
            description: "Echo a message.",
            inputSchema: {
              type: "object",
              properties: { message: { type: "string" } },
              required: ["message"],
              additionalProperties: false,
            },
          },
        ],
      };
    },
    async call({ name, arguments: args }) {
      if (name !== "echo") return { kind: "not_found", message: "Unknown tool." };
      const message = typeof args?.message === "string" ? args.message : "";
      if (!message) return { kind: "invalid_params", message: "message is required." };
      return { kind: "success", content: [{ type: "text", text: message }] };
    },
  },
};
```

### Minimal Prompts

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

const promptsProvider: McpRuntimeProvider = {
  serverInfo: { name: "workflow-app", version: "0.1.0" },
  prompts: {
    async list() {
      return {
        items: [
          {
            name: "review_text",
            description: "Review supplied text.",
            arguments: [{ name: "text", required: true }],
          },
        ],
      };
    },
    async get({ name, arguments: args }) {
      if (name !== "review_text") return { kind: "not_found", message: "Unknown prompt." };
      const text = typeof args?.text === "string" ? args.text : "";
      if (!text) return { kind: "invalid_params", message: "text is required." };
      return {
        kind: "success",
        messages: [{ role: "user", content: { type: "text", text: `Review this text:\n\n${text}` } }],
      };
    },
  },
};
```

## Provider Boundary

The provider is the only required integration surface. It should return MCP-domain objects rather than database records.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

export function createProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "content-app", version: "0.1.0" },
    resources: {
      async list() {
        return { items: [] };
      },
      async read() {
        return { kind: "not_found", message: "Unknown resource." };
      },
    },
  };
}
```

Provider rules:

- resources, tools, and prompts are all first-class optional provider families
- capabilities are advertised only when the matching provider methods exist
- provider errors should be returned as typed results such as `not_found`, `forbidden`, or `invalid_params`
- thrown errors are treated as unexpected failures and returned as sanitized internal JSON-RPC errors
- auth principals, tenant IDs, trace IDs, and request IDs should flow through `McpRuntimeContext`
- cursors are provider-owned strings; the package does not force an offset database model

## Low-Level Handler

Use `handleMcpJsonRpcMessage` when your app already parsed HTTP and resolved auth:

```ts
import { handleMcpJsonRpcMessage, type McpRuntimeProvider } from "@minasoft/mcp-runtime";

export async function handleMessage(provider: McpRuntimeProvider, principal: string) {
  return handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "resources-list",
      method: "resources/list",
      params: {},
    },
    provider,
    { context: { principal } },
  );
}
```

## Verification

Inside this repository:

```bash
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
npm run mcp-runtime:inspector:smoke
```

`mcp-runtime:consumer:test` builds the package, packs it, installs the tarball into a temporary external TypeScript project, imports only `@minasoft/mcp-runtime`, and runs `tsc --noEmit`.

For upstream Inspector compatibility against the Mock Server app, run the host MCP server and then:

```bash
npm run inspector:mock
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
```

`inspector:mock` exercises the Mock Server's broader runtime surface, including
tools, resources, prompts, completion, auth modes, and audit evidence. The
resource CLI checks are focused package-level smoke tests for the reusable
runtime boundary.

## API Stability

The package is at `0.x`, so public APIs can still be refined while downstream integration feedback is collected. Keep these compatibility rules:

- patch versions fix bugs without intentional API changes
- minor versions may add optional fields, helpers, or methods
- breaking provider contract changes require a documented migration path and, after `1.0.0`, a major version bump
- exported types should remain framework-light and must not import Next.js, React, Prisma, or Mock Server app modules

## License

Apache-2.0.
