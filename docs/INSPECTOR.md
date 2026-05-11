# MCP Inspector Integration

## Purpose

MCP Mock Server integrates with the upstream MCP Inspector as the recommended interactive MCP protocol debugger.
The Inspector is used as an external tool through `npx`; this repository does not vendor or fork Inspector source code.

This keeps the mock server focused on its own runtime, REST, OAuth, admin UI, audit, and persistence behavior while still giving users a familiar MCP-native debugger for `initialize`, `tools/list`, and `tools/call`.

This repository provides two local inspector paths:

- a standalone Inspector UI that can inspect any MCP Streamable HTTP endpoint, even when the target is not this Mock Server
- a Mock Server scenario runner, available from both the standalone UI and the project-specific CLI, for full mock-server smoke coverage across HTTP admin APIs, REST, MCP, Basic Auth, OAuth, tokens, audit, and reset guards

The Mock Server admin UI also includes `/inspector`, a focused verification hub that collects the standalone UI command, local inspector commands, upstream Inspector targets, Basic/OAuth setup steps, and protocol diagnostics guidance in one place.
The hub also renders an authorization-code guide from the current base URL and configured OAuth clients: authorization URL, token-exchange curl, Bearer MCP curl, issuer/token endpoint diagnostics, selected client, redirect callback origin, and allowed endpoint count.

## What Inspector Covers

Use Inspector for:

- MCP Streamable HTTP connections to `/mcp`, `/mcp/none`, `/mcp/basic`, and `/mcp/oauth`
- capability negotiation through `initialize`
- enabled tool discovery through `tools/list`
- generated tool schema inspection
- tool calls through `tools/call`
- MCP error inspection for invalid params, unknown tools, forbidden OAuth permissions, and configured failure behavior

Use the admin UI, curl, Playwright, or future project-specific smoke clients for:

- REST-only routes such as `/rest/tools` and `/rest/tools/{tool_name}/call`
- endpoint/user/client/token/config/reset/audit administration
- OAuth login and consent flow setup
- token issuance and revocation
- health, startup, Docker, and Nginx verification

## Standalone Inspector UI

Run this when you want a local web page that can inspect any MCP Streamable HTTP endpoint:

```bash
npm run inspector:ui
```

Open:

```text
http://127.0.0.1:3200
```

The page is served by `scripts/standalone-inspector-server.mjs`, independently from the Next.js Mock Server app. It accepts:

- MCP endpoint URL
- MCP protocol version
- Mock Server route presets for `/mcp/none`, `/mcp/basic`, and `/mcp/oauth`
- an Authorization helper for no-auth, Basic username/password, or Bearer token calls
- a Mock OAuth token helper that issues a standard `client_credentials` token from the configured Mock Server base URL and fills the Bearer token field
- extra headers as JSON for API keys or custom local server requirements
- an opt-in self-signed HTTPS mode for local certificates created with `npm run cert:dev` or similar tooling
- optional tool name and JSON arguments for `tools/call`

The standalone page remembers recent target URLs, protocol version, self-signed TLS preference, and tool name in browser `localStorage` so repeated local checks are quicker. It does not persist extra headers, Basic passwords, Bearer tokens, OAuth client secrets, tool arguments, root passwords, access tokens, or reset choices.

The standalone UI has two modes.

Generic MCP mode performs standard-facing checks against any compatible MCP HTTP target:

- `initialize`
- `tools/list`
- optional `tools/call`
- response protocol header evidence
- intentionally unsupported protocol-version probe

This mode does not require Mock Server admin APIs, REST routes, OAuth setup APIs, token APIs, audit, reset, or database state. Use it for any compatible MCP HTTP target where you need a quick local pass/fail page.

Mock Server scenario mode expects a running MCP Mock Server base URL and drives the richer product flow from the browser:

- health, operator config, OAuth discovery metadata, protected-resource metadata, and JWKS
- temporary endpoint creation, detail read, update, REST list/call, MCP list/call, forced-error case, and cleanup
- temporary Basic user creation, strict Basic MCP success, disable behavior, and rejection
- temporary OAuth user/client creation, `client_credentials` token issuance, Bearer permission filtering, allowed call, denied call, token listing, revocation, and revoked-token rejection
- audit evidence and invalid reset-credential rejection

The UI scenario runner intentionally skips destructive root reset unless an operator explicitly enables it and provides the root password.
The self-signed HTTPS checkbox should be used only for local targets under your control, such as `https://127.0.0.1:3443` from `npm run start:tls`.

If port `3200` is already taken:

```bash
npm run inspector:ui -- --port 3201
```

## Project Local Inspector

Run the project-specific inspector when you want the same Mock Server scenario coverage from a command line:

