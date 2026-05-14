# @minasoft/mcp-runtime Developer Examples

This file collects integration patterns for developers who want to expose
application data through MCP without copying MCP Mock Server protocol code.

The examples assume the host app owns HTTP routing, authentication, storage,
rate limits, audit logs, tenant checks, and product-specific permission rules.
The runtime owns MCP JSON-RPC envelopes, capability derivation, method dispatch,
pagination shapes, protocol-version headers, and sanitized internal errors.

This is the main design idea:

```text
HTTP route / middleware
  -> authenticate and authorize with host-app rules
  -> build McpRuntimeContext
  -> call @minasoft/mcp-runtime
  -> provider maps host records to MCP DTOs
  -> runtime returns JSON-RPC response envelope
```

Use the official MCP TypeScript SDK when you want the canonical full SDK or
client/server framework. Use this runtime when your app already has routes,
auth, storage, and product permissions, and MCP should be a thin protocol layer
over those existing systems.

## 0. Host-App Reference: MCP Mock Server

MCP Mock Server is the reference integration for this package. It is useful to
read it as a real host app rather than as package internals.

| Host-app concern | Mock Server reference | What the runtime handles |
|---|---|---|
| Next.js route entrypoints | `app/mcp/route.ts`, `app/mcp/none/route.ts`, `app/mcp/basic/route.ts`, `app/mcp/oauth/route.ts` | Receives a JSON-RPC message after the route chooses the auth mode |
| Route and auth orchestration | `lib/mcp/http.ts` | Dispatches `initialize`, `tools/list`, `resources/read`, `prompts/get`, and related MCP methods |
| Basic and OAuth Bearer checks | `resolveBasicAuthorizationHeader`, `resolveOAuthBearerAuthorizationHeader` | Does not inspect credentials or tokens |
| Permission narrowing | endpoint, resource, template, and prompt IDs passed into `createMockServerRuntimeProvider` | Calls the provider that the host app already scoped |
| Product data mapping | `lib/mcp/runtime-provider.ts` | Converts provider results into JSON-RPC success/error envelopes |
| Legacy SSE sessions | `lib/mcp/http.ts`, `lib/mcp/sse-notifications.ts` | Handles reusable resource subscription methods, not app-owned session storage |
| Mock-server CORS policy | `lib/http/cors.ts` | Provides optional CORS helpers for downstream apps |

The same split works for another product app:

1. Put MCP behind a normal app route, such as `app/api/mcp/route.ts`.
2. Resolve session, Bearer token, tenant, scopes, and feature flags before calling the runtime.
3. Pass only safe request state into `McpRuntimeContext`.
4. Implement a provider that returns MCP resources, templates, tools, prompts, or completion from app data.
5. Keep logs, audits, rate limits, and deployment policy in the host app.

## 1. Resources-Only Content Provider

Use this shape when your app wants MCP clients to read published content,
documents, articles, notes, or other stable records.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

type Article = {
  slug: string;
  title: string;
  markdown: string;
  updatedAt: Date;
};

async function listVisibleArticles(userId: string | undefined): Promise<Article[]> {
  // Replace this with your app's database query and visibility rules.
  if (!userId) return [];

  return [
    {
      slug: "welcome",
      title: "Welcome",
      markdown: "# Welcome\n\nThis content is visible through MCP.",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
    },
  ];
}

