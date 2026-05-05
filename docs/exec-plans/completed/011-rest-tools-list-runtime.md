# REST Tool List Runtime

```json taskmeta
{
  "id": "rest-tools-list-runtime",
  "title": "REST Tool List Runtime",
  "order": 11,
  "status": "completed",
  "next_task_on_success": "rest-tools-call-runtime",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/product-specs/rest-mock-api.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @rest-tools-list",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T11:14:25.340Z"
}
```

## Objective

Expose configured enabled endpoints through `GET /rest/tools` with no-auth and Basic behavior.

## Clarity notes

- This task only lists REST tool metadata; REST calling is next.
- No-auth and Basic are in scope because they are already implemented before REST.
- OAuth REST filtering is deferred to the OAuth permissions task.
- The response shape should be simple JSON, not MCP JSON-RPC.

## Expected result

- `GET /rest/tools` returns enabled endpoint metadata and parameters.
- No-auth callers see all enabled endpoints.
- Valid Basic callers see all enabled endpoints; invalid Basic headers return 401.
- Endpoint console can display REST list examples if useful without call execution.

## Objections / risks to avoid

- Do not implement REST tool calls here.
- Do not return disabled endpoints.
- Do not add OAuth bearer filtering here.
- Do not use MCP response envelopes for REST.

## Scope

- Implement `GET /rest/tools` route.
- Apply no-auth/Basic auth resolver behavior.
- Add unit tests for response mapping.
- Add E2E tests tagged `@rest-tools-list`.

## Out of scope

- `POST /rest/tools/:name/call`.
- OAuth bearer permissions for REST.
- Failure simulation runtime.

## Exit criteria

1. REST list response matches PRD metadata shape.
2. No-auth and Basic behavior is tested.
3. Invalid Basic returns documented unauthorized response.
4. `@rest-tools-list` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @rest-tools-list
- npm run verify

## Implementation notes

- Keep response DTOs explicit for client testing.

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
- 2026-05-05T11:05:59.758Z: restored as current task after basic-auth-mcp-runtime promotion.
- 2026-05-05T11:07:35Z: found no existing REST route implementation; reused the endpoint catalog query shape, Basic Authorization resolver, and fail-closed 401 pattern from MCP instead of introducing separate auth behavior.
- 2026-05-05T11:07:35Z: added explicit REST tool metadata mapping, GET /rest/tools, unit mapping coverage, and @rest-tools-list E2E coverage for no-auth, valid Basic, invalid Basic, unsupported Authorization, and disabled endpoint filtering.
- 2026-05-05T11:11:04Z: required checks passed: `npm run test:unit`, `npm run test:e2e -- --grep @rest-tools-list`, and `npm run verify`.
- 2026-05-05T11:14:25.340Z: automatically promoted after deterministic checks and evaluator approval.