```bash
npm run inspector:mock
```

It connects to `http://127.0.0.1:3100` by default and verifies:

- health and public operator config
- OAuth discovery metadata and JWKS
- protocol diagnostics for target URL, OAuth discovery linkage, MCP version negotiation, MCP protocol-version rejection, Origin rejection, Bearer challenge metadata, JWT audience, permission filtering, denial, revocation, and cleanup mode
- endpoint create/detail/update/delete
- REST tool list, exact-match call, and forced-error call
- no-auth MCP `tools/list` and `tools/call`
- Basic user create/disable/delete plus REST and strict MCP Basic calls
- OAuth user/client create/update/delete
- OAuth `client_credentials` token issuance
- Bearer permission filtering, allowed call, denied call, issued-token listing, revocation, and revoked-token rejection
- audit evidence for inspector-created activity
- root reset denial for invalid credentials

At the end of a successful run, the local inspector prints a compact diagnostics report. Treat this report as the user-facing proof that the target is speaking standard-facing MCP/OAuth behavior rather than only passing project-internal happy paths.

Use a different target with:

```bash
npm run inspector:mock -- --base-url http://127.0.0.1:3000
```

For a local app-level HTTPS target with a self-signed certificate:

```bash
npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls
```

Root reset is intentionally skipped by default because it is destructive. To include it:

```bash
ROOT_PASSWORD='change-this' npm run inspector:mock -- --include-reset
```

The local inspector creates temporary endpoint, user, client, and token records, then removes the mutable records before exiting. Audit and token history may remain as non-secret evidence, matching the product's audit behavior.

## Interoperability Roadmap

The current v1 mock server intentionally focuses on tools over Streamable HTTP `POST`, Basic Auth, and mock OAuth Bearer permissions. The next compatibility updates should land in this order:

1. Keep the standalone UI scenario runner and CLI inspector aligned so users can choose either visible browser evidence or terminal evidence.
2. Add scenario presets for external MCP targets where a server advertises tools but does not support Mock Server admin setup.
3. Add an opt-in OAuth resource strict mode so clients can verify audience/resource mismatches before integrating with production services.
4. Add OAuth PKCE `S256` support and advertise it only after authorization-code storage, token exchange, tests, and docs all support it.
5. Add Docker/Nginx discovery smoke coverage for forwarded host/proto, `APP_BASE_URL`, OAuth metadata, and Bearer `resource_metadata` correctness behind a proxy.
6. Treat MCP sessions, GET SSE streams, and DELETE session termination as a separate Phase 2 transport feature, not a small extension of the current stateless `POST` runtime.

## Local Setup

Start MCP Mock Server first:

```bash
npm run db:prepare
npm run dev
```

Then launch Inspector against the no-auth MCP route:

```bash
npm run inspector:mcp:none
```

The Inspector UI runs on its own local ports, normally `6274` for the browser client and `6277` for the proxy.
Keep those ports bound to localhost. The Inspector proxy can launch local commands and connect to arbitrary MCP targets, so it must not be exposed to untrusted networks.

## Configured Targets

This repository provides `config/mcp-inspector.local.json` with local Streamable HTTP targets:

- `mina-mock-none` -> `http://127.0.0.1:3100/mcp/none`
- `mina-mock-unified` -> `http://127.0.0.1:3100/mcp`
- `mina-mock-basic` -> `http://127.0.0.1:3100/mcp/basic`
- `mina-mock-oauth` -> `http://127.0.0.1:3100/mcp/oauth`

For Basic and OAuth targets, add the `Authorization` header in Inspector or use the CLI examples below.

## CLI Examples

List no-auth MCP tools:

```bash
npm run inspector:cli:list
```

Call the seeded `echo` tool:

```bash
npm run inspector:cli:call:echo
```

List tools through strict Basic Auth with the seeded `default` / `default` user:

```bash
npm run inspector:cli:basic:list
```

For OAuth:

1. Issue an access token from `/oauth/token` using `client_credentials` or the browser authorization-code flow.
2. Run Inspector CLI with a Bearer header:

```bash
npx -y @modelcontextprotocol/inspector@0.21.2 \
  --cli http://127.0.0.1:3100/mcp/oauth \
  --transport http \
  --method tools/list \
  --header "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE"
```

## Licensing Note

The upstream Inspector project is currently in a licensing transition. Its LICENSE file describes Apache-2.0 for new and relicensed contributions, MIT for contributions not yet relicensed, and CC-BY-4.0 for documentation outside specifications.

Because this project uses Inspector through `npx` instead of copying its source, this repository does not redistribute Inspector code. If a future task vendors, forks, or modifies Inspector source, that task must preserve upstream license text, attribution, notices, and changed-file markings.
