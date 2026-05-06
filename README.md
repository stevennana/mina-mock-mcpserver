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
`npm run db:prepare` is idempotent: it creates missing seed defaults but does not delete existing local endpoints, clients, tokens, or audit events. Use reset when you want a clean seeded runtime.

## Verify Everything Locally

### Standalone Inspector UI

Use the standalone Inspector UI when you want a local browser page for either a broad Mock Server scenario or a portable MCP endpoint check:

```bash
npm run inspector:ui
```

Open:

```text
http://127.0.0.1:3200
```

For the broad Mock Server scenario, keep the default base URL:

```text
http://127.0.0.1:3100
```

Then click **Run Mock Server scenario**. The UI creates temporary endpoint, Basic user, OAuth user, OAuth client, and token records; verifies the main REST/MCP/Auth flows; and cleans up mutable temporary records when it finishes.

The scenario covers:

- health, public config, OAuth discovery metadata, protected-resource metadata, and JWKS
- endpoint create/detail/update, REST list/call, MCP list/call, forced-error response case, and cleanup
- Basic Auth creation, strict Basic MCP success, disabled-user rejection, and cleanup
- OAuth `client_credentials`, Bearer permission filtering, allowed call, denied call, token listing, revocation, and revoked-token rejection
- audit evidence and invalid reset-credential rejection

Root reset is skipped unless you explicitly enable the destructive reset checkbox and provide the root password.

This broad scenario is the fastest user-facing proof that the standalone Inspector can reach the Mock Server and exercise the server's protocol/runtime surfaces. It intentionally uses the non-interactive OAuth `client_credentials` grant so the whole scenario can run from one button. To verify the browser authorization-code and consent flow, follow **Step 4: Test OAuth Bearer Permissions** below.

For a portable generic MCP check, enter an MCP endpoint URL such as:

```text
http://127.0.0.1:3100/mcp/none
```

Then click **Run generic inspection**. The page runs from its own lightweight local server, so browser CORS does not block calls to local MCP targets. It checks:

- `initialize`
- `tools/list`
- optional `tools/call`
- protocol-version response evidence
- an unsupported protocol-version probe

Use the **Extra headers JSON** field for Basic, Bearer, API key, or custom headers:

```json
{"Authorization":"Bearer ey..."}
```

If your target is a local HTTPS server with a self-signed certificate, enable **Allow self-signed HTTPS for this run**. Keep it off for public or production-like targets.

Use a different port if `3200` is already taken:

```bash
npm run inspector:ui -- --port 3201
```

### Mock Server Full Smoke Inspector

After the server is running, use the project-specific local inspector to confirm that the Mock Server works from a user's machine:

```bash
npm run inspector:mock
```

The inspector connects to `http://127.0.0.1:3100`, creates temporary test data, exercises the public runtime paths, and removes mutable test records before it exits.
It also prints a final protocol diagnostics report so users can confirm the target URL, OAuth discovery linkage, MCP protocol negotiation, Bearer challenge metadata, JWT audience, permission filtering, denial, revocation, and cleanup mode in one place.

It verifies:

- health and public operator config
- OAuth discovery metadata and JWKS
- endpoint create, detail, update, REST call, MCP call, forced error, and cleanup
- Basic Auth user creation, strict Basic MCP access, disable behavior, and cleanup
- OAuth user/client creation, `client_credentials` token issuance, Bearer permission filtering, denied calls, token listing, revocation, and revoked-token rejection
- audit evidence and reset denial for invalid root credentials

Expected ending:

```text
== Protocol diagnostics
...
Inspector completed successfully.
```

Use a different target when testing a production-style local server or container:

```bash
npm run inspector:mock -- --base-url http://127.0.0.1:3000
```

Use `--insecure-tls` only for local HTTPS targets that use a self-signed or untrusted certificate:

```bash
npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls
```

Root reset is destructive, so the inspector skips it by default. Only include it when you intentionally want to verify reset behavior:

```bash
ROOT_PASSWORD='change-this' npm run inspector:mock -- --include-reset
```

