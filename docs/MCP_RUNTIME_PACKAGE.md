# MCP Runtime Package

`@minasoft/mcp-runtime` is the framework-light MCP JSON-RPC runtime package extracted from MCP Mock Server. It lives in this repository at `packages/mcp-runtime`.

MCP Mock Server uses this package internally for reusable JSON-RPC method handling. The app still owns auth, CORS, SSE session hosting, persistence, endpoint matching, OAuth, audit, and the admin UI.

The package is publicly available on npm: [`@minasoft/mcp-runtime`](https://www.npmjs.com/package/@minasoft/mcp-runtime).

Developer-focused package examples live in
[`packages/mcp-runtime/EXAMPLES.md`](../packages/mcp-runtime/EXAMPLES.md).
They cover resources, tools, prompts, host-owned auth, Inspector CORS,
completion, low-level JSON-RPC dispatch, custom protocol
versions, pagination, expected errors, and upstream Inspector CLI checks.

## Positioning

`@minasoft/mcp-runtime` is intentionally smaller than a full MCP server SDK. It
does not try to own the host application's server lifecycle, routing,
authentication, database, audit, OAuth, or UI. Instead, it provides the MCP
JSON-RPC runtime boundary that a product backend can call after it has already
resolved those concerns.

Use this package when:

- the host app already has HTTP routes, middleware, auth, storage, and domain models
- MCP should expose existing product data as resources, app actions as tools, and reusable model workflows as prompts or completion
- auth must stay in the host app, such as Bearer tokens, sessions, tenants, feature flags, or custom permission checks
- the host wants MCP protocol handling without importing Next.js, Prisma, React, SQLite, or Mock Server admin modules into the reusable runtime
- browser-based tools such as upstream MCP Inspector need opt-in CORS without forcing open CORS by default

The official MCP TypeScript SDK remains the best default when a developer wants
the canonical MCP SDK, client-side APIs, or a full server abstraction. This
runtime is optimized for "I already have a product API route; make this route
speak MCP safely."

## Package Boundary

The package owns:

- JSON-RPC request and response envelopes
- `initialize` and `notifications/initialized`
- `tools/list` and `tools/call` when a provider supplies tools
- `resources/list`, `resources/read`, and `resources/templates/list` when a provider supplies resources
- `resources/subscribe` and `resources/unsubscribe` when a provider supplies subscriptions
- `prompts/list`, `prompts/get`, and `completion/complete` when a provider supplies prompts or completion
- provider-derived capability advertisement
- MCP protocol-version helpers, pagination helpers, and standard MCP errors
- an optional Fetch `Request` / `Response` adapter for Next.js and other Fetch-compatible runtimes
- optional CORS/OPTIONS helpers that host apps can enable for browser-based clients such as upstream MCP Inspector

Consumers own:

- storage, indexing, and database models
- authentication, authorization, tenants, users, and scopes
- logging and audit records
- CORS policy decisions, OAuth challenges, and HTTP deployment shape
- SSE session state and live notifications
- tool, resource, and prompt business logic

The package exports MCP DTOs and provider contracts. Providers should return MCP-domain objects, not Prisma records or Mock Server app entities.

## Provider Families

The package is intentionally provider-family oriented. A host app can implement
only the families it needs.

| Family | Host app owns | Runtime package owns |
|---|---|---|
| Resources | Which records are visible, how URIs map to records, how templates render, how cursors are generated | `resources/list`, `resources/read`, `resources/templates/list`, standard response and error envelopes |
| Tools | Which commands exist, input validation, side effects, permissions, audit, idempotency, and app-specific failures | `tools/list`, `tools/call`, tool success, tool error, raw responses, and provider error mapping |
| Prompts | Prompt catalog, prompt arguments, workflow copy, resource references, completion candidates, permissions | `prompts/list`, `prompts/get`, `completion/complete`, provider-derived capabilities |

MCP Mock Server uses all three:

- endpoint fixtures become MCP tools
- resource and resource-template fixtures become MCP resources and templates
- prompt fixtures and completion candidates become MCP prompts and completions

## How MCP Mock Server Uses The Runtime

MCP Mock Server is the concrete host-app reference implementation for this
package. It demonstrates how another app can keep auth, route policy,
persistence, and product rules outside the runtime while still using the package
for reusable MCP JSON-RPC dispatch.

| Concern | Mock Server example | Runtime package role |
|---|---|---|
| Next.js route wiring | `app/mcp/route.ts`, `app/mcp/none/route.ts`, `app/mcp/basic/route.ts`, `app/mcp/oauth/route.ts` export route handlers from `lib/mcp/http.ts` | The package receives already-parsed JSON-RPC messages through `handleMcpJsonRpcMessage` |
| Auth mode selection | `handleUnifiedMcpPost`, `handleStrictBasicMcpPost`, and `handleStrictOAuthMcpPost` in `lib/mcp/http.ts` resolve no-auth, Basic, and Bearer rules before dispatch | The runtime does not inspect credentials; it receives provider options or context chosen by the host |
| OAuth permission filtering | `resolveOAuthBearerAuthorizationHeader` returns permitted endpoint, resource, template, and prompt IDs | `createMockServerRuntimeProvider` maps those IDs to MCP provider behavior |
| Product data mapping | `lib/mcp/runtime-provider.ts` converts endpoint fixtures, resources, templates, prompts, and completion candidates into MCP DTOs | The package dispatches `tools/list`, `resources/read`, `prompts/get`, and related methods against the provider |
| Error handling | The provider returns typed outcomes such as `not_found`, `forbidden`, `invalid_params`, `tool_error`, or `raw` | The runtime converts provider outcomes into JSON-RPC envelopes and sanitizes unexpected throws |
| SSE hosting | `lib/mcp/http.ts` and `lib/mcp/sse-notifications.ts` own legacy SSE sessions and message routes | The package provides reusable method handling; SSE session storage stays app-owned |
| CORS policy | `lib/http/cors.ts` owns Mock Server's public mock-server CORS stance | The package offers opt-in CORS helpers for downstream apps that want browser Inspector compatibility |

For a downstream product app, the same pattern usually becomes:

1. The route authenticates the request with the app's own middleware or token logic.
2. The route builds a small `McpRuntimeContext`, for example `{ principal, requestId, tenantId }`.
3. The provider maps app records to MCP resources, templates, prompts, or tools.
4. The runtime handles JSON-RPC method dispatch and response envelopes.
5. The route logs, audits, rate-limits, and deploys exactly like the rest of the app.

This split is the main value of the package: MCP protocol code becomes reusable,
while product policy remains local and explicit.

## Install

Install from the public npm registry:

```bash
npm install @minasoft/mcp-runtime
```

For local package-development verification, consume a local tarball:

```bash
npm run mcp-runtime:build
cd packages/mcp-runtime
npm pack
```

Then install the generated `.tgz` in the downstream app.

## Published Content Resource Provider

A content app can expose published content as MCP resources by adapting its own records to `McpRuntimeProvider`.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

type PublishedContent = {
  slug: string;
  title: string;
  body: string;
  updatedAt: Date;
};

async function listPublishedContent(userId: string | undefined): Promise<PublishedContent[]> {
  // Use the host app's own database and visibility rules here.
  return [
    {
      slug: "welcome",
      title: "Welcome",
      body: "# Welcome\n\nPublished content for MCP clients.",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
    },
  ];
}

async function readPublishedContent(slug: string, userId: string | undefined): Promise<PublishedContent | null> {
  const items = await listPublishedContent(userId);
  return items.find((item) => item.slug === slug) ?? null;
}

export function createPublishedContentProvider(): McpRuntimeProvider {
  return {
    serverInfo: {
      name: "published-content",
      version: "0.1.0",
    },
    resources: {
      async list({ context }) {
        const userId = context.principal as string | undefined;
        const items = await listPublishedContent(userId);

        return {
          items: items.map((item) => ({
            uri: `content://articles/note/${item.slug}`,
            name: item.slug,
            title: item.title,
            mimeType: "text/markdown",
            annotations: {
              lastModified: item.updatedAt.toISOString(),
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
        const item = await readPublishedContent(uri.slice(prefix.length), userId);
        if (!item) {
          return { kind: "not_found", message: "Resource was not found or is not visible." };
        }

        return {
          kind: "success",
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: item.body,
            },
          ],
        };
      },
    },
  };
}
```

Tools and prompts are optional. A provider that implements only resources advertises resource capabilities without claiming unsupported tool or prompt methods.

## Product Action Tool Provider

A product app can expose app-owned actions as MCP tools. The host app still owns
authorization, side effects, audit, idempotency, and input semantics.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

type SearchResult = {
  uri: string;
  title: string;
};

async function searchVisibleContent(query: string, userId: string): Promise<SearchResult[]> {
  // Host app helper: query your own database or search index here.
  return [{ uri: "content://articles/note/welcome", title: `Result for ${query} by ${userId}` }];
}

export function createProductActionProvider(): McpRuntimeProvider {
  return {
    serverInfo: {
      name: "product-actions",
      version: "0.1.0",
    },
    tools: {
      async list() {
        return {
          items: [
            {
              name: "search_content",
              title: "Search content",
              description: "Search content visible to the current user.",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                },
                required: ["query"],
                additionalProperties: false,
              },
            },
          ],
        };
      },
      async call({ name, arguments: args, context }) {
        if (name !== "search_content") {
          return { kind: "not_found", message: "Unknown tool." };
        }

        const principal = context.principal as { userId: string; scopes: string[] } | null;
        if (!principal?.scopes.includes("content:read")) {
          return { kind: "forbidden", message: "Missing content:read scope." };
        }

        const query = typeof args?.query === "string" ? args.query : "";
        if (!query) {
          return { kind: "invalid_params", message: "query is required." };
        }

        const results = await searchVisibleContent(query, principal.userId);
        return {
          kind: "success",
          content: [{ type: "text", text: JSON.stringify(results) }],
          structuredContent: { results },
        };
      },
    },
  };
}
```

In MCP Mock Server, endpoint fixtures follow this pattern: enabled endpoints are
listed as tools, and `tools/call` delegates into the endpoint runtime.

## Prompt Workflow Provider

A product app can expose reusable model workflows as MCP prompts. This is useful
when the app wants clients to invoke consistent review, summarize, triage, or
generation templates.

```ts
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

async function suggestVisibleContentUris(prefix: string): Promise<string[]> {
  // Host app helper: return URI suggestions visible to the current user.
  return ["content://articles/note/welcome", "content://articles/note/release-notes"].filter((uri) =>
    uri.startsWith(prefix),
  );
}

export function createWorkflowPromptProvider(): McpRuntimeProvider {
  return {
    serverInfo: {
      name: "product-workflows",
      version: "0.1.0",
    },
    prompts: {
      async list() {
        return {
          items: [
            {
              name: "review_content",
              title: "Review content",
              description: "Review a visible content item for clarity and missing context.",
              arguments: [{ name: "uri", required: true, description: "MCP resource URI" }],
            },
          ],
        };
      },
      async get({ name, arguments: args }) {
        if (name !== "review_content") {
          return { kind: "not_found", message: "Unknown prompt." };
        }

        const uri = typeof args?.uri === "string" ? args.uri : "";
        if (!uri) {
          return { kind: "invalid_params", message: "uri is required." };
        }

        return {
          kind: "success",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Review ${uri} for clarity, correctness, and missing context.`,
              },
            },
          ],
        };
      },
      async complete({ argument }) {
        if (argument.name !== "uri") {
          return { kind: "not_found", message: "No completions for this argument." };
        }

        const values = await suggestVisibleContentUris(argument.value ?? "");
        return { kind: "success", values, total: values.length, hasMore: false };
      },
    },
  };
}
```

In MCP Mock Server, prompt fixtures and completion candidates follow this
pattern: prompts are listed, prompt arguments are rendered into messages, and
completion candidates power `completion/complete`.

## Next.js Fetch Route Example

The Fetch helper is useful when the host route already handles deployment and auth. The runtime provides optional CORS helpers, but the host app decides when to enable them.

```ts
// app/api/mcp/route.ts
import { createMcpFetchHandler, createMcpOptionsResponse } from "@minasoft/mcp-runtime";
import { createPublishedContentProvider } from "@/lib/mcp/published-content-provider";

