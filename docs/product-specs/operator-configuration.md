# Operator Configuration and Deployment

## Goal
The operator can inspect health, connection URLs, base URL behavior, reset with root password, logs, Docker/Nginx guidance, and deterministic startup proof.

## Trigger / Entry
Connection guide

## User-Visible Behavior
- Connection guide
- Config UI is focused on health, effective base URL, root-protected base URL override, and core connection URLs
- Health endpoint reports runtime status, database reachability, log level, and persisted runtime counts without secrets
- Public config endpoint reports the effective base URL, route map, connection examples, public admin warning, health summary, and logging command
- Base URL precedence is `APP_BASE_URL`, database override, forwarded headers, Host, then `http://localhost:3000`
- Root-protected database base URL override
- Root-protected reset
- Reset requires exact confirmation text and records non-secret audit evidence for failed and successful attempts
- Operator-visible logs are written by `npm run start:logged` under `logs/`; `LOG_LEVEL` supports `trace`, `debug`, `info`, `warn`, and `error`
- Built-in HTTPS can be enabled for local protocol/client tests with `TLS_CERT_FILE` and `TLS_KEY_FILE` through `npm run start:tls`; `start:logged` uses the same HTTPS path when those variables are set
- A helper command, `npm run cert:dev`, creates a short-lived self-signed localhost certificate for Mac/Linux test use
- `npm run start:tls:smoke` proves local certificate availability, app-level HTTPS startup, `/api/health`, and public config TLS reporting
- Playwright E2E validation runs against an isolated SQLite database and a dedicated local port separate from the manual development server, so deterministic checks do not require users to stop `npm run dev`
- Browser-facing dates in admin tables use explicit UTC string formatting instead of locale-dependent rendering, preventing server/client hydration mismatches across operator locales
- Connection guide examples cover `/mcp`, `/mcp/none`, `/mcp/basic`, `/mcp/oauth`, `/rest/tools`, `/rest/tools/{tool_name}/call`, OAuth discovery metadata, `/oauth/token`, and `/oauth/jwks`
- Config and Inspector expose copy buttons for operational commands and connection URLs so users can move from UI guidance to terminal/client tests without manual selection errors
- MCP Inspector integration is documented as an external `npx` tool with local Streamable HTTP targets for `/mcp`, `/mcp/none`, `/mcp/basic`, and `/mcp/oauth`
- The Mock UI exposes an `/inspector` verification hub for standalone inspector UI launch, Mock Server scenario execution, local inspector commands, upstream Inspector targets, Basic/OAuth preparation, and diagnostics interpretation
- The Inspector hub exposes authorization-code verification aids generated from current config and OAuth client state: authorization URL, token-exchange curl, Bearer MCP curl, effective base URL source, issuer, token endpoint, selected client, redirect callback origin, and allowed endpoint count
- The standalone inspector UI runs outside the Mock Server app and can inspect any MCP Streamable HTTP endpoint using URL, headers, and optional `tools/call` arguments
- The standalone inspector UI provides a generic-target Authorization helper for no-auth, Basic username/password, and Bearer token requests before merging those values into the standard headers sent to the inspection API
- The standalone inspector UI provides Mock route presets for `/mcp/none`, `/mcp/basic`, and `/mcp/oauth` based on the visible Mock Server base URL, including seeded Basic test credentials only after explicit preset selection
- The standalone inspector UI provides a Mock OAuth `client_credentials` token helper for `/mcp/oauth` preset checks by calling the target Mock Server `/oauth/token` endpoint and filling the Bearer field
- The standalone inspector UI remembers only non-secret local target settings in browser storage and intentionally avoids persisting headers, Basic passwords, Bearer tokens, OAuth client secrets, root passwords, reset choices, and tool argument payloads
- The standalone inspector UI and project-specific inspector expose an explicit self-signed HTTPS option for local app-level TLS tests, without disabling TLS verification globally
- The standalone inspector UI also provides a Mock Server scenario runner that creates temporary data, verifies REST/MCP/Basic/OAuth/token/audit/reset-guard behavior, and cleans up mutable temporary records
- A project-specific local inspector command verifies the main local Mock Server surfaces across admin APIs, REST, MCP, Basic Auth, OAuth, token revocation, audit, and reset guards
- The local inspector prints a final diagnostics report covering target URL, OAuth discovery linkage, MCP protocol negotiation, protocol-version rejection, Origin rejection, Bearer challenge metadata, JWT audience, permission filtering, denial, revocation, and cleanup mode
- Docker Compose exposes port `3000`, persists SQLite at `/app/data`, and keeps logs available at `/app/logs`
- Nginx guidance remains the preferred public TLS path and forwards host and forwarded-proto headers so public base URL resolution remains accurate behind a proxy
- Operator handoff covers one Ralph cycle, unattended loop operation, status files, artifacts, logs, and next-queue creation after queue exhaustion

## Validation
- Base URL precedence
- Root password checks
- Seed default recreation for currently implemented endpoint defaults
- Log-level filtering without secret leakage
- Health/config page renders, root reset restores defaults, production-style startup smoke passes
- E2E startup does not collide with the default development server port
- Date and datetime displays are deterministic between server-rendered and client-rendered UI
- Docker/Nginx examples match the documented routes, port `3000`, and SQLite persistence expectations
- TLS runtime config reports whether app-level HTTPS certificate and key inputs are configured without exposing certificate material or passphrases
- TLS startup smoke checks must pass against a self-signed local HTTPS server with scoped insecure verification
- Inspector helper scripts and config target the documented local MCP routes without vendoring upstream Inspector source
- Inspector hub E2E checks cover authorization-code guidance and base URL diagnostics in addition to command/target rendering
- The project-specific inspector can run without root credentials by default and only performs destructive root reset when explicitly requested
- The local inspector diagnostics report must fail the command when protocol-facing invariants are missing, not merely print warnings
