# RELIABILITY.md

## Purpose
Define the reliability expectations and failure-handling rules for MCP Mock Server.

## Core Reliability Rules
- seed defaults must be idempotent and protected from normal deletion
- invalid auth fails closed and never falls back to anonymous access
- reset must leave the service operational with default users/client/endpoints
- current reset invariants cover endpoint data and current endpoint seed defaults; later Basic/OAuth slices must add their own reset extensions when those built-ins land
- long delays and malformed responses are intentional per endpoint/case and must not corrupt other requests
- malformed `invalid_json`, `wrong_content_type`, and `empty_body` modes apply only after a specific endpoint call matches and must not affect auth failures, unknown tools, or other endpoints
- resource and prompt runtime responses must use the same JSON-RPC adapter and auth precedence as tools so full MCP feature coverage does not create a second protocol path
- artificial delays are bounded to 30000 ms, apply only to the configured endpoint call, and must not stall unrelated requests globally
- worker stalls in Ralph are detected through worker.jsonl heartbeat evidence

## Verification
- npm run db:prepare applies schema and seed data
- npm run start:smoke proves production-style startup and health response
- E2E checks cover OAuth permission denial, revocation, and reset recovery
- audit tests prove mutation evidence is written
- Ralph status verifies current-task state and active queue consistency
- Docker Compose runs the production server on port `3000` and persists SQLite under `/app/data`; local Playwright and smoke checks continue to use port `3100` unless `PORT` is overridden.

## Runtime Startup Contract
If the app depends on persistent runtime state, document how runtime preparation happens and how a production-style startup smoke proves the `start` path actually works.

## MCP No-Auth Runtime
- `/mcp` without credentials and `/mcp/none` must share the same no-auth MCP adapter so client examples do not drift.
- The first runtime slice is stateless: `initialize` does not create an MCP session, `notifications/initialized` returns `202` with no body, and unsupported SSE/session methods return `405` with `Allow: POST`.
- `tools/list` must read enabled endpoints from the endpoint domain service and use the shared generated MCP input schema helper; disabled endpoints must remain hidden.
- `tools/call` in no-auth mode must call the shared endpoint matcher by endpoint name. Unknown or disabled tools and argument validation failures return JSON-RPC `-32602`; unsupported JSON-RPC methods return `-32601`; no exact response-case match falls back to the configured default case.

## MCP Resources And Prompts Runtime
- `resources/list`, `resources/templates/list`, `resources/read`, `prompts/list`, `prompts/get`, and `completion/complete` must be covered by protocol unit tests before capability advertisement is expanded.
- OAuth permission filtering for resources and prompts must fail closed exactly like tool permissions.
- Legacy SSE resource subscriptions are best-effort in-memory test behavior and must not be documented as durable cross-process event replay.

## Operator Logging
`npm run start:logged` starts Next.js and writes operator-visible server output into timestamped files under `logs/`.
`LOG_LEVEL` controls app log verbosity and supports `trace`, `debug`, `info`, `warn`, and `error`; invalid values fall back to `info`.
Generated server code exposes those levels through the operator logger and redacts secret-looking metadata keys, including passwords, secrets, tokens, authorization headers, JWTs, and codes.
For container operation, mount `/app/data` for SQLite persistence and `/app/logs` if `start:logged` or equivalent log capture is used.
When `TLS_CERT_FILE` and `TLS_KEY_FILE` are set, `start:logged` uses the app-level HTTPS starter. This is for local protocol/client tests; public deployments should still use reverse-proxy TLS termination.

## Base URL Resolution
Runtime URL examples and OAuth issuer metadata use a shared base URL resolver.
Precedence is `APP_BASE_URL`, forwarded headers, Host, then `http://localhost:3000`.
Startup smoke must still probe the real `/api/health` route; a successful build alone does not prove runtime readiness.

## Test Strategy
Document which behaviors are protected by unit tests, which flows require end-to-end coverage, and which command failures block task promotion.
When tests cover subtle or business-critical behavior, capture why those tests exist so future loops do not weaken them casually.
If a user-visible behavior depends on an outside resource such as AI chat or a third-party service, require end-to-end coverage before promotion.
If a task is mainly UI or UX work, require a dedicated `@ui-*` Playwright command with screenshot, responsive, and accessibility checks before promotion.
UI tasks that fully prove quality through those deterministic checks may use `taskmeta.promotion_mode = deterministic_only` so promotion does not require human review.

## Known Gaps
- production hosting rate limits and abuse controls are outside MVP unless added later
- SQLite backup/rotation policy is not yet defined
- SSE streaming and MCP sessions are Phase 2
- privacy policy for storing IP or IP hash in audit logs must be decided before public deployment
- Docker image size is not optimized; the current Dockerfile keeps the toolchain available so `db:prepare` can run Prisma migrate/generate deterministically at container startup.

## Environment-Specific Verification Blockers
If the direct operator path passes but the current sandboxed or wrapped runner still fails, record that separately from normal product bugs and escalate it explicitly instead of hiding it inside generic “not done” wording.
