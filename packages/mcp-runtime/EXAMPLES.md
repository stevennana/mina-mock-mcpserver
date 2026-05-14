# @minasoft/mcp-runtime Developer Examples

This file is a developer cookbook for using `@minasoft/mcp-runtime` in an
existing TypeScript application.

The runtime is not resources-only. It supports three provider families:

| Family | Use it when | MCP methods |
|---|---|---|
| Resources | Clients should read app data, documents, records, files, or rendered templates | `resources/list`, `resources/read`, `resources/templates/list`, optional subscribe/unsubscribe |
| Tools | Clients should invoke app actions, searches, validators, calculations, or side effects | `tools/list`, `tools/call` |
| Prompts | Clients should use app-owned model workflows, prompt templates, or argument completion | `prompts/list`, `prompts/get`, `completion/complete` |

You can implement one family, two families, or all three in the same
`McpRuntimeProvider`. Capability advertisement follows the provider shape.

## Runtime Boundary

The host app owns routing, auth, storage, rate limits, audit, tenants, and
permissions. The runtime owns JSON-RPC envelopes, method dispatch, capabilities,
protocol headers, pagination shapes, and sanitized internal errors.

```text
HTTP route / middleware
  -> authenticate and authorize with host-app rules
  -> build McpRuntimeContext
  -> call @minasoft/mcp-runtime
  -> provider maps host records/actions/workflows to MCP DTOs
  -> runtime returns JSON-RPC response envelope
```

MCP Mock Server uses the same split:

| Host-app concern | Mock Server reference | Runtime role |
|---|---|---|
| Next.js route entrypoints | `app/mcp/route.ts`, `app/mcp/none/route.ts`, `app/mcp/basic/route.ts`, `app/mcp/oauth/route.ts` | Receives JSON-RPC after the route chooses auth mode |
| Route/auth orchestration | `lib/mcp/http.ts` | Dispatches MCP methods through `handleMcpJsonRpcMessage` |
| Product mapping | `lib/mcp/runtime-provider.ts` | Calls provider methods and converts results to JSON-RPC |
| Tools | endpoint fixtures | `tools/list`, `tools/call` |
| Resources | resource and resource-template fixtures | `resources/list`, `resources/read`, `resources/templates/list` |
| Prompts | prompt fixtures and completion candidates | `prompts/list`, `prompts/get`, `completion/complete` |

Use the official MCP TypeScript SDK when you want the canonical full SDK or a
broader client/server framework. Use this runtime when your app already has
routes, auth, storage, and product rules, and MCP should be a thin protocol
layer over those systems.

## Shared Helpers Used By The Examples

The examples below use the same small host-owned auth helper. Replace it with
your real session, JWT, API key, OAuth, tenant, or permission logic.

```ts
// lib/auth/mcp-auth.ts
export type Principal = {
  userId: string;
  tenantId: string;
  scopes: string[];
};

export async function authenticateMcpRequest(request: Request): Promise<Principal | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length);
  if (!token) return null;

  // Host app responsibility:
  // - verify signature or session
  // - check expiry and revocation
  // - load tenant and permission scopes
  // - never return token details to provider errors
  return {
    userId: "user_123",
    tenantId: "tenant_abc",
    scopes: ["content:read", "content:search", "workflow:read"],
  };
}

export function hasScope(principal: Principal | null, scope: string) {
  return Boolean(principal?.scopes.includes(scope));
}
```

## Example 1: Resources

Use resources when MCP clients should read product data. Good fits include
published articles, knowledge-base pages, notes, files, database records, and
rendered templates.

This example exposes article records as:

- `resources/list`
- `resources/read`
- `resources/templates/list`

### Resource Provider

