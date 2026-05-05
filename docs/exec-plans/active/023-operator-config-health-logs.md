# Operator Config, Health, Connection Guide, and Logs

```json taskmeta
{
  "id": "operator-config-health-logs",
  "title": "Operator Config, Health, Connection Guide, and Logs",
  "order": 23,
  "status": "active",
  "next_task_on_success": "docker-nginx-final-hardening",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md",
    "docs/product-specs/operator-configuration.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run build",
    "npm run test:unit",
    "npm run test:e2e -- --grep @operator-config",
    "npm run start:smoke",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic"
}
```

## Objective

Complete operator-facing health, public config, base URL behavior, connection guide, root-protected config changes, and server logging.

## Clarity notes

- This is operator runtime behavior, not Docker packaging.
- Connection guide content must reflect actual implemented routes and auth behavior.
- Base URL resolution affects OAuth metadata and client examples.
- Logs must be operator-visible without relying on Ralph artifacts.

## Expected result

- Health and public config routes report real runtime/database state.
- Base URL precedence follows APP_BASE_URL, DB override, forwarded headers, Host, then local fallback.
- Connection guide shows MCP, REST, OAuth discovery URLs, sample client config, curl examples, and public UI warning.
- `npm run start:logged` writes logs under `logs/` with LOG_LEVEL support.

## Objections / risks to avoid

- Do not hardcode localhost into public examples when a configured base URL exists.
- Do not log secrets at debug/trace levels.
- Do not claim Docker/Nginx readiness here; final packaging is next.
- Do not let `build` substitute for startup smoke.

## Scope

- Implement or finalize health/public config behavior.
- Implement base URL override with root password if not already present.
- Build server config/connection guide screen.
- Ensure `start:logged`, `logs/`, and `LOG_LEVEL` behavior and docs match.
- Add E2E tests tagged `@operator-config`.

## Out of scope

- Dockerfile/docker-compose/Nginx artifacts.
- New product features.
- External OAuth providers.
- Full production monitoring.

## Exit criteria

1. Config/connection guide examples match actual routes.
2. Base URL behavior is deterministic and tested.
3. Operator logs are persisted to `logs/` and avoid secrets.
4. `start:smoke` and `@operator-config` pass.
5. All required checks pass.

## Required checks

- npm run lint
- npm run typecheck
- npm run build
- npm run test:unit
- npm run test:e2e -- --grep @operator-config
- npm run start:smoke
- npm run verify

## Implementation notes

- Keep server logging small and explicit.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/RELIABILITY.md
- docs/SECURITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `operator-configuration.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T13:40:45.211Z: restored as current task after malformed-response-console-audit promotion.
- 2026-05-05T14:25:00.000Z: found partial `/config`, `/api/health`, and `start:logged` implementations; reused them while adding shared operator config/base URL/logging services, persisted base URL override, public config API, expanded connection guide, and `@operator-config` coverage.
