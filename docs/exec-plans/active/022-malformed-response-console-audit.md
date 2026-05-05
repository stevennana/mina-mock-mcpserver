# Malformed Response Modes, Console Evidence, and Audit

```json taskmeta
{
  "id": "malformed-response-console-audit",
  "title": "Malformed Response Modes, Console Evidence, and Audit",
  "order": 22,
  "status": "active",
  "next_task_on_success": "operator-config-health-logs",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/RELIABILITY.md",
    "docs/product-specs/failure-simulation-and-audit.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @malformed-audit",
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

Implement intentionally malformed response modes with visible warnings, console evidence, and audit logging for failure-simulation changes.

## Clarity notes

- Malformed responses intentionally break normal protocol expectations and must be clearly marked in UI.
- This task should not make malformed behavior global or accidental.
- Console evidence helps developers understand exactly what a client will see.
- Audit should record public changes to failure-simulation settings without leaking sensitive values.

## Expected result

- `invalid_json`, `wrong_content_type`, and `empty_body` modes work where feasible for MCP and REST routes.
- UI warns before saving or running malformed response modes.
- Endpoint console shows raw response evidence, elapsed time, matched case, and principal for malformed/failure cases.
- Audit log records failure-simulation config changes and relevant protected events.

## Objections / risks to avoid

- Do not accidentally apply malformed output to every endpoint.
- Do not hide warnings for protocol-breaking behavior.
- Do not broaden into new failure types or matchers.
- Do not log secrets or raw tokens in audit evidence.

## Scope

- Implement malformed response mode execution.
- Add UI warnings and console evidence for malformed modes.
- Expand audit events for failure-simulation configuration changes.
- Add unit and E2E tests tagged `@malformed-audit`.

## Out of scope

- Delay/forced error behavior already handled.
- Rate limiting or public abuse controls.
- New matcher types.
- External observability dashboards.

## Exit criteria

1. Malformed modes produce the documented raw HTTP/protocol behavior only when configured.
2. UI warnings are visible and tested.
3. Console evidence accurately shows malformed outputs.
4. Audit records failure-simulation changes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @malformed-audit
- npm run verify

## Implementation notes

- Some malformed modes may require low-level route response handling; document any Next.js limitation.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/RELIABILITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `failure-simulation-and-audit.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T13:29:38.585Z: restored as current task after failure-delay-forced-error-runtime promotion.
- 2026-05-05T14:19:00Z: found and reused existing failureMode/malformedResponseJson persistence plus console evidence shell; extended it to explicit invalid_json, wrong_content_type, and empty_body modes instead of adding a parallel config surface.
- 2026-05-05T14:27:00Z: implemented endpoint-scoped malformed REST/MCP raw responses, UI warnings before save/run, non-secret failure-simulation audit events, and @malformed-audit unit/E2E coverage.
