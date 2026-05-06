# Operator Configuration and Deployment

## Goal
The operator can inspect health, connection URLs, base URL behavior, reset with root password, logs, Docker/Nginx guidance, and deterministic startup proof.

## Trigger / Entry
Connection guide

## User-Visible Behavior
- Connection guide
- Health endpoint reports runtime status, database reachability, log level, and persisted runtime counts without secrets
- Public config endpoint reports the effective base URL, route map, connection examples, public admin warning, health summary, and logging command
- Base URL precedence is `APP_BASE_URL`, database override, forwarded headers, Host, then `http://localhost:3000`
- Root-protected database base URL override
- Root-protected reset
- Reset requires exact confirmation text and records non-secret audit evidence for failed and successful attempts
- Operator-visible logs are written by `npm run start:logged` under `logs/`; `LOG_LEVEL` supports `trace`, `debug`, `info`, `warn`, and `error`
- Playwright E2E validation runs against an isolated SQLite database and a dedicated local port separate from the manual development server, so deterministic checks do not require users to stop `npm run dev`
- Browser-facing dates in admin tables use explicit UTC string formatting instead of locale-dependent rendering, preventing server/client hydration mismatches across operator locales
- Connection guide examples cover `/mcp`, `/mcp/none`, `/mcp/basic`, `/mcp/oauth`, `/rest/tools`, `/rest/tools/{tool_name}/call`, OAuth discovery metadata, `/oauth/token`, and `/oauth/jwks`
- MCP Inspector integration is documented as an external `npx` tool with local Streamable HTTP targets for `/mcp`, `/mcp/none`, `/mcp/basic`, and `/mcp/oauth`
- A project-specific local inspector command verifies the main local Mock Server surfaces across admin APIs, REST, MCP, Basic Auth, OAuth, token revocation, audit, and reset guards
- The local inspector prints a final diagnostics report covering target URL, OAuth discovery linkage, MCP protocol negotiation, protocol-version rejection, Origin rejection, Bearer challenge metadata, JWT audience, permission filtering, denial, revocation, and cleanup mode
- Docker Compose exposes port `3000`, persists SQLite at `/app/data`, and keeps logs available at `/app/logs`
- Nginx guidance forwards host and forwarded-proto headers so public base URL resolution remains accurate behind a proxy
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
- Inspector helper scripts and config target the documented local MCP routes without vendoring upstream Inspector source
- The project-specific inspector can run without root credentials by default and only performs destructive root reset when explicitly requested
- The local inspector diagnostics report must fail the command when protocol-facing invariants are missing, not merely print warnings
