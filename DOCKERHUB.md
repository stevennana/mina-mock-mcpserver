# MCP Mock Server

A public remote MCP mock server and web UI for testing MCP tool calls across no-auth, Basic Auth, and mock OAuth Bearer flows.

MCP Mock Server helps developers verify MCP clients, agents, integrations, and auth behavior without connecting to a production MCP service. It includes a browser-based admin UI, configurable mock tools, REST test routes, MCP Streamable HTTP-style JSON-RPC endpoints, Basic Auth users, mock OAuth users/clients/tokens, audit logs, failure simulation, and standalone inspector workflows.

## Features

- MCP endpoints for no-auth, Basic Auth, and OAuth Bearer testing
- Web admin UI for endpoint, auth, token, config, audit, and reset management
- Configurable mock tools with parameters, generated MCP `inputSchema`, response cases, and failure simulation
- REST tool list/call routes for curl and Postman style testing
- Mock OAuth authorization server with browser consent and client credentials flows
- OAuth discovery metadata, protected-resource metadata, JWKS, token listing, and token revocation
- SQLite-backed persistence with deterministic seed defaults
- Docker and reverse-proxy friendly deployment
- Local and standalone inspector support for end-to-end verification

## Quick Start

```bash
docker run --rm -p 3000:3000 \
  -e APP_BASE_URL=http://localhost:3000 \
  -e ROOT_PASSWORD=change-this \
  minasoftai/mcp-mock-server:latest
```

Open the web UI:

```text
http://localhost:3000
```

Check health:

```bash
curl http://localhost:3000/api/health
```

## Docker Compose

```yaml
services:
  mcp-mock-server:
    image: minasoftai/mcp-mock-server:latest
    ports:
      - "3000:3000"
    environment:
      APP_BASE_URL: "http://localhost:3000"
      ROOT_PASSWORD: "change-this"
      LOG_LEVEL: "info"
    volumes:
      - mcp-mock-data:/app/data

volumes:
  mcp-mock-data:
```

Start the container:

```bash
docker compose up -d
```

## Public HTTPS Deployment

For a public deployment, run the container behind Nginx, Caddy, Traefik, or another TLS reverse proxy.

```yaml
services:
  mcp-mock-server:
    image: minasoftai/mcp-mock-server:latest
    restart: unless-stopped
    environment:
      APP_BASE_URL: "https://mcp.example.com"
      ROOT_PASSWORD: "use-a-strong-password"
      LOG_LEVEL: "info"
    volumes:
      - mcp-mock-data:/app/data
    expose:
      - "3000"

volumes:
  mcp-mock-data:
```

Set `APP_BASE_URL` to the final public HTTPS origin so OAuth issuer, audience, discovery metadata, and generated examples match the deployed service.

## Default Seed Data

The server starts with deterministic test fixtures:

| Type | Value |
| --- | --- |
| Endpoint/tool | `echo` |
| Basic user | `default` |
| Basic password | `default` |
| OAuth user | `default` |
| OAuth password | `default` |
| OAuth client | `default` |
| OAuth client secret | `default` |

## MCP Endpoints

| Mode | URL |
| --- | --- |
| No auth | `/mcp/none` |
| Basic Auth | `/mcp/basic` |
| OAuth Bearer | `/mcp/oauth` |

Example no-auth `tools/list` call:

```bash
curl -X POST http://localhost:3000/mcp/none \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Example no-auth `tools/call` call:

```bash
curl -X POST http://localhost:3000/mcp/none \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

Example Basic Auth call:

```bash
curl -X POST http://localhost:3000/mcp/basic \
  -u default:default \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list"}'
```

## REST Tool API

List tools:

```bash
curl http://localhost:3000/rest/tools
```

Call the default `echo` tool:

```bash
curl -X POST http://localhost:3000/rest/tools/echo/call \
  -H 'Content-Type: application/json' \
  -d '{"arguments":{"message":"hello"}}'
```

Basic Auth REST list:

```bash
curl -u default:default http://localhost:3000/rest/tools
```

## OAuth Flow

The mock OAuth server supports browser authorization-code flow and client-credentials flow.