const cors = {
  allowedOrigins: ["http://localhost:6274"],
};

const handleMcp = createMcpFetchHandler(createPublishedContentProvider(), {
  cors,
  async context(request) {
    const authorization = request.headers.get("authorization");
    const principal = authorization?.startsWith("Bearer ")
      ? await validateBearerTokenAndLoadUser(authorization.slice("Bearer ".length))
      : null;

    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal,
    };
  },
});

export async function OPTIONS(request: Request) {
  return createMcpOptionsResponse(cors, request);
}

export async function POST(request: Request) {
  // Add any host-specific rate limits or tenant checks before this call.
  return handleMcp(request);
}
```

If the host app needs custom HTTP behavior, call `handleMcpJsonRpcMessage` directly after parsing the request body and resolving the app-owned auth context.

Auth, token storage, rate limiting, app-specific permission checks, and tenant visibility remain host-app responsibilities. The runtime does not store tokens or decide whether a user can see a specific article.

## Provider Design Rules

- Keep provider methods small and domain-oriented.
- Return typed provider errors instead of throwing for expected cases such as not found, forbidden, and invalid params.
- Thrown provider errors are sanitized to JSON-RPC `-32603` internal errors with the generic message `Internal error`; thrown messages, stacks, database details, tokens, request bodies, and private content are not returned to clients.
- Pass user, tenant, request, or trace data through `McpRuntimeContext`.
- Keep authorization in the host app; the runtime does not inspect tokens or credentials.
- Use stable resource URIs. They are client-visible API identifiers.
- Keep pagination cursors opaque to clients. The runtime forwards cursors but does not own database pagination.
- Do not leak app database records directly as MCP objects.

## Inspector CLI Verification

For this repository, start MCP Mock Server before running Inspector checks:

```bash
npm run db:prepare
npm run dev
```

Then verify the app integration and upstream-compatible runtime flow:

```bash
npm run inspector:mock
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
```

`inspector:mock` exercises the Mock Server's broader runtime surface, including
tools, resources, prompts, completion, auth modes, tokens, audit, and cleanup.
The resource CLI checks are focused package-level smoke tests for the reusable
runtime boundary. The broader task gate also runs lint, typecheck, package
build/test, unit tests, and Playwright E2E.

For a downstream app, the equivalent upstream Inspector CLI shape is:

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp \
  --transport http \
  --method resources/list

npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3000/api/mcp \
  --transport http \
  --method resources/read \
  --uri content://articles/note/welcome
```

