# @minasoft/mcp-runtime

Framework-light MCP JSON-RPC runtime helpers for TypeScript providers.

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

The Fetch helper handles JSON parsing, JSON-RPC response envelopes, `MCP-Protocol-Version` validation, response content types, and per-request provider context. Keep app concerns such as CORS, Basic or Bearer parsing, OAuth challenges, and SSE session state in the hosting route or middleware.
