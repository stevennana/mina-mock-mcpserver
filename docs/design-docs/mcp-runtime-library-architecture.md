# MCP Runtime Library Architecture

## Goal
Extract the framework-light MCP JSON-RPC runtime from MCP Mock Server into a reusable npm package so other TypeScript projects can expose MCP tools, resources, resource templates, and prompts without copying protocol code.

The first required consumer is this project itself. MCP Mock Server must run through the extracted library boundary before the package is considered usable for another app such as Minakeep.

## Package Shape
- Package name: `@minasoft/mcp-runtime`
- Initial package location: `packages/mcp-runtime`
- Runtime target: TypeScript-first ESM with generated type declarations
- Runtime dependency policy: no Next.js, React, Prisma, SQLite, OAuth UI, or Mock Server admin dependencies
- Framework contract: standard Web `Request` / `Response` helpers may be provided, but the core JSON-RPC handler must be usable without a web framework
- Versioning: package version starts independently from the app version; breaking public interface changes require a package major version bump once published

## Internal Package Layers
The package should stay small, but it still needs clear internal layers so external users do not inherit Mock Server coupling:

| Layer | Responsibility | May depend on |
|---|---|---|
| `types` | Public MCP DTOs, provider input/output contracts, JSON-RPC result types | no runtime modules |
| `core` | JSON-RPC validation, method dispatch, capability calculation, pagination, standard MCP errors | `types` only |
| `http` | Optional Fetch `Request`/`Response` adapter, protocol-version headers, JSON parsing errors | `types`, `core` |
| app adapter | Mock Server-specific endpoint/resource/prompt/auth mapping | app code and `@minasoft/mcp-runtime` |

The `core` layer must not import `http`, and neither `core` nor `http` may import from the Mock Server app. SSE session storage, audit logging, OAuth challenges, and CORS policy remain app-owned unless a later package version intentionally adds a separate transport module.

## Public Consumer Model
External npm consumers should bring their own domain model and implement a provider interface. The library owns JSON-RPC method dispatch, MCP response envelopes, pagination helpers, capability advertisement, and standard error shapes.

Consumers own:
- storage and indexing
- authentication and authorization
- domain validation
- tenant or user scoping
- logging and audit records
- transport hosting and deployment
- tool, resource, and prompt business logic

The provider interface must be small enough for a content app to implement without adopting the Mock Server domain model:

```ts
type McpRuntimeContext = {
  requestId?: string;
  principal?: unknown;
};

type McpListInput = {
  cursor?: string;
  limit?: number;
  context: McpRuntimeContext;
};

type McpListResult<T> = {
  items: T[];
  nextCursor?: string;
};

type McpProviderError =
  | { kind: "not_found"; message?: string }
  | { kind: "forbidden"; message: string }
  | { kind: "invalid_params"; message: string; data?: Record<string, unknown> }
  | { kind: "protocol_error"; message: string; data?: Record<string, unknown> };

type McpResourceReadResult =
  | { kind: "success"; contents: McpResourceContent[] }
  | McpProviderError;

type McpToolCallResult =
  | { kind: "success"; content: McpToolContent[]; structuredContent?: Record<string, unknown> }
  | { kind: "tool_error"; content: McpToolContent[]; structuredContent?: Record<string, unknown> }
  | { kind: "raw"; status: number; body: string; contentType?: string | null; headers?: Record<string, string> }
  | McpProviderError;

type McpPromptGetResult =
  | { kind: "success"; description?: string; messages: McpPromptMessage[] }
  | McpProviderError;

type McpCompletionResult =
  | { kind: "success"; values: string[]; total?: number; hasMore?: boolean }
  | McpProviderError;

type McpRuntimeProvider = {
  serverInfo?: {
    name: string;
    version: string;
  };
  resources: {
    list(input: McpListInput): Promise<McpListResult<McpResource>>;
    read(input: McpResourceReadInput): Promise<McpResourceReadResult>;
    templates?: {
      list(input: McpListInput): Promise<McpListResult<McpResourceTemplate>>;
    };
  };
  tools?: {
    list(input: McpListInput): Promise<McpListResult<McpTool>>;
    call(input: McpToolCallInput): Promise<McpToolCallResult>;
  };
  prompts?: {
    list(input: McpListInput): Promise<McpListResult<McpPrompt>>;
    get(input: McpPromptGetInput): Promise<McpPromptGetResult>;
    complete?: (input: McpCompletionInput) => Promise<McpCompletionResult>;
  };
  completion?: {
    complete(input: McpCompletionInput): Promise<McpCompletionResult>;
  };
  subscriptions?: {
    subscribe(input: McpResourceReadInput): Promise<{ kind: "success" } | McpProviderError>;
    unsubscribe(input: McpResourceReadInput): Promise<{ kind: "success" } | McpProviderError>;
  };
};
```