```ts
// lib/mcp/article-resources-provider.ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";
import type { Principal } from "@/lib/auth/mcp-auth";
import { hasScope } from "@/lib/auth/mcp-auth";

type Article = {
  slug: string;
  title: string;
  markdown: string;
  updatedAt: Date;
};

async function listVisibleArticles(principal: Principal): Promise<Article[]> {
  // Host app helper: query your database with tenant and visibility rules.
  if (!hasScope(principal, "content:read")) return [];

  return [
    {
      slug: "welcome",
      title: "Welcome",
      markdown: "# Welcome\n\nThis article is visible through MCP.",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
    },
    {
      slug: "release-notes",
      title: "Release notes",
      markdown: "# Release Notes\n\nRuntime examples were expanded.",
      updatedAt: new Date("2026-05-14T01:00:00.000Z"),
    },
  ];
}

function principalFromContext(contextPrincipal: unknown): Principal | null {
  return contextPrincipal && typeof contextPrincipal === "object" ? (contextPrincipal as Principal) : null;
}

export function createArticleResourcesProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "article-resources", version: "0.1.0" },
    resources: {
      async list({ context, cursor, limit = 50 }) {
        const principal = principalFromContext(context.principal);
        if (!principal) return { items: [] };

        const articles = await listVisibleArticles(principal);
        const offset = cursor ? Number.parseInt(cursor, 10) : 0;
        const page = articles.slice(offset, offset + limit);
        const nextOffset = offset + page.length;

        return {
          items: page.map((article) => ({
            uri: `content://articles/note/${article.slug}`,
            name: article.slug,
            title: article.title,
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              lastModified: article.updatedAt.toISOString(),
            },
          })),
          ...(nextOffset < articles.length ? { nextCursor: String(nextOffset) } : {}),
        };
      },

      async read({ uri, context }) {
        const principal = principalFromContext(context.principal);
        if (!principal) {
          return { kind: "forbidden", message: "Authentication required." };
        }

        const prefix = "content://articles/note/";
        if (!uri.startsWith(prefix)) {
          return { kind: "not_found", message: "Unknown article resource URI." };
        }

        const slug = uri.slice(prefix.length);
        const article = (await listVisibleArticles(principal)).find((item) => item.slug === slug);
        if (!article) {
          return { kind: "not_found", message: "Article was not found or is not visible." };
        }

        return {
          kind: "success",
          contents: [{ uri, mimeType: "text/markdown", text: article.markdown }],
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
```

### Resource Route

```ts
// app/api/mcp/resources/route.ts
import { createMcpFetchHandler, createMcpOptionsResponse } from "@minasoft/mcp-runtime";
import { authenticateMcpRequest } from "@/lib/auth/mcp-auth";
import { createArticleResourcesProvider } from "@/lib/mcp/article-resources-provider";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

const handleMcp = createMcpFetchHandler(createArticleResourcesProvider(), {
  cors,
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await authenticateMcpRequest(request),
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

### Resource Inspector Checks

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/resources \
  --transport http \
  --method resources/list \
  --header "Authorization: Bearer $TOKEN"

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/resources \
  --transport http \
  --method resources/templates/list \
  --header "Authorization: Bearer $TOKEN"

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/resources \
  --transport http \
  --method resources/read \
  --uri content://articles/note/welcome \
  --header "Authorization: Bearer $TOKEN"
```

## Example 2: Tools

Use tools when MCP clients should invoke product actions. Good fits include
search, validation, ticket creation, calculations, sync jobs, and controlled
side effects.

This example exposes a search action as:

- `tools/list`
- `tools/call`

### Tools Provider

```ts
// lib/mcp/content-tools-provider.ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";
import type { Principal } from "@/lib/auth/mcp-auth";
import { hasScope } from "@/lib/auth/mcp-auth";

type SearchResult = {
  uri: string;
  title: string;
  snippet: string;
};

async function searchVisibleContent(query: string, principal: Principal): Promise<SearchResult[]> {
  // Host app helper: query your database, search index, or service.
  if (!hasScope(principal, "content:search")) return [];

  return [
    {
      uri: "content://articles/note/welcome",
      title: "Welcome",
      snippet: `Matched "${query}" for ${principal.tenantId}`,
    },
  ];
}

function principalFromContext(contextPrincipal: unknown): Principal | null {
  return contextPrincipal && typeof contextPrincipal === "object" ? (contextPrincipal as Principal) : null;
}

export function createContentToolsProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "content-tools", version: "0.1.0" },
    tools: {
      async list({ context }) {
        const principal = principalFromContext(context.principal);
        if (!hasScope(principal, "content:search")) return { items: [] };

        return {
          items: [
            {
              name: "search_content",
              title: "Search content",
              description: "Search content visible to the current user.",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query" },
                  limit: { type: "number", description: "Maximum result count" },
                },
                required: ["query"],
                additionalProperties: false,
              },
              outputSchema: {
                type: "object",
                properties: {
                  results: { type: "array" },
                },
              },
            },
          ],
        };
      },

      async call({ name, arguments: args, context }) {
        if (name !== "search_content") {
          return { kind: "not_found", message: "Unknown tool." };
        }

        const principal = principalFromContext(context.principal);
        if (!principal || !hasScope(principal, "content:search")) {
          return { kind: "forbidden", message: "Missing content:search scope." };
        }

        const query = typeof args?.query === "string" ? args.query.trim() : "";
        if (!query) {
          return { kind: "invalid_params", message: "query is required." };
        }

        const requestedLimit = typeof args?.limit === "number" ? args.limit : 10;
        const limit = Math.max(1, Math.min(requestedLimit, 25));
        const results = (await searchVisibleContent(query, principal)).slice(0, limit);

        return {
          kind: "success",
          content: [
            {
              type: "text",
              text: results.map((item) => `${item.title}: ${item.uri}`).join("\n") || "No results",
            },
          ],
          structuredContent: { results },
        };
      },
    },
  };
}
```

### Tools Route

```ts
// app/api/mcp/tools/route.ts
import { createMcpFetchHandler, createMcpOptionsResponse } from "@minasoft/mcp-runtime";
import { authenticateMcpRequest } from "@/lib/auth/mcp-auth";
import { createContentToolsProvider } from "@/lib/mcp/content-tools-provider";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

