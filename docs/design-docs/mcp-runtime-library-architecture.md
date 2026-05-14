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
  };
};
```

The exact exported names can change during implementation, but the shape must keep these boundaries:
- resources are first-class and required for the Minakeep use case
- tools and prompts are optional
- providers return MCP-domain DTOs, not Prisma records or app entities
- errors are returned through typed runtime outcomes rather than thrown framework exceptions

## Library-Owned Behavior
The package should own the reusable MCP protocol behavior currently embedded in the app:
- `initialize` and `notifications/initialized`
- `tools/list` and `tools/call` when a tools provider exists
- `resources/list`, `resources/read`, and `resources/templates/list`
- `prompts/list` and `prompts/get` when a prompts provider exists
- cursor pagination response shape
- unsupported method errors
- invalid params and not-found errors
- MCP protocol version negotiation helpers
- JSON-RPC request and batch-safe response formatting where supported by the current app behavior
- standard capability advertisement based on the provided provider features

The package may expose a `createMcpFetchHandler(provider, options)` convenience helper for Next.js and other Fetch-compatible runtimes, but the lower-level message handler must remain available for projects that already own their HTTP/auth layer.

## Mock Server Integration Rule
MCP Mock Server must become the first real integration test for the package.

After extraction:
- app code imports MCP types and JSON-RPC handling from `@minasoft/mcp-runtime`
- app-specific adapters map endpoint, resource, resource-template, and prompt records into package DTOs
- app-specific auth wrappers continue to decide no-auth, Basic, OAuth, permission filtering, CORS, SSE, and audit behavior
- old internal protocol/type modules are removed or reduced to temporary migration shims only inside the same implementation task
- active app and test code must not keep importing `@/lib/mcp/protocol` or `@/lib/mcp/types`

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

The package should make this possible without importing any Mock Server endpoint, OAuth, Prisma, or admin UI code.

## Verification Requirements
The implementation task that follows this design must include:
- package build check for `@minasoft/mcp-runtime`
- focused unit tests for initialize, resources/list, resources/read, not-found errors, pagination, and unsupported methods
- Mock Server unit regression tests proving existing tools/resources/prompts behavior still passes through the package
- a static import guard that fails if app/test code keeps using old internal MCP protocol modules
- upstream MCP Inspector CLI smoke checks for resources/list and resources/read
- docs showing a minimal Next.js route and provider implementation for Minakeep-style published content
