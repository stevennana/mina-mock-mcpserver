# MCP Runtime Package

`@minasoft/mcp-runtime` is the framework-light MCP JSON-RPC runtime package extracted from MCP Mock Server. The package currently lives in this repository at `packages/mcp-runtime` and is marked `private`; do not document it as npm-published until a later publishing task changes that status.

MCP Mock Server now uses this package internally for reusable JSON-RPC method handling. The app still owns auth, CORS, SSE session hosting, persistence, endpoint matching, OAuth, audit, and the admin UI.

## Package Boundary

The package owns:

- JSON-RPC request and response envelopes
- `initialize` and `notifications/initialized`
- `tools/list` and `tools/call` when a provider supplies tools
- `resources/list`, `resources/read`, and `resources/templates/list` when a provider supplies resources
- `prompts/list`, `prompts/get`, and `completion/complete` when a provider supplies prompts or completion
- provider-derived capability advertisement
- MCP protocol-version helpers, pagination helpers, and standard MCP errors
- an optional Fetch `Request` / `Response` adapter for Next.js and other Fetch-compatible runtimes

Consumers own:

- storage, indexing, and database models
- authentication, authorization, tenants, users, and scopes
- logging and audit records
- CORS policy, OAuth challenges, and HTTP deployment shape
- SSE session state and live notifications
- tool, resource, and prompt business logic

The package exports MCP DTOs and provider contracts. Providers should return MCP-domain objects, not Prisma records or Mock Server app entities.

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
            uri: `minakeep://published/${item.slug}`,
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
        const prefix = "minakeep://published/";
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

The Fetch helper is useful when the host route already handles deployment, auth, and CORS.

```ts
// app/api/mcp/route.ts
import { createMcpFetchHandler } from "@minasoft/mcp-runtime";
import { createPublishedContentProvider } from "@/lib/mcp/published-content-provider";

const handleMcp = createMcpFetchHandler(createPublishedContentProvider(), {
  context(request) {
    return {
      requestId: request.headers.get("x-request-id") ?? undefined,
      principal: request.headers.get("x-user-id") ?? undefined,
    };
  },
});

export async function POST(request: Request) {
  // Add CORS, Basic Auth, Bearer validation, or tenant checks before this call.
  return handleMcp(request);
}
```

If the host app needs custom HTTP behavior, call `handleMcpJsonRpcMessage` directly after parsing the request body and resolving the app-owned auth context.

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
  --uri minakeep://published/welcome
```

Add `--header "Authorization: Bearer ..."` or another auth header when the host route requires it.

## Current Publish Status

`packages/mcp-runtime` is buildable and tested from this workspace with:

```bash
npm run mcp-runtime:build
npm run mcp-runtime:test
```

Publishing to npm, naming final semver stability guarantees, and declaring the API frozen are separate follow-up decisions. Until then, downstream examples should be treated as consumption guidance for the local package boundary rather than an installable public package promise.