const handleMcp = createMcpFetchHandler(createContentToolsProvider(), {
  cors,
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await authenticateMcpRequest(request),
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

### Tools Inspector Checks

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/tools \
  --transport http \
  --method tools/list \
  --header "Authorization: Bearer $TOKEN"

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/tools \
  --transport http \
  --method tools/call \
  --tool-name search_content \
  --tool-arg query=welcome \
  --tool-arg limit=5 \
  --header "Authorization: Bearer $TOKEN"
```

## Example 3: Prompts and Completion

Use prompts when MCP clients should discover app-owned model workflows. Good
fits include review templates, support reply templates, summarization flows,
triage workflows, and prompts that embed or reference app resources.

This example exposes a review workflow as:

- `prompts/list`
- `prompts/get`
- `completion/complete`

### Prompts Provider

```ts
// lib/mcp/workflow-prompts-provider.ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";
import type { Principal } from "@/lib/auth/mcp-auth";
import { hasScope } from "@/lib/auth/mcp-auth";

type PromptArgumentSuggestion = {
  value: string;
  title: string;
};

async function suggestVisibleArticleUris(prefix: string, principal: Principal): Promise<PromptArgumentSuggestion[]> {
  // Host app helper: return completions from records visible to this user.
  if (!hasScope(principal, "workflow:read")) return [];

  return [
    { value: "content://articles/note/welcome", title: "Welcome" },
    { value: "content://articles/note/release-notes", title: "Release notes" },
  ].filter((item) => item.value.startsWith(prefix));
}

function principalFromContext(contextPrincipal: unknown): Principal | null {
  return contextPrincipal && typeof contextPrincipal === "object" ? (contextPrincipal as Principal) : null;
}

export function createWorkflowPromptsProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "workflow-prompts", version: "0.1.0" },
    prompts: {
      async list({ context }) {
        const principal = principalFromContext(context.principal);
        if (!hasScope(principal, "workflow:read")) return { items: [] };

        return {
          items: [
            {
              name: "review_content",
              title: "Review content",
              description: "Review a visible content item for clarity and missing context.",
              arguments: [
                { name: "uri", required: true, description: "MCP resource URI to review" },
                { name: "tone", required: false, description: "Review tone, such as friendly or strict" },
              ],
            },
          ],
        };
      },

      async get({ name, arguments: args, context }) {
        if (name !== "review_content") {
          return { kind: "not_found", message: "Unknown prompt." };
        }

        const principal = principalFromContext(context.principal);
        if (!principal || !hasScope(principal, "workflow:read")) {
          return { kind: "forbidden", message: "Missing workflow:read scope." };
        }

        const uri = typeof args?.uri === "string" ? args.uri : "";
        if (!uri) {
          return { kind: "invalid_params", message: "uri is required." };
        }

        const tone = typeof args?.tone === "string" ? args.tone : "clear";
        return {
          kind: "success",
          description: "Review a content item for clarity, correctness, and missing context.",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: [
                  `Review ${uri}.`,
                  `Use a ${tone} tone.`,
                  "Check clarity, correctness, missing context, and actionability.",
                ].join("\n"),
              },
            },
          ],
        };
      },

      async complete({ argument, context }) {
        const principal = principalFromContext(context.principal);
        if (!principal || !hasScope(principal, "workflow:read")) {
          return { kind: "forbidden", message: "Missing workflow:read scope." };
        }

        if (argument.name === "uri") {
          const suggestions = await suggestVisibleArticleUris(argument.value ?? "", principal);
          return {
            kind: "success",
            values: suggestions.map((item) => item.value),
            total: suggestions.length,
            hasMore: false,
          };
        }

        if (argument.name === "tone") {
          const tones = ["friendly", "strict", "executive", "technical"];
          const value = argument.value ?? "";
          const values = tones.filter((tone) => tone.startsWith(value));
          return { kind: "success", values, total: values.length, hasMore: false };
        }

        return { kind: "not_found", message: "No completions for this argument." };
      },
    },
  };
}
```

### Prompts Route

```ts
// app/api/mcp/prompts/route.ts
import { createMcpFetchHandler, createMcpOptionsResponse } from "@minasoft/mcp-runtime";
import { authenticateMcpRequest } from "@/lib/auth/mcp-auth";
import { createWorkflowPromptsProvider } from "@/lib/mcp/workflow-prompts-provider";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

