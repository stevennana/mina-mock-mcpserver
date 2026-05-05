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
- Connection guide examples cover `/mcp`, `/mcp/none`, `/mcp/basic`, `/mcp/oauth`, `/rest/tools`, `/rest/tools/{tool_name}/call`, OAuth discovery metadata, `/oauth/token`, and `/oauth/jwks`
- Docker Compose exposes port `3000`, persists SQLite at `/app/data`, and keeps logs available at `/app/logs`
- Nginx guidance forwards host and forwarded-proto headers so public base URL resolution remains accurate behind a proxy
- Operator handoff covers one Ralph cycle, unattended loop operation, status files, artifacts, logs, and next-queue creation after queue exhaustion

## Validation
- Base URL precedence
- Root password checks
- Seed default recreation for currently implemented endpoint defaults
- Log-level filtering without secret leakage
- Health/config page renders, root reset restores defaults, production-style startup smoke passes
- Docker/Nginx examples match the documented routes, port `3000`, and SQLite persistence expectations
