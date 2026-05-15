# @minasoft/mcp-inspector-core

Framework-light client inspection core used by Mina Inspector and the `mmcp`
CLI. It builds MCP JSON-RPC requests, sends them to Streamable HTTP or legacy
SSE endpoints, and returns normalized evidence that a UI or CLI can render.

Use this package when you are building your own MCP debugger, health-check page,
developer tool, or CI verifier and do not want to copy protocol request code.

## Install

```bash
npm install @minasoft/mcp-inspector-core
```

Requires Node.js `>=20.11`.

## Quick Start

```ts
import { buildMcpRequest, inspectMcpTarget } from "@minasoft/mcp-inspector-core";

const payload = buildMcpRequest({
  family: "resources",
  action: "read",
  uri: "mock://resources/server-status",
});

const result = await inspectMcpTarget({
  url: "http://127.0.0.1:3100/mcp/none",
  method: payload.method,
  params: payload.params,
});
```

The package has no Next.js, React, Prisma, or Mock Server dependency. Host apps
remain responsible for OAuth, token storage, permissions, routing, and any UI.

## Build MCP Requests

Tools:

```ts
buildMcpRequest({ family: "tools", action: "list" });

buildMcpRequest({
  family: "tools",
  action: "call",
  name: "echo",
  args: { message: "hello" },
});
```

Resources:

```ts
buildMcpRequest({ family: "resources", action: "list" });

buildMcpRequest({
  family: "resources",
  action: "read",
  uri: "mock://resources/server-status",
});

buildMcpRequest({ family: "resources", action: "templates" });
```

Prompts:

```ts
buildMcpRequest({ family: "prompts", action: "list" });

buildMcpRequest({
  family: "prompts",
  action: "get",
  name: "support_reply",
  args: { tone: "friendly" },
});
```

Completion:

```ts
buildMcpRequest({
  family: "completion",
  action: "prompt",
  name: "support_reply",
  argument: { name: "tone", value: "fr" },
});

buildMcpRequest({
  family: "completion",
  action: "resource",
  uri: "mock://resources/customers/{customerId}",
  argument: { name: "customerId", value: "cus" },
});
```

Raw JSON-RPC method:

```ts
buildMcpRequest({
  family: "raw",
  action: "raw",
  method: "resources/list",
  params: {},
});
```

## Inspect A Target

Streamable HTTP-style POST is the default:

```ts
const result = await inspectMcpTarget({
  url: "https://mcp.example.com/mcp",
  method: "tools/list",
  protocolVersion: "2025-06-18",
});

if (!result.ok) {
  console.error(result.summary);
}
```

Legacy SSE:

```ts
await inspectMcpTarget({
  url: "https://mcp.example.com/sse",
  transport: "sse",
  method: "resources/list",
});
```

Bearer auth:

```ts
await inspectMcpTarget({
  url: "https://mcp.example.com/mcp",
  method: "prompts/list",
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

Basic auth helper:

```ts
import { createAuthorizationHeaders } from "@minasoft/mcp-inspector-core";

await inspectMcpTarget({
  url: "http://127.0.0.1:3100/mcp/basic",
  method: "tools/list",
  headers: createAuthorizationHeaders({ basic: "default:default" }),
});
```

## Evidence Shape

`inspectMcpTarget()` returns:

```ts
{
  ok: boolean,
  targetUrl: string,
  transport: "http" | "sse",
  steps: [
    {
      name: "MCP initialize",
      status: "pass",
      request: { url, headers, body },
      response: { status, ok, elapsedMs, headers, body }
    }
  ],
  diagnostics: [["method", "tools/list"]],
  summary: { pass: 2, warn: 0, skip: 0, fail: 0 }
}
```

Sensitive request headers such as `Authorization`, `Cookie`, `token`, `secret`,
and `api-key` are redacted in evidence.

## Scope

Included:

- JSON-RPC payload builders for tools, resources, prompts, completion, and raw calls
- Streamable HTTP-style POST inspection
- legacy SSE endpoint/message inspection
- Basic/Bearer/raw header helpers
- response/evidence normalization
- protocol-version header support

Not included:

- OAuth popup UI
- token storage
- rate limiting
- app permission checks
- Mock Server admin APIs
- Prisma, Next.js, React, or browser UI

For a ready-to-use CLI built on this core, use `@minasoft/mmcp-cli`.
