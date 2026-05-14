# Reusable MCP Runtime Package Spec

## Purpose
`@minasoft/mcp-runtime` lets TypeScript applications expose MCP resources, resource templates, optional tools, optional prompts, and completion without copying MCP Mock Server protocol code.

The package is a protocol runtime boundary, not a Mock Server feature bundle.

## Users
- TypeScript and Next.js developers adding MCP server capability to an existing app
- downstream apps such as Minakeep that want to expose published content as MCP resources
- MCP Mock Server maintainers who need one reusable protocol implementation

## User-Visible Behavior
- A downstream app can install the public npm package or locally pack the package and import only `@minasoft/mcp-runtime`.
- A resources-only provider advertises resource capabilities without advertising tools or prompts.
- Optional tools, prompts, subscriptions, and completion are advertised only when the provider implements the matching methods.
- Expected domain failures such as not found, forbidden, and invalid params are returned as MCP JSON-RPC error envelopes.
- Unexpected provider-thrown errors are sanitized as JSON-RPC `-32603` internal failures without leaking thrown messages, stacks, tokens, request bodies, or private content.
- The optional Fetch helper accepts a standard `Request` and returns a standard `Response`.
- Optional CORS/OPTIONS helpers can be enabled by the host app for browser clients such as upstream MCP Inspector without opening CORS by default.
- Custom `supportedProtocolVersions` and `defaultProtocolVersion` are honored consistently by the Fetch adapter.
- The lower-level JSON-RPC handler remains available for apps that already own HTTP parsing and auth.

## Consumer-Owned Responsibilities
The package must not own:

- database records or indexes
- user, tenant, auth, or scope models
- CORS policy decisions, unless the host app opts into runtime-provided header helpers
- OAuth challenges or token parsing
- SSE session storage
- audit logging
- admin UI screens
- Mock Server endpoint, resource, prompt, or fixture CRUD

## API Stability
- The current package is `0.x`; API refinement is allowed with documented migration notes.
- Patch releases should not intentionally change public contracts.
- Minor releases may add optional provider fields, DTO fields, or helpers.
- After `1.0.0`, breaking public provider-contract changes require a major version bump.
- Public exports must stay framework-light and must not import Next.js, React, Prisma, SQLite, or app-local modules.

## Release Readiness
The package is published publicly on npm. Before publishing a new version, maintainers must run:

```bash
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
npm run mcp-runtime:inspector:smoke
```

The external consumer smoke must prove that a temporary TypeScript project can install the packed tarball, import public runtime APIs, and typecheck without app-local aliases.

## Satisfaction Goals
- MCP Mock Server consumes the package for its own JSON-RPC protocol handling.
- Downstream docs show a minimal provider and a Next.js Fetch route.
- Inspector CLI resources/list, resources/templates/list, and resources/read checks pass against a package-backed route.
- Package metadata includes license, repository, exports, types, Node engine support, and public publish config.
- Public npm installation works with `npm install @minasoft/mcp-runtime`.
