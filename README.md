# MCP Mock Server

MCP Mock Server is a public remote MCP mock server and web UI for testing no-auth, Basic Auth, and mock OAuth bearer tool calls.

Use it when you need a repeatable test target for MCP clients, agent integrations, curl/Postman checks, OAuth permission handling, failure simulation, and audit evidence.

## What You Get

- Public admin UI for mock endpoint, Basic user, OAuth user/client, token, config, reset, and audit management
- MCP JSON-RPC routes at `/mcp`, `/mcp/none`, `/mcp/basic`, and `/mcp/oauth`
- REST tool routes for curl and Postman style testing
- Mock OAuth authorization server with browser consent, authorization-code exchange, client-credentials exchange, discovery metadata, and JWKS
- MCP Inspector helper config and scripts for interactive MCP protocol debugging
- SQLite persistence with deterministic seed defaults
- Operator health, reset, logs, Docker Compose, and Nginx examples

## Requirements

- Node.js 22 LTS
- npm
- Chromium dependencies for Playwright if you plan to run E2E tests
- Docker, optional, for containerized operation

## Quick Start

1. Install dependencies.

   ```bash
   npm install
   ```

2. Prepare the SQLite database and seed defaults.

   ```bash
   npm run db:prepare
   ```

3. Start the local development server.

   ```bash
   npm run dev
   ```

4. Open the admin UI.

   ```text
   http://127.0.0.1:3100
   ```

5. Check health.

   ```bash
   curl http://127.0.0.1:3100/api/health
   ```

The local development server uses port `3100`. Docker Compose exposes port `3000`.

## Seed Defaults

After `npm run db:prepare`, the app creates:

- Endpoint: `echo`
- Endpoint parameter: `message`
- Exact-match response case: `{"message":"hello"}` returns `{"ok":true,"message":"world"}`
- Default Basic user: `default` / `default`
- Default OAuth login user: `default` / `default`
- Default OAuth client: `default` / `default`
- Default OAuth redirect URI: `http://localhost:3000/oauth/callback`

The built-in Basic user, OAuth user, OAuth client, and default endpoint are protected from normal destructive changes.

## Step 1: Create Or Edit A Mock Tool

1. Open `http://127.0.0.1:3100/endpoints`.
2. Select the seeded `echo` endpoint, or create a new endpoint.
3. Configure up to three parameters.
4. Add response cases with exact `matchArgsJson` values.
5. Save the endpoint.
6. Use the endpoint console on the same screen to preview schema and call evidence.

The tool name is the endpoint `name`. For example, the seeded endpoint is called as `echo`.

## Step 2: Call A Tool Through REST

List enabled tools:

```bash
curl http://127.0.0.1:3100/rest/tools
```

Call the seeded `echo` tool:

```bash
curl -X POST http://127.0.0.1:3100/rest/tools/echo/call \
  -H 'content-type: application/json' \
  -d '{"arguments":{"message":"hello"}}'
```

Expected response:

```json
{"ok":true,"message":"world"}
```

Call with Basic Auth:

```bash
curl -u default:default http://127.0.0.1:3100/rest/tools
```

## Step 3: Call A Tool Through MCP

### Full Local Mock Server Inspection

Run the project-specific local inspector to verify the main Mock Server surfaces end to end:

```bash
npm run inspector:mock
```

It creates temporary local test records, exercises health, config, REST, MCP, Basic Auth, OAuth client credentials, token revocation, audit, and reset denial, then cleans up the mutable test records.

Use a different server URL:

```bash
npm run inspector:mock -- --base-url http://127.0.0.1:3000
```

Root reset is destructive and skipped by default:

```bash
ROOT_PASSWORD='change-this' npm run inspector:mock -- --include-reset
```

### With MCP Inspector

Start the local server, then launch the upstream MCP Inspector against the no-auth MCP route:

```bash
npm run inspector:mcp:none
```

Use Inspector to run `initialize`, inspect `tools/list`, review generated schemas, and call tools through `tools/call`.
This project keeps Inspector as an external `npx` tool instead of vendoring its source.

Quick CLI checks:

```bash
npm run inspector:cli:list
npm run inspector:cli:call:echo
npm run inspector:cli:basic:list
```

See `docs/INSPECTOR.md` for the full local inspector, OAuth Bearer examples, configured targets, security notes, and licensing notes.

### With curl

Initialize the no-auth MCP route:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

List MCP tools:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call the seeded `echo` tool:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

Use the strict Basic route:

```bash
curl -X POST http://127.0.0.1:3100/mcp/basic \
  -u default:default \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/list"}'
```

## Step 4: Test OAuth Bearer Permissions

For browser authorization-code flow:

1. Open `http://127.0.0.1:3100/oauth-clients`.
2. Create or inspect a client and make sure it allows the endpoint you want to test.
3. Start an authorization request in the browser:

   ```text
   http://127.0.0.1:3100/oauth/authorize?response_type=code&client_id=default&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback&resource=http%3A%2F%2F127.0.0.1%3A3100&state=demo
   ```