export function createContentProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "content-mcp", version: "0.1.0" },
    resources: {
      async list({ context }) {
        const userId = context.principal as string | undefined;
        const articles = await listVisibleArticles(userId);

        return {
          items: articles.map((article) => ({
            uri: `content://articles/note/${article.slug}`,
            name: article.slug,
            title: article.title,
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              lastModified: article.updatedAt.toISOString(),
            },
          })),
        };
      },
      async read({ uri, context }) {
        const prefix = "content://articles/note/";
        if (!uri.startsWith(prefix)) {
          return { kind: "not_found", message: "Unknown resource URI." };
        }

        const userId = context.principal as string | undefined;
        const slug = uri.slice(prefix.length);
        const article = (await listVisibleArticles(userId)).find((item) => item.slug === slug);
        if (!article) {
          return { kind: "not_found", message: "Resource was not found or is not visible." };
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

## 2. Next.js Route With Host-Owned Bearer Auth

Keep authentication in your application route or middleware. Pass only the
resolved principal into the runtime context.

This mirrors MCP Mock Server's strict OAuth path: the route verifies the Bearer
token first, then calls the runtime with a provider that sees only the permitted
principal or resource scope.

```ts
// app/api/mcp/route.ts
import { createMcpFetchHandler } from "@minasoft/mcp-runtime";
import { createContentProvider } from "@/lib/mcp/content-provider";

type Principal = {
  userId: string;
  scopes: string[];
};

async function authenticate(request: Request): Promise<Principal | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length);

  // Host app responsibility:
  // - verify signature or session
  // - check expiry/revocation
  // - load user and tenant scopes
  // - avoid leaking token details to provider errors
  return token ? { userId: "user_123", scopes: ["content:read"] } : null;
}

const handleMcp = createMcpFetchHandler(createContentProvider(), {
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await authenticate(request),
    };
  },
});

export async function POST(request: Request) {
  return handleMcp(request);
}
```

Inside provider methods, treat `context.principal` as already authenticated
application state. The runtime does not validate tokens or decide permissions.

If your app uses cookies or server sessions instead of Bearer tokens, keep the
same boundary: resolve the session in the route, pass a safe principal into
`context`, and let the provider use that context for visibility checks.

## 3. Inspector-Compatible CORS, Opt In

CORS is closed by default. Enable it only where your host app wants browser MCP
clients, such as upstream MCP Inspector at `http://localhost:6274`.

MCP Mock Server intentionally owns its own public CORS behavior because it is a
test server. Product apps should usually be narrower and opt in only to the
origins they want to support.

```ts
// app/api/mcp/route.ts
import { createMcpFetchHandler, createMcpOptionsResponse } from "@minasoft/mcp-runtime";
import { createContentProvider } from "@/lib/mcp/content-provider";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

const handleMcp = createMcpFetchHandler(createContentProvider(), {
  cors,
  async context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: await authenticate(request),
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

The helper includes common MCP browser-client headers such as `Authorization`,
`Content-Type`, `MCP-Protocol-Version`, `MCP-Session-Id`, and `Last-Event-ID`.

## 4. Tools Provider

Add tools only when the app has command-like behavior that should be invoked by
MCP clients. Expected user or input failures should return typed provider
errors. Unexpected thrown errors are sanitized to JSON-RPC `-32603`.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

export function createToolProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "content-tools", version: "0.1.0" },
    tools: {
      async list() {
        return {
          items: [
            {
              name: "summarize_article",
              title: "Summarize article",
              description: "Return a short summary for a published article.",
              inputSchema: {
                type: "object",
                properties: {
                  slug: { type: "string", description: "Article slug" },
                },
                required: ["slug"],
                additionalProperties: false,
              },
            },
          ],
        };
      },
      async call({ name, arguments: args, context }) {
        if (name !== "summarize_article") {
          return { kind: "not_found", message: "Unknown tool." };
        }

        const slug = typeof args?.slug === "string" ? args.slug : null;
        if (!slug) {
          return { kind: "invalid_params", message: "slug is required." };
        }

        const principal = context.principal as { scopes?: string[] } | null;
        if (!principal?.scopes?.includes("content:read")) {
          return { kind: "forbidden", message: "Missing content:read scope." };
        }

        return {
          kind: "success",
          content: [{ type: "text", text: `Summary for ${slug}` }],
          structuredContent: { slug },
        };
      },
    },
  };
}
```

## 5. Prompts and Completion

Prompts are useful when the app can provide reusable instructions or templates
for MCP clients. Completion can suggest prompt argument values or resource URI
parts.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

export function createPromptProvider(): McpRuntimeProvider {
  return {
    serverInfo: { name: "content-prompts", version: "0.1.0" },
    prompts: {
      async list() {
        return {
          items: [
            {
              name: "review_article",
              title: "Review article",
              description: "Ask the model to review a published article.",
              arguments: [{ name: "slug", required: true, description: "Article slug" }],
            },
          ],
        };
      },
      async get({ name, arguments: args }) {
        if (name !== "review_article") {
          return { kind: "not_found", message: "Unknown prompt." };
        }

        const slug = typeof args?.slug === "string" ? args.slug : null;
        if (!slug) {
          return { kind: "invalid_params", message: "slug is required." };
        }

        return {
          kind: "success",
          description: "Review a published article for clarity and correctness.",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Review content://articles/note/${slug} for clarity, accuracy, and missing context.`,
              },
            },
          ],
        };
      },
      async complete({ argument }) {
        if (argument.name !== "slug") {
          return { kind: "not_found", message: "No completions for this argument." };
        }

        const slugs = ["welcome", "release-notes", "faq"];
        const value = argument.value ?? "";
        const values = slugs.filter((slug) => slug.startsWith(value));

        return { kind: "success", values, total: values.length, hasMore: false };
      },
    },
  };
}
```

## 6. Low-Level JSON-RPC Handler

Use `handleMcpJsonRpcMessage` when the host framework has already parsed the
request body or does not use the Fetch `Request` / `Response` API.

MCP Mock Server uses this lower-level shape in `lib/mcp/http.ts` because its
routes need custom Basic/OAuth challenge responses, legacy SSE message routing,
and mock-specific response headers around the reusable MCP dispatch.

```ts
import { handleMcpJsonRpcMessage, type McpRuntimeProvider } from "@minasoft/mcp-runtime";

