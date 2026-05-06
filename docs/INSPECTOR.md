# MCP Inspector Integration

## Purpose

MCP Mock Server integrates with the upstream MCP Inspector as the recommended interactive MCP protocol debugger.
The Inspector is used as an external tool through `npx`; this repository does not vendor or fork Inspector source code.

This keeps the mock server focused on its own runtime, REST, OAuth, admin UI, audit, and persistence behavior while still giving users a familiar MCP-native debugger for `initialize`, `tools/list`, and `tools/call`.

This repository also provides a project-specific local inspector script for full mock-server smoke coverage across HTTP admin APIs, REST, MCP, Basic Auth, OAuth, tokens, audit, and reset guards.

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

## Project Local Inspector

Run the project-specific inspector when you want one command to prove the local Mock Server works end to end:

```bash
npm run inspector:mock
```

It connects to `http://127.0.0.1:3100` by default and verifies:

- health and public operator config
- OAuth discovery metadata and JWKS
- endpoint create/detail/update/delete
- REST tool list, exact-match call, and forced-error call
- no-auth MCP `tools/list` and `tools/call`
- Basic user create/disable/delete plus REST and strict MCP Basic calls
- OAuth user/client create/update/delete
- OAuth `client_credentials` token issuance
- Bearer permission filtering, allowed call, denied call, issued-token listing, revocation, and revoked-token rejection
- audit evidence for inspector-created activity
- root reset denial for invalid credentials

Use a different target with:

```bash
npm run inspector:mock -- --base-url http://127.0.0.1:3000
```

Root reset is intentionally skipped by default because it is destructive. To include it:

```bash
ROOT_PASSWORD='change-this' npm run inspector:mock -- --include-reset
```

The local inspector creates temporary endpoint, user, client, and token records, then removes the mutable records before exiting. Audit and token history may remain as non-secret evidence, matching the product's audit behavior.

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