4. Log in with `default` / `default`.
5. Select endpoint permissions on the consent page.
6. Copy the `code` from the redirect URL.
7. Exchange the code for a token:

   ```bash
   curl -X POST http://127.0.0.1:3100/oauth/token \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d 'grant_type=authorization_code' \
     -d 'code=PASTE_CODE_HERE' \
     -d 'redirect_uri=http://localhost:3000/oauth/callback' \
     -d 'client_id=default' \
     -d 'client_secret=default'
   ```

8. Call the OAuth MCP route:

   ```bash
   curl -X POST http://127.0.0.1:3100/mcp/oauth \
     -H 'content-type: application/json' \
     -H 'authorization: Bearer PASTE_ACCESS_TOKEN_HERE' \
     -d '{"jsonrpc":"2.0","id":5,"method":"tools/list"}'
   ```

For non-interactive client credentials:

```bash
curl -X POST http://127.0.0.1:3100/oauth/token \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d 'client_id=default' \
  -d 'client_secret=default' \
  -d 'resource=http://127.0.0.1:3100'
```

OAuth tokens are permission-bound. Valid tokens without a selected endpoint return `403` for that endpoint. Invalid, expired, revoked, or mismatched tokens return `401`.

## Step 5: Inspect Tokens And Audit Events

1. Open `http://127.0.0.1:3100/tokens`.
2. Filter by status, grant type, subject, or client.
3. Open a token to inspect claims and endpoint permissions.
4. Revoke a token to make future Bearer calls fail.
5. Open `http://127.0.0.1:3100/audit` to inspect mutation and security-relevant evidence.

Raw access tokens are shown only at issuance. Stored token records keep metadata and `jti`, not the raw token value.

## Step 6: Simulate Failures

1. Open `http://127.0.0.1:3100/endpoints`.
2. Select an endpoint.
3. Configure delay, forced error, malformed JSON, wrong content type, or empty body behavior.
4. Save the endpoint.
5. Call it from the endpoint console, REST, or MCP route.
6. Check `http://127.0.0.1:3100/audit` for failure-simulation evidence.

Delays are bounded to protect the test server from unbounded waits.

## Operator Configuration

Set a root password before using reset or base URL override flows:

```bash
ROOT_PASSWORD='change-this' npm run dev
```

Useful environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./data/runtime.sqlite` | SQLite database path |
| `PORT` | `3100` for helper scripts, `3000` in Docker | Server port |
| `HOST` | `127.0.0.1` for logged start, `0.0.0.0` in Docker | Bind host |
| `APP_BASE_URL` | inferred from request, then `http://localhost:3000` fallback | Public issuer and URL generation |
| `ROOT_PASSWORD` | unset | Reset, delete override, and base URL override password |
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, or `error` |
| `OAUTH_JWT_PRIVATE_KEY_PEM` | development key | RS256 signing key for mock OAuth tokens |

If `APP_BASE_URL` is set, it takes precedence over the database base URL override and request headers.

## Production-Style Local Start

Build, prepare state, start a logged server, and write logs under `logs/`:

```bash
npm run build
npm run db:prepare
PORT=3000 HOST=0.0.0.0 ROOT_PASSWORD='change-this' LOG_LEVEL=info npm run start:logged
```

Then open:

```text
http://127.0.0.1:3000
```

Run a startup smoke check:

```bash
npm run start:smoke
```

## Docker Compose

1. Edit `docker-compose.yml`.
2. Change `ROOT_PASSWORD`.
3. Set `APP_BASE_URL` to the public origin if exposing the server.
4. Start the server.

```bash
docker compose up --build
```

The compose setup persists SQLite data in the `mcp-mock-data` volume and logs in the `mcp-mock-logs` volume.

## Nginx

Use `deploy/nginx.conf` as a starting point when proxying to a server on `127.0.0.1:3000`.

For public deployments:

- Terminate TLS with your certificate tooling.
- Forward `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`.
- Set `APP_BASE_URL` to the final public `https://` origin when possible.
- Do not store sensitive customer data in this mock server.

## Reset To Defaults

1. Set `ROOT_PASSWORD`.
2. Open `http://127.0.0.1:3100/reset`.
3. Enter the exact confirmation text shown by the UI.
4. Enter the root password.
5. Submit reset.

Reset deletes mutable runtime state and recreates the seed endpoint, Basic user, OAuth user, and OAuth client.

## Validation

Run the full deterministic gate:

```bash
npm run verify
```

Run smaller checks while iterating:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm run start:smoke
```

## Public Admin Warning

The admin UI and mutation APIs are intentionally public for the MVP. Use this server for mock data, demos, QA, and integration testing. Do not store sensitive customer data, production secrets, or real identity data.