export async function dispatchMcpMessage(provider: McpRuntimeProvider, body: unknown, userId: string) {
  return handleMcpJsonRpcMessage(body, provider, {
    context: {
      requestId: crypto.randomUUID(),
      principal: userId,
    },
  });
}
```

The low-level handler returns JSON-RPC success or error objects, plus raw tool
responses when a tool intentionally returns `kind: "raw"`.

## 7. Custom Protocol Version Policy

The Fetch adapter accepts custom protocol-version options. This is useful when a
host app wants to pin or stage protocol support.

```ts
import { createMcpFetchHandler } from "@minasoft/mcp-runtime";
import { createContentProvider } from "@/lib/mcp/content-provider";

const handleMcp = createMcpFetchHandler(createContentProvider(), {
  supportedProtocolVersions: ["2025-06-18"],
  defaultProtocolVersion: "2025-06-18",
});

export async function POST(request: Request) {
  return handleMcp(request);
}
```

Requests with an unsupported `MCP-Protocol-Version` header receive HTTP 400.
When the request omits the header, the response uses `defaultProtocolVersion`.

## 8. Pagination With Opaque Cursors

Provider cursors are app-owned strings. The package also exports offset helpers
for simple static or SQL-backed lists.

```ts
import { paginateMcpItemsByOffset, type McpRuntimeProvider } from "@minasoft/mcp-runtime";

const allResources = Array.from({ length: 50 }, (_, index) => ({
  uri: `content://articles/note/article-${index + 1}`,
  name: `article-${index + 1}`,
  title: `Article ${index + 1}`,
  mimeType: "text/markdown",
}));

export const provider: McpRuntimeProvider = {
  resources: {
    async list({ cursor, limit }) {
      const page = paginateMcpItemsByOffset({
        items: allResources,
        cursor,
        limit,
      });

      return {
        items: page.items,
        nextCursor: page.nextCursor,
      };
    },
    async read({ uri }) {
      return {
        kind: "success",
        contents: [{ uri, mimeType: "text/markdown", text: "# Article" }],
      };
    },
  },
};
```

For database-backed pagination, you can ignore the helper and return your own
opaque cursor, such as an encrypted record ID or signed page token.

## 9. Expected Errors vs Unexpected Throws

Return typed provider errors for expected domain outcomes. Throw only for truly
unexpected failures.

```ts
async function readArticle(uri: string) {
  if (!uri.startsWith("content://articles/note/")) {
    return { kind: "not_found" as const, message: "Unknown resource URI." };
  }

  const article = await loadArticle(uri);
  if (!article) {
    return { kind: "not_found" as const, message: "Article is not visible." };
  }

  return {
    kind: "success" as const,
    contents: [{ uri, mimeType: "text/markdown", text: article.markdown }],
  };
}
```

If `loadArticle` throws, the client receives a sanitized JSON-RPC internal error:

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

## 10. Upstream Inspector CLI Smoke

After exposing a route, use upstream MCP Inspector CLI to verify the integration.

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp \
  --transport http \
  --method resources/list

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp \
  --transport http \
  --method resources/templates/list

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp \
  --transport http \
  --method resources/read \
  --uri content://articles/note/welcome
```

When your host route requires auth, add the same auth header your app expects:

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp \
  --transport http \
  --method resources/list \
  --header "Authorization: Bearer $TOKEN"
```

## Developer Checklist

- Keep stable resource URIs; clients may bookmark or reuse them.
- Keep auth, token storage, rate limiting, tenant checks, and audit logs in the host app.
- Pass resolved request state through `McpRuntimeContext`.
- Use typed provider errors for expected outcomes.
- Let unexpected provider throws be sanitized by the runtime.
- Enable CORS only for browser clients you intentionally support.
- Verify with upstream Inspector CLI before exposing the endpoint to users.
