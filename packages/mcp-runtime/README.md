# @minasoft/mcp-runtime

Framework-light MCP JSON-RPC runtime helpers for TypeScript providers.

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

## Minimal Next.js Route

```ts
// app/api/mcp/route.ts
import { createMcpFetchHandler, type McpRuntimeProvider } from "@minasoft/mcp-runtime";

const provider: McpRuntimeProvider = {
  serverInfo: {
    name: "published-content",
    version: "0.1.0",
  },
  resources: {
    async list({ context }) {
      const userId = context.principal as string | undefined;
      return {
        items: [
          {
            uri: `published://content/readme-${userId ?? "public"}`,
            name: "readme",
            title: "Readme",
            mimeType: "text/markdown",
          },
        ],
      };
    },
    async read({ uri }) {
      if (!uri.startsWith("published://content/")) {
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

const handleMcp = createMcpFetchHandler(provider, {
  context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: request.headers.get("x-user-id") ?? undefined,
    };
  },
});

export async function POST(request: Request) {
  return handleMcp(request);
}
```

The Fetch helper handles JSON parsing, JSON-RPC response envelopes, `MCP-Protocol-Version` validation, response content types, and per-request provider context. Keep app concerns such as CORS, Basic or Bearer parsing, OAuth challenges, rate limits, and SSE session state in the hosting route or middleware.

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

- resources are first-class; tools and prompts are optional
- capabilities are advertised only when the matching provider methods exist
- provider errors should be returned as typed results such as `not_found`, `forbidden`, or `invalid_params`
- thrown errors are treated as unexpected failures
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
```

`mcp-runtime:consumer:test` builds the package, packs it, installs the tarball into a temporary external TypeScript project, imports only `@minasoft/mcp-runtime`, and runs `tsc --noEmit`.

For upstream Inspector compatibility, run the host MCP server and then:

```bash
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
```

## API Stability

The package is at `0.x`, so public APIs can still be refined while downstream integration feedback is collected. Keep these compatibility rules:

- patch versions fix bugs without intentional API changes
- minor versions may add optional fields, helpers, or methods
- breaking provider contract changes require a documented migration path and, after `1.0.0`, a major version bump
- exported types should remain framework-light and must not import Next.js, React, Prisma, or Mock Server app modules

## License

Apache-2.0.