Add `--header "Authorization: Bearer ..."` or another auth header when the host route requires it.

## Package Release Checks

Before publishing a new version, run:

```bash
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
npm run mcp-runtime:inspector:smoke
```

`npm run mcp-runtime:consumer:test` creates a temporary external TypeScript project, installs the packed runtime tarball, imports only `@minasoft/mcp-runtime`, and runs `tsc --noEmit`. This catches missing declaration files, broken exports, and accidental app-local imports.

`npm run mcp-runtime:inspector:smoke` starts a tiny package-backed server and verifies upstream MCP Inspector CLI `resources/list`, `resources/templates/list`, and `resources/read`. It is intentionally small; application-level E2E should also cover any tools and prompts the host app exposes.

## API Stability

The package is still `0.x`, so the public API can be refined while downstream apps validate the boundary.

Current policy:

- patch versions fix bugs without intentional API changes
- minor versions may add optional fields, helpers, methods, or DTO fields
- breaking provider contract changes must include a migration note
- after `1.0.0`, breaking provider contract changes require a major version bump
- exported runtime code must stay framework-light and must not depend on Next.js, React, Prisma, SQLite, Mock Server admin UI, or OAuth UI modules

## Current Publish Status

`@minasoft/mcp-runtime` is published publicly on npm. The latest documented package version is `0.1.6`.

`packages/mcp-runtime` remains buildable, packable, and externally typechecked from this workspace with:

```bash
npm run mcp-runtime:build
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
npm run mcp-runtime:inspector:smoke
```

The package metadata includes `license`, `repository`, `exports`, `types`, `engines`, and public publish config.
