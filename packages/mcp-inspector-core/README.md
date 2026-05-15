# @minasoft/mcp-inspector-core

Framework-light client inspection core used by Mina Inspector and the `mmcp`
CLI. It builds MCP JSON-RPC requests, sends them to Streamable HTTP or legacy
SSE endpoints, and returns normalized evidence that a UI or CLI can render.

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
