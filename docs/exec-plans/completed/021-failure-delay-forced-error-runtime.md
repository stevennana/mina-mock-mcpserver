# Delay and Forced Error Simulation Runtime

```json taskmeta
{
  "id": "failure-delay-forced-error-runtime",
  "title": "Delay and Forced Error Simulation Runtime",
  "order": 21,
  "status": "completed",
  "next_task_on_success": "malformed-response-console-audit",
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
    "npm run test:e2e -- --grep @failure-delay-error",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T13:29:38.585Z"
}
```

## Objective

Implement artificial delay, timeout shortcut, and forced error behavior for MCP and REST calls.

## Clarity notes

- This task covers normal JSON responses that are delayed or intentionally erroring; malformed response modes are next.
- Delay/error config may exist at endpoint and response-case level and should resolve predictably.
- Tests should avoid long waits except where timeout shortcut behavior is explicitly proven safely.
- MCP and REST should share config resolution while mapping errors to their own protocol shapes.

## Expected result

- Configured `delayMs` delays success or error responses.
- Timeout shortcut sets or applies a 30-second delay option in UI/config.
- Forced REST errors return configured status/body/message.
- Forced MCP errors return tool_error or protocol_error according to config.

## Objections / risks to avoid

- Do not implement malformed invalid JSON/wrong content type here.
- Do not block unrelated requests globally when one endpoint has a delay.
- Do not add future matcher types.
- Do not make tests slow/flaky with excessive real waits.

## Scope

- Implement delay resolution and bounded delay execution.
- Implement forced error config resolution and protocol-specific mapping.
- Update endpoint UI/console controls if needed for delay/error execution evidence.
- Add unit and E2E tests tagged `@failure-delay-error`.

## Out of scope

- Malformed response modes.
- Audit event expansion unless directly tied to config changes already present.
- New matching types.
- Operational rate limiting.

## Exit criteria

1. Delay behavior works for MCP and REST without corrupting other calls.
2. Forced REST/MCP errors match configured behavior.
3. Timeout shortcut is visible and tested without destabilizing the suite.
4. `@failure-delay-error` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @failure-delay-error
- npm run verify

## Implementation notes

- Prefer fake timers/unit tests for delay calculation and one controlled E2E timing proof.

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
- 2026-05-05T13:10:29.907Z: restored as current task after issued-token-ui-revocation promotion.
- 2026-05-05T22:42:00+09:00: found existing persistence/UI placeholders for delay and forced-error fields; reused them and added shared runtime resolution plus bounded service-level delay execution for REST and MCP.
- 2026-05-05T22:42:00+09:00: added protocol-specific forced-error mapping, timeout shortcut UI, focused unit coverage, and `@failure-delay-error` E2E coverage without adding malformed response behavior.
- 2026-05-05T22:26:12+09:00: fixed the delayed REST OAuth precheck gap by adding a permission-only endpoint resolver, so bearer REST calls no longer execute or sleep before parsing the real body.
- 2026-05-05T22:26:12+09:00: extended `@failure-delay-error` E2E coverage with a delayed REST OAuth bearer call that proves one bounded delay, then reran `npm run test:unit`, `npm run test:e2e -- --grep @failure-delay-error`, and `npm run verify` successfully.
- 2026-05-05T13:29:38.585Z: automatically promoted after deterministic checks and evaluator approval.
