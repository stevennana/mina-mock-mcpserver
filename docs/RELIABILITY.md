# RELIABILITY.md

## Purpose
Define the reliability expectations and failure-handling rules for MCP Mock Server.

## Core Reliability Rules
- seed defaults must be idempotent and protected from normal deletion
- invalid auth fails closed and never falls back to anonymous access
- reset must leave the service operational with default users/client/endpoints
- current reset invariants cover endpoint data and current endpoint seed defaults; later Basic/OAuth slices must add their own reset extensions when those built-ins land
- long delays and malformed responses are intentional per endpoint/case and must not corrupt other requests
- worker stalls in Ralph are detected through worker.jsonl heartbeat evidence

## Verification
- npm run db:prepare applies schema and seed data
- npm run start:smoke proves production-style startup and health response
- E2E checks cover OAuth permission denial, revocation, and reset recovery
- audit tests prove mutation evidence is written
- Ralph status verifies current-task state and active queue consistency

## Runtime Startup Contract
If the app depends on persistent runtime state, document how runtime preparation happens and how a production-style startup smoke proves the `start` path actually works.

## MCP No-Auth Runtime
- `/mcp` without credentials and `/mcp/none` must share the same no-auth MCP adapter so client examples do not drift.
- The first runtime slice is stateless: `initialize` does not create an MCP session, `notifications/initialized` returns `202` with no body, and unsupported SSE/session methods return `405` with `Allow: POST`.
- `tools/list` must read enabled endpoints from the endpoint domain service and use the shared generated MCP input schema helper; disabled endpoints must remain hidden.
- `tools/call` in no-auth mode must call the shared endpoint matcher by endpoint name. Unknown or disabled tools and argument validation failures return JSON-RPC `-32602`; unsupported JSON-RPC methods return `-32601`; no exact response-case match falls back to the configured default case.

## Operator Logging
Document how `npm run start:logged` writes operator-visible server logs into `logs/`, which environment variable controls the log level, and which levels are supported for manual debugging.
Generated server code should expose at least `trace`, `debug`, `info`, `warn`, and `error` logging without dumping secrets or full sensitive payloads by default.

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

## Environment-Specific Verification Blockers
If the direct operator path passes but the current sandboxed or wrapped runner still fails, record that separately from normal product bugs and escalate it explicitly instead of hiding it inside generic “not done” wording.
