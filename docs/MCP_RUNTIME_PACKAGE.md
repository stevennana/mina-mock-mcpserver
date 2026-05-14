# MCP Runtime Package

`@minasoft/mcp-runtime` is the framework-light MCP JSON-RPC runtime package extracted from MCP Mock Server. It lives in this repository at `packages/mcp-runtime`.

MCP Mock Server uses this package internally for reusable JSON-RPC method handling. The app still owns auth, CORS, SSE session hosting, persistence, endpoint matching, OAuth, audit, and the admin UI.

The package is publicly available on npm: [`@minasoft/mcp-runtime`](https://www.npmjs.com/package/@minasoft/mcp-runtime).

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

## Minakeep-Style Resource Provider

A content app such as Minakeep can expose published content as MCP resources by adapting its own records to `McpRuntimeProvider`.

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
      name: "minakeep-content",
      version: "0.1.0",
    },
    resources: {
      async list({ context }) {
        const userId = context.principal as string | undefined;
        const items = await listPublishedContent(userId);

        return {
          items: items.map((item) => ({
            uri: `minakeep://articles/note/${item.slug}`,
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
        const prefix = "minakeep://articles/note/";
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

Tools and prompts are optional. A resources-only provider advertises resource capabilities without claiming unsupported tool or prompt methods.

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

Then verify the app integration and upstream-compatible resources flow:

```bash
npm run inspector:mock
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
```

These checks prove the migrated Mock Server routes still expose resources through the reusable runtime boundary. The broader task gate also runs lint, typecheck, package build/test, unit tests, and Playwright E2E.

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
  --uri minakeep://articles/note/welcome
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

`npm run mcp-runtime:inspector:smoke` starts a tiny resources-only package-backed server and verifies upstream MCP Inspector CLI `resources/list`, `resources/templates/list`, and `resources/read`.

## API Stability

The package is still `0.x`, so the public API can be refined while downstream apps validate the boundary.

Current policy:

- patch versions fix bugs without intentional API changes
- minor versions may add optional fields, helpers, methods, or DTO fields
- breaking provider contract changes must include a migration note
- after `1.0.0`, breaking provider contract changes require a major version bump
- exported runtime code must stay framework-light and must not depend on Next.js, React, Prisma, SQLite, Mock Server admin UI, or OAuth UI modules

## Current Publish Status

`@minasoft/mcp-runtime` is published publicly on npm. The latest documented package version is `0.1.2`.

`packages/mcp-runtime` remains buildable, packable, and externally typechecked from this workspace with:

```bash
npm run mcp-runtime:build
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
npm run mcp-runtime:inspector:smoke
```

The package metadata includes `license`, `repository`, `exports`, `types`, `engines`, and public publish config.
