# REST Tool Call Runtime and Console Wiring

```json taskmeta
{
  "id": "rest-tools-call-runtime",
  "title": "REST Tool Call Runtime and Console Wiring",
  "order": 12,
  "status": "active",
  "next_task_on_success": "oauth-users-management-ui",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/product-specs/rest-mock-api.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @rest-tools-call",
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

Implement `POST /rest/tools/:name/call` and wire endpoint console REST execution for no-auth and Basic modes.

## Clarity notes

- This task executes REST calls using the shared endpoint matcher.
- The endpoint console should now show real REST raw request/response evidence for no-auth and Basic.
- REST error bodies are contract behavior for client negative-path testing.
- OAuth REST behavior remains deferred.

## Expected result

- REST tool call route returns exact-match mock responses.
- No-match, unknown tool, invalid auth, and forced-error placeholders map to documented REST errors.
- Endpoint console can run REST no-auth and Basic calls.
- E2E coverage proves successful call and negative cases.

## Objections / risks to avoid

- Do not fork matching logic from MCP/domain.
- Do not implement OAuth filtering here.
- Do not return JSON-RPC envelopes from REST.
- Do not hide raw request/response evidence in the console.

## Scope

- Implement REST tool call route.
- Map matcher outcomes to REST success/error bodies.
- Wire endpoint console REST execution for no-auth and Basic.
- Add unit and E2E tests tagged `@rest-tools-call`.

## Out of scope

- OAuth bearer permissions.
- Malformed response modes not yet implemented.
- MCP route changes.

## Exit criteria

1. Configured endpoint can be called via REST.
2. REST error responses match the product spec for scoped cases.
3. Console displays raw request, raw response, matched case, auth principal, and elapsed time for REST calls.
4. `@rest-tools-call` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @rest-tools-call
- npm run verify

## Implementation notes

- Keep console UI stable from earlier screenshot contract.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `rest-mock-api.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T11:14:25.340Z: restored as current task after rest-tools-list-runtime promotion.
- 2026-05-05T11:20:26.300Z: found and reused shared `callEndpointByName` / `executeEndpointDetail` matcher path; added REST call adapter, no-auth/Basic console execution evidence, REST call unit coverage, and `@rest-tools-call` E2E coverage.
