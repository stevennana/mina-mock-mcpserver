# MCP Mock Server

MCP Mock Server is a public remote MCP mock server and web UI for testing MCP clients before they touch a real production service.

Try the hosted server first:

```text
https://mcp.minasoftai.com/
```

Use this project when you need to prove that an MCP client, agent integration, QA script, or demo can handle tool discovery, tool calls, resources, resource templates, prompts, completion, Basic Auth, OAuth Bearer permissions, legacy SSE compatibility, failures, token revocation, and audit evidence in a repeatable mock environment.

## Is This The Project You Need?

This is a good fit if you want:

- a configurable mock MCP tool server with a browser admin UI
- Streamable HTTP MCP routes and legacy SSE-compatible MCP routes
- no-auth, strict Basic Auth, and strict OAuth Bearer test paths
- a mock OAuth authorization server with login, consent, PKCE, client credentials, JWKS, discovery metadata, and revocation
- server-side MCP Resources, Resource Templates, Prompts, Completion, and legacy SSE resource-update notifications
- REST tool list/call routes for curl, Postman, and non-MCP client checks
- endpoint response cases, generated MCP `inputSchema`, and failure simulation
- token inspection, audit logs, reset, health, Docker, Nginx, and local TLS guidance
- a standalone project Inspector UI plus upstream `npx @modelcontextprotocol/inspector` examples
- a standalone `mmcp` command line inspector for tools, resources, prompts, completion, raw JSON-RPC, HTTP, and legacy SSE
- reusable MCP JSON-RPC runtime package guidance for TypeScript apps that want to expose their own resources, tools, or prompts

This is not a good fit if you need production identity management, multi-tenant isolation, enterprise RBAC, external OAuth provider integration, or MCP client-side Sampling, Roots, Elicitation, or task-augmented execution.

## Current Version

Latest documented release: `v1.0.11`

Highlights:

- product-grade Mock Server admin navigation with bundled SVG icons
- standalone Inspector UI with focused Mock scenario, Generic target, and OAuth popup pages
- new `@minasoft/mcp-inspector-core` and `@minasoft/mmcp-cli` packages for terminal MCP inspection
- Streamable HTTP and legacy SSE-compatible MCP routes
- MCP Resources, Resource Templates, Prompts, Completion, OAuth resource/resource-template/prompt permissions, and SSE resource notifications
- upstream MCP Inspector browser and CLI verification paths
- OAuth authorization-code with PKCE, client credentials, Bearer permission filtering, and token revocation
- Mock Server routes consume the public npm package `@minasoft/mcp-runtime` for reusable JSON-RPC protocol handling

## Quick Start

```bash
npm install
npm run db:prepare
npm run dev
```

Open:

```text
http://127.0.0.1:3100
```

Health check:

```bash
curl http://127.0.0.1:3100/api/health
```

The development server uses port `3100`. Docker Compose exposes port `3000`.

## Fastest End-To-End Verification

Run the project-owned standalone Inspector:

```bash
npm run inspector:ui
```

Open:

```text
http://127.0.0.1:3200
```

Use:

- **Mock Server scenario** for broad E2E coverage across admin APIs, REST, MCP tools/resources/prompts/completion, SSE notifications, Basic Auth, OAuth permissions, tokens, audit, reset guard, and cleanup.
- **Generic MCP target** for one MCP endpoint, including no-auth, Basic, Bearer, method presets for tools/resources/prompts/completion, and raw evidence.
- **OAuth popup flow** for browser login, consent, PKCE code exchange, and final Bearer MCP verification in Generic MCP Target.

## Main Routes

| Area | Routes |
|---|---|
| Admin UI | `/`, `/endpoints`, `/resources`, `/resource-templates`, `/prompts`, `/basic-users`, `/oauth-users`, `/oauth-clients`, `/tokens`, `/config`, `/inspector`, `/audit`, `/reset` |
| Streamable HTTP MCP | `/mcp`, `/mcp/none`, `/mcp/basic`, `/mcp/oauth` |
| Legacy SSE MCP | `/sse`, `/sse/none`, `/sse/basic`, `/sse/oauth` plus matching `/message` POST routes |
| REST tools | `/rest/tools`, `/rest/tools/{tool_name}/call` |
| OAuth | `/oauth/authorize`, `/oauth/login`, `/oauth/consent`, `/oauth/token`, `/oauth/revoke`, `/oauth/jwks` |
| Discovery | `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/openid-configuration` |
| Operations API | `/api/health`, `/api/config`, `/api/reset`, `/api/audit` |

## Documentation Map

Start here:

- [Feature overview](docs/FEATURES.md)
- [Getting started guide](docs/GETTING_STARTED.md)
- [MCP transports, SSE, REST, and OAuth calls](docs/TRANSPORTS.md)
- [Inspector integration](docs/INSPECTOR.md)
- [`mmcp` command line inspector](docs/MMCP_CLI.md)
- [Reusable MCP runtime package guide](docs/MCP_RUNTIME_PACKAGE.md), including positioning, auth/router integration, and Mock Server host-app examples
- [Runtime package README](packages/mcp-runtime/README.md)

Inspector-specific guides:

- [Upstream MCP Browser Inspector guide](MCPBrowserInspector.md)
- [Mina hosted Inspector E2E guide](MinaInspector.md)

Operator and architecture docs:

- [Operator handoff](docs/OPERATOR_HANDOFF.md)
- [Frontend route and UX map](docs/FRONTEND.md)
- [Architecture](ARCHITECTURE.md)
- [Product sense](docs/PRODUCT_SENSE.md)

## Common Commands

```bash
npm run lint
npm run typecheck
npm run mcp-runtime:build
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
npm run mcp-inspector-core:test
npm run mmcp:test
npm run mmcp:smoke
npm run test:unit
npm run test:e2e
npm run verify
```

Inspector helpers:

```bash
npm run inspector:ui
npm run inspector:mock
npm run mmcp:smoke
npm run inspector:mcp:none
npm run inspector:cli:list
npm run inspector:cli:call:echo
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
npm run inspector:cli:resources:templates
npm run inspector:cli:prompts:list
npm run inspector:cli:prompts:get
npm run inspector:cli:basic:list
npm run inspector:cli:sse:list
npm run inspector:cli:sse:resources
npm run inspector:cli:sse:resources:read
```

## Public Admin Warning

The admin UI and mutation APIs are intentionally public for mock-server use. Use mock data only. Do not store sensitive customer data, production secrets, or real identity data.

Destructive reset and protected delete flows use root-password or delete-code checks, but this is not an enterprise authorization system.

## Reusable Runtime Package

The reusable JSON-RPC runtime is published on npm as [`@minasoft/mcp-runtime`](https://www.npmjs.com/package/@minasoft/mcp-runtime). The source lives at `packages/mcp-runtime`.

Install it in another TypeScript project:

```bash
npm install @minasoft/mcp-runtime
```

It is intended for TypeScript apps that want to expose their own MCP resources, resource templates, optional tools, optional prompts, and completion without copying the Mock Server's protocol code. The package does not include the Mock Server admin UI, endpoint catalogs, OAuth screens, Prisma schema, audit log, or fixture CRUD.

Before publishing a new package version, verify the package boundary:

```bash
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
```

The consumer test builds the package, packs it, installs the tarball into a temporary external TypeScript project, imports only `@minasoft/mcp-runtime`, and runs `tsc --noEmit`.

## License

Apache-2.0. See [LICENSE](LICENSE).