Audit entries and issued-token history may remain as non-secret evidence. Temporary endpoint, Basic user, OAuth user, and OAuth client records are cleaned up.

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
If your local database already contains previous test records, they will remain after `db:prepare`. For a clean manual demo, use the reset flow below with `ROOT_PASSWORD` set, or remove the local SQLite file before preparing state.

## Step 1: Create Or Edit A Mock Tool

1. Open `http://127.0.0.1:3100/endpoints`.
2. Select the seeded `echo` endpoint to open its overview, or click **Create** to add a new endpoint.
3. Use the endpoint sub-navigation for the task you need:
   - **Edit** for name, description, enabled state, and delete code.
   - **Parameters** for up to three parameters and the generated MCP `inputSchema`.
   - **Responses** for the default response and exact `matchArgsJson` response cases.
   - **Failure** for delay, forced error, malformed JSON, wrong content type, or empty body behavior.
   - **Console** for REST/MCP test evidence.
4. Save each focused page before moving to the next one.

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
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

List MCP tools:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call the seeded `echo` tool:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

Use the strict Basic route:

```bash
curl -X POST http://127.0.0.1:3100/mcp/basic \
  -u default:default \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
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
6. Copy the `code` from the redirect URL. The default redirect URI points to `http://localhost:3000/oauth/callback`; if nothing is listening there, your browser may show a "site can't be reached" page. That is expected for this mock flow. Copy the `code` query parameter from that failed callback URL.
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
     -H 'accept: application/json, text/event-stream' \
     -H 'MCP-Protocol-Version: 2025-06-18' \
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
3. Open the endpoint's **Failure** page.
4. Configure delay, forced error, malformed JSON, wrong content type, or empty body behavior.
5. Save the endpoint.
6. Open the endpoint's **Console** page, or call it through REST or MCP.
7. Check `http://127.0.0.1:3100/audit` for failure-simulation evidence.

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
| `TLS_CERT_FILE` | unset | PEM certificate path for app-level HTTPS test starts |
| `TLS_KEY_FILE` | unset | PEM private key path for app-level HTTPS test starts |
| `TLS_CA_FILE` | unset | Optional CA bundle path for app-level HTTPS test starts |
| `TLS_KEY_PASSPHRASE` | unset | Optional private-key passphrase for app-level HTTPS test starts |
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

## Local App-Level TLS

Nginx or another reverse proxy is still the preferred TLS termination layer for public deployments. For local protocol/client tests, you can run MCP Mock Server directly over HTTPS.

Create a short-lived self-signed localhost certificate:

```bash
npm run cert:dev
```

Build, prepare state, and start the HTTPS server:

```bash
npm run build
npm run db:prepare
TLS_CERT_FILE=certs/localhost-cert.pem \
TLS_KEY_FILE=certs/localhost-key.pem \
PORT=3443 \
APP_BASE_URL=https://127.0.0.1:3443 \
npm run start:tls
```

Then open:

```text
https://127.0.0.1:3443
```

Self-signed certificates are not trusted by default. Browser and curl clients may require a local trust exception or `curl -k`:

```bash
curl -k https://127.0.0.1:3443/api/health
```

Use the same TLS variables with logged operation when you want HTTPS plus `logs/` output:

```bash
TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 npm run start:logged
```

Run the automated TLS startup smoke check when you want to prove certificate generation, HTTPS startup, health, and public config TLS reporting in one command:

```bash
npm run start:tls:smoke
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
- Use app-level TLS only for local tests or controlled integration labs; prefer the reverse proxy for public TLS.
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

`npm run test:e2e` starts its own isolated Playwright server on `http://127.0.0.1:3101` with `data/e2e-runtime.sqlite`, so it can run while your manual `npm run dev` server remains on `http://127.0.0.1:3100`.
Set a different E2E port only if `3101` is already in use:

```bash
E2E_PORT=3111 npm run test:e2e
```

## Public Admin Warning

The admin UI and mutation APIs are intentionally public for the MVP. Use this server for mock data, demos, QA, and integration testing. Do not store sensitive customer data, production secrets, or real identity data.