Discovery URLs:

```text
/.well-known/oauth-authorization-server
/.well-known/oauth-protected-resource
/oauth/jwks
```

Authorization URL example:

```text
http://localhost:3000/oauth/authorize?response_type=code&client_id=default&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback&resource=http%3A%2F%2Flocalhost%3A3000&state=demo
```

Default OAuth login:

```text
username: default
password: default
```

Client credentials token example:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d 'client_id=default' \
  -d 'client_secret=default' \
  -d 'resource=http://localhost:3000'
```

Use the returned access token:

```bash
curl -X POST http://localhost:3000/mcp/oauth \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/list"}'
```

## Inspector Verification

From the project repository, run:

```bash
npm run inspector:mock -- --base-url http://localhost:3000
```

For a public deployment:

```bash
npm run inspector:mock -- --base-url https://mcp.minasoftai.com
```

This verifies:

- health and operator config
- OAuth discovery and JWKS
- endpoint create, detail, update, REST call, MCP call, forced error, and cleanup
- Basic user create, runtime auth, disable, rejection, and cleanup
- OAuth user/client/token creation
- Bearer permission filtering
- allowed and denied tool calls
- token revocation
- audit evidence
- invalid reset credential rejection

Root reset is destructive and skipped by default. To verify reset intentionally:

```bash
ROOT_PASSWORD='change-this' npm run inspector:mock -- \
  --base-url http://localhost:3000 \
  --include-reset
```

## Standalone Inspector UI

Run the standalone inspector UI locally:

```bash
npm run inspector:ui
```

Open:

```text
http://127.0.0.1:3200
```

Use it to test either:

- Mock Server scenario: broad end-to-end verification of MCP Mock Server
- Generic MCP target: inspect any compatible MCP Streamable HTTP endpoint

The standalone inspector can target local or remote servers, including Docker deployments.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_BASE_URL` | inferred from request, then `http://localhost:3000` fallback | Public base URL used for OAuth issuer and generated URLs |
| `ROOT_PASSWORD` | unset | Password for protected reset and admin override flows |
| `DATABASE_URL` | `file:./data/runtime.sqlite` | SQLite database URL |
| `PORT` | `3000` in Docker | Server port |
| `HOST` | `0.0.0.0` in Docker | Bind host |
| `LOG_LEVEL` | `info` | Runtime log level |
| `TLS_CERT_FILE` | unset | Optional direct TLS certificate file for local testing |
| `TLS_KEY_FILE` | unset | Optional direct TLS key file for local testing |

## Data Persistence

Use a Docker volume for persistent runtime state:

```yaml
volumes:
  - mcp-mock-data:/app/data
```

The SQLite database stores endpoints, users, clients, authorization codes, issued tokens, audit events, and operator config.

## Reset Defaults

The reset flow restores deterministic seed defaults.

Protected reset requires `ROOT_PASSWORD`.

Open:

```text
http://localhost:3000/reset
```

Reset deletes mutable runtime state and recreates the seed endpoint, Basic user, OAuth user, and OAuth client.

## Useful URLs

| Page | URL |
| --- | --- |
| Home | `/` |
| Endpoints | `/endpoints` |
| Basic users | `/basic-users` |
| OAuth users | `/oauth-users` |
| OAuth clients | `/oauth-clients` |
| Tokens | `/tokens` |
| Config | `/config` |
| Audit | `/audit` |
| Reset | `/reset` |
| Inspector guide | `/inspector` |
| Health | `/api/health` |

## Security Notes

MCP Mock Server is intended for mock testing, integration development, demos, and local/staging verification.

It is not:

- a production identity provider
- a production secrets manager
- a multi-tenant security boundary
- a place to store sensitive customer data

When exposing it publicly:

- Set `APP_BASE_URL` to the final HTTPS origin.
- Set a strong `ROOT_PASSWORD`.
- Prefer a TLS reverse proxy such as Nginx, Caddy, or Traefik.
- Protect the admin UI with your own network, proxy, or access controls if needed.
- Treat generated users, clients, and tokens as mock test data.

## License

Open source project intended for MCP testing and integration workflows.