The exact exported names can change during implementation, but the shape must keep these boundaries:
- resources are first-class and required for the Minakeep use case
- tools and prompts are optional
- providers return MCP-domain DTOs, not Prisma records or app entities
- errors are returned through typed runtime outcomes rather than thrown framework exceptions
- provider methods receive an optional runtime context so apps can pass auth principals or trace IDs without making auth a package concern
- `raw` tool results exist only to preserve Mock Server's malformed-response test capability; normal consumers should return `success`, `tool_error`, or typed provider errors
- list results use provider-owned cursors; the package may offer offset-cursor helpers, but it must not force offset pagination on database-backed consumers

## Library-Owned Behavior
The package should own the reusable MCP protocol behavior currently embedded in the app:
- `initialize` and `notifications/initialized`
- `tools/list` and `tools/call` when a tools provider exists
- `resources/list`, `resources/read`, and `resources/templates/list`
- `resources/subscribe` and `resources/unsubscribe` when a subscription provider exists
- `prompts/list` and `prompts/get` when a prompts provider exists
- `completion/complete` when a completion provider exists
- cursor pagination response shape
- unsupported method errors
- invalid params and not-found errors
- MCP protocol version negotiation helpers
- JSON-RPC request and batch-safe response formatting where supported by the current app behavior
- standard capability advertisement based on the provided provider features

The package may expose a `createMcpFetchHandler(provider, options)` convenience helper for Next.js and other Fetch-compatible runtimes, but the lower-level message handler must remain available for projects that already own their HTTP/auth layer.

Capability advertisement must be derived from the provider:
- advertise `tools` only when `tools.list` exists
- advertise `resources` when `resources.list` and `resources.read` exist; set `subscribe: true` only when `subscriptions` exists
- advertise `prompts` only when `prompts.list` and `prompts.get` exist
- advertise `completions` only when `completion.complete` or `prompts.complete` exists

Unsupported optional methods should return standard method-not-found responses instead of pretending the capability exists.

## Mock Server Integration Rule
MCP Mock Server must become the first real integration test for the package.

After extraction:
- app code imports MCP types and JSON-RPC handling from `@minasoft/mcp-runtime`
- app-specific adapters map endpoint, resource, resource-template, and prompt records into package DTOs
- app-specific auth wrappers continue to decide no-auth, Basic, OAuth, permission filtering, CORS, SSE, and audit behavior
- old internal protocol/type modules are removed or reduced to temporary migration shims only inside the same implementation task
- active app and test code must not keep importing `@/lib/mcp/protocol` or `@/lib/mcp/types`
- malformed response simulation is implemented as an app adapter returning the package's typed `raw` tool result, not by leaking endpoint runtime types into the package
- app-owned SSE routes may call package `core` handlers for JSON-RPC messages, but legacy SSE session bookkeeping stays in app code

This prevents a false extraction where the package exists but the production Mock Server still uses the old internal implementation.

## Non-Goals
The runtime package must not extract:
- endpoint catalog CRUD
- exact-match mock response-case authoring
- failure simulation admin UI
- OAuth login, consent, token storage, JWKS, or admin UI
- Prisma schemas, repositories, or seed fixtures
- audit log persistence
- public Mock Server admin pages
- standalone Inspector UI
- Ralph loop scripts

Mock Server may keep those systems and adapt them to the package through thin provider adapters.

## Minakeep Consumption Target
Minakeep should be able to publish content as MCP resources by installing the package and implementing a provider that maps published content records to MCP resources.

Expected Minakeep shape:
- `resources/list` returns published content descriptors with stable URIs
- `resources/read` returns the selected content body and MIME type
- `resources/templates/list` is optional and can expose route-style content templates later
- prompts and tools can be omitted until Minakeep needs them
- Minakeep keeps its own auth, permissions, database, and published-content model
- Minakeep can pass its own authenticated user, tenant, or publication visibility data through `McpRuntimeContext`

The package should make this possible without importing any Mock Server endpoint, OAuth, Prisma, or admin UI code.

## Verification Requirements
The implementation task that follows this design must include:
- package build check for `@minasoft/mcp-runtime`
- package public export check that imports only from `@minasoft/mcp-runtime`
- generated declaration check so downstream TypeScript users receive stable `.d.ts` files
- focused unit tests for initialize, resources/list, resources/read, not-found errors, pagination, and unsupported methods
- unit tests for capability advertisement with absent/present tools, prompts, completions, and subscriptions
- a tiny consumer fixture test that uses the package without `@/` aliases, Next.js, Prisma, or Mock Server domain imports
- Mock Server unit regression tests proving existing tools/resources/prompts behavior still passes through the package
- a static import guard that fails if app/test code keeps using old internal MCP protocol modules
- upstream MCP Inspector CLI smoke checks for resources/list and resources/read
- docs showing a minimal Next.js route and provider implementation for Minakeep-style published content
