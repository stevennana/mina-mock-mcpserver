# Getting Started

This guide walks a new user from local startup to end-to-end verification.

For the high-level feature list, see [Feature overview](FEATURES.md). For raw MCP/SSE/REST/OAuth calls, see [Transports](TRANSPORTS.md).

## 1. Start Locally

Install dependencies:

```bash
npm install
```

Prepare SQLite state and seed defaults:

```bash
npm run db:prepare
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3100
```

Check health:

```bash
curl http://127.0.0.1:3100/api/health
```

## 2. Confirm The Seeded Tool

List REST tools:

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

## 3. Create Or Edit A Mock Tool

1. Open `http://127.0.0.1:3100/endpoints`.
2. Select `echo`, or click **New endpoint**.
3. Use the endpoint sub-pages:
   - **Overview** for current status
   - **Edit** for name, title, description, enabled state, and delete code
   - **Parameters** for input fields and MCP `inputSchema`
   - **Responses** for default and exact-match cases
   - **Failure** for delay/error/malformed behavior
   - **Console** for request/response evidence
   - **Delete** for protected deletion

The endpoint `name` is the MCP tool name and REST tool name.

## 4. Run The Full Project Inspector

Start the standalone Inspector UI:

```bash
npm run inspector:ui
```

Open:

```text
http://127.0.0.1:3200
```

Use **Mock Server scenario** with base URL:

```text
http://127.0.0.1:3100
```

Click **Run Mock Server scenario**.

The scenario verifies:

- health and public config
- OAuth discovery and JWKS
- endpoint create/detail/update
- REST list/call/forced error
- MCP initialize/list/call/protocol guard
- MCP resources/list, resources/read, resources/templates/list, prompts/list, prompts/get, and completion/complete
- legacy SSE resources/subscribe and resource update notifications
- Basic Auth runtime
- OAuth Bearer runtime, tool/resource/prompt permission filtering, denial, token listing, revocation
- audit evidence and reset guard
- cleanup of temporary mutable records

Root reset is skipped unless you explicitly enable it and provide `ROOT_PASSWORD`.

## 5. Inspect One Generic MCP Target

Open:

```text
http://127.0.0.1:3200/generic
```

Use a target such as:

```text
http://127.0.0.1:3100/mcp/none
```

Click **Run generic inspection**.

The page checks `initialize`, one selected MCP method preset, response header evidence, and unsupported protocol-version behavior.

Use **MCP method preset** for:

- `tools/list` with optional `tools/call`
- `resources/list`
- `resources/read`
- `resources/templates/list`
- `prompts/list`
- `prompts/get`
- `completion/complete` for prompt arguments
- `completion/complete` for resource-template arguments

Use route presets for:

- Mock no-auth `/mcp/none`
- Mock Basic `/mcp/basic`
- Mock OAuth `/mcp/oauth`

## 6. Verify Browser OAuth Login And Consent

Open:

```text
http://127.0.0.1:3200/oauth
```

Use base URL:

```text
http://127.0.0.1:3100
```

Click **Start popup OAuth flow**.

If the browser blocks popups, use **Continue in this tab**.

Log in with:

```text
default / default
```

Approve endpoint access. The Inspector exchanges the code with PKCE S256 and sends the Bearer token to **Generic MCP Target** for the final `/mcp/oauth` call.

## 7. Use Upstream MCP Inspector

Start upstream Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Open a no-auth Streamable HTTP target:

```text
http://localhost:6274/?transport=streamable-http&serverUrl=http%3A%2F%2F127.0.0.1%3A3100%2Fmcp%2Fnone
```

Open a no-auth legacy SSE target:

```text
http://localhost:6274/?transport=sse&serverUrl=http%3A%2F%2F127.0.0.1%3A3100%2Fsse%2Fnone
```

More upstream Inspector examples are in [MCP Browser Inspector guide](../MCPBrowserInspector.md).

Upstream Inspector CLI `0.21.2` supports tools, resources, and prompts:

```bash
npm run inspector:cli:list
npm run inspector:cli:call:echo
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
npm run inspector:cli:resources:templates
npm run inspector:cli:prompts:list
npm run inspector:cli:prompts:get
npm run inspector:cli:sse:list
npm run inspector:cli:sse:resources
npm run inspector:cli:sse:resources:read
```

For `completion/complete`, use the project Generic target preset or upstream browser Inspector if your installed Inspector version exposes Completion controls.

## 8. Inspect The Runtime Package Boundary

MCP Mock Server consumes the `@minasoft/mcp-runtime` package boundary for reusable JSON-RPC method handling. Build, pack, and test the package directly with:

```bash
npm run mcp-runtime:build
npm run mcp-runtime:test
npm run mcp-runtime:pack
npm run mcp-runtime:consumer:test
```

`npm run mcp-runtime:consumer:test` installs the packed runtime into a temporary external TypeScript project and verifies that public exports and generated declaration files work without app-local aliases.

Downstream consumption guidance, API stability notes, and a Next.js Fetch route example are in [MCP runtime package](MCP_RUNTIME_PACKAGE.md).

## 9. Inspect Tokens And Audit Events

Open:

```text
http://127.0.0.1:3100/tokens
http://127.0.0.1:3100/audit
```

Use Tokens to inspect claims, endpoint permissions, expiry, grant type, status, and revocation.

Use Audit to filter mutation and security-relevant evidence. Audit loading is incremental; it does not force-load the entire event history.

## 10. Reset Local State

Set a root password:

```bash
ROOT_PASSWORD='change-this' npm run dev
```

Open:

```text
http://127.0.0.1:3100/reset
```

Enter the exact confirmation text and root password.

Reset deletes mutable runtime state and recreates seeded defaults.

## 11. Production-Style Local Start

```bash
npm run build
npm run db:prepare
PORT=3000 HOST=0.0.0.0 ROOT_PASSWORD='change-this' LOG_LEVEL=info npm run start:logged
```

Then open:

```text
http://127.0.0.1:3000
```

## 12. Local HTTPS Test Start

Create a localhost certificate:

```bash
npm run cert:dev
```

Build, prepare, and start HTTPS:

```bash
npm run build
npm run db:prepare
TLS_CERT_FILE=certs/localhost-cert.pem \
TLS_KEY_FILE=certs/localhost-key.pem \
PORT=3443 \
APP_BASE_URL=https://127.0.0.1:3443 \
npm run start:tls
```

Self-signed certificates need a local browser trust exception or `curl -k`.

## 13. Validation Commands

```bash
npm run lint
npm run typecheck
npm run mcp-runtime:test
npm run mcp-runtime:consumer:test
npm run build
npm run test:unit
npm run test:e2e
npm run start:smoke
npm run verify
```

`npm run test:e2e` starts an isolated Playwright server on `http://127.0.0.1:3101` with `data/e2e-runtime.sqlite`.