const handleMcp = createMcpFetchHandler(createWorkflowPromptsProvider(), {
  cors,
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await authenticateMcpRequest(request),
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

### Prompts Inspector Checks

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/prompts \
  --transport http \
  --method prompts/list \
  --header "Authorization: Bearer $TOKEN"

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp/prompts \
  --transport http \
  --method prompts/get \
  --prompt-name review_content \
  --prompt-args uri=content://articles/note/welcome \
  --prompt-args tone=friendly \
  --header "Authorization: Bearer $TOKEN"
```

Inspector CLI `0.21.2` does not expose a `completion/complete` CLI command. Use
the browser Inspector when it shows completion controls, your own JSON-RPC curl,
or your app's E2E test harness to verify completion.

```bash
curl -s http://127.0.0.1:3000/api/mcp/prompts \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": "complete-uri",
    "method": "completion/complete",
    "params": {
      "ref": { "type": "ref/prompt", "name": "review_content" },
      "argument": { "name": "uri", "value": "content://articles/note/" }
    }
  }'
```

## Example 4: All Families In One Route

Many apps should expose one MCP endpoint with all supported families instead of
three separate endpoints. Compose the same provider families in a single
`McpRuntimeProvider`.

```ts
// lib/mcp/product-provider.ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";
import { createArticleResourcesProvider } from "@/lib/mcp/article-resources-provider";
import { createContentToolsProvider } from "@/lib/mcp/content-tools-provider";
import { createWorkflowPromptsProvider } from "@/lib/mcp/workflow-prompts-provider";

export function createProductProvider(): McpRuntimeProvider {
  const resourcesProvider = createArticleResourcesProvider();
  const toolsProvider = createContentToolsProvider();
  const promptsProvider = createWorkflowPromptsProvider();

  return {
    serverInfo: { name: "product-mcp", version: "0.1.0" },
    resources: resourcesProvider.resources,
    tools: toolsProvider.tools,
    prompts: promptsProvider.prompts,
  };
}
```

```ts
// app/api/mcp/route.ts
import { createMcpFetchHandler, createMcpOptionsResponse } from "@minasoft/mcp-runtime";
import { authenticateMcpRequest } from "@/lib/auth/mcp-auth";
import { createProductProvider } from "@/lib/mcp/product-provider";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

const handleMcp = createMcpFetchHandler(createProductProvider(), {
  cors,
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await authenticateMcpRequest(request),
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

## Example 5: Low-Level JSON-RPC Dispatch

Use `handleMcpJsonRpcMessage` when your framework already parsed the HTTP body,
or when you need custom HTTP behavior around MCP dispatch. MCP Mock Server uses
this style in `lib/mcp/http.ts` because it owns Basic/OAuth challenges, legacy
SSE message routes, and mock-specific headers.

```ts
import { handleMcpJsonRpcMessage, type McpRuntimeProvider } from "@minasoft/mcp-runtime";
import type { Principal } from "@/lib/auth/mcp-auth";

export async function dispatchMcpMessage(provider: McpRuntimeProvider, body: unknown, principal: Principal | null) {
  return handleMcpJsonRpcMessage(body, provider, {
    context: {
      requestId: crypto.randomUUID(),
      principal,
    },
    pageSize: 100,
  });
}
```

## Error Handling Rules

Return typed provider errors for expected app outcomes:

- `not_found` for unknown resources, tools, or prompts
- `forbidden` for valid users without permission
- `invalid_params` for malformed arguments
- `protocol_error` for app-specific protocol failures

Throw only for unexpected failures. The runtime catches provider throws and
returns a sanitized JSON-RPC internal error:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32603,
    "message": "Internal error"
  }
}
```

Thrown messages, stack traces, database details, tokens, request bodies, and
private content are not returned to clients.

## Developer Checklist

- Decide which provider families your app should expose: resources, tools, prompts, or all three.
- Keep auth, token storage, tenant rules, rate limits, and audit logs in the host app.
- Pass only safe request state through `McpRuntimeContext`.
- Keep resource URIs stable; clients may bookmark or reuse them.
- Treat tool calls as product actions: validate input, permissions, idempotency, and side effects.
- Treat prompts as app-owned workflows, not random strings embedded in route handlers.
- Enable CORS only for browser clients you intentionally support.
- Verify every exposed family with Inspector CLI, browser Inspector, curl, or your E2E harness.
