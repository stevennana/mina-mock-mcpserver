# Basic Auth MCP Runtime and Auth Precedence

```json taskmeta
{
  "id": "basic-auth-mcp-runtime",
  "title": "Basic Auth MCP Runtime and Auth Precedence",
  "order": 10,
  "status": "completed",
  "next_task_on_success": "rest-tools-list-runtime",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/SECURITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/basic-auth-management.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @basic-auth-mcp",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T11:05:59.758Z"
}
```

## Objective

Enforce Basic Auth on `/mcp/basic` and Basic header precedence on `/mcp` using the existing Basic user service.

## Clarity notes

- This task wires Basic credentials into MCP routes after no-auth MCP behavior exists.
- Valid Basic credentials grant all enabled endpoints.
- Invalid Basic headers fail closed with 401 and never downgrade to no-auth.
- The same auth resolver should be reusable by REST later.

## Expected result

- `/mcp/basic` returns 401 for missing/invalid Basic credentials and succeeds for valid credentials.
- `/mcp` with a valid Basic header uses Basic principal behavior.
- `/mcp` with invalid Basic header returns 401 instead of anonymous behavior.
- E2E coverage proves default/default and a user-created Basic credential path.

## Objections / risks to avoid

- Do not add OAuth bearer behavior here.
- Do not modify no-auth behavior except for explicit Authorization header precedence.
- Do not weaken built-in Basic user invariants.
- Do not let malformed Basic headers throw unhandled errors.

## Scope

- Implement Authorization header parser for Basic.
- Apply Basic resolver to `/mcp` and `/mcp/basic`.
- Return proper 401 responses and `WWW-Authenticate` where appropriate.
- Add unit tests for parser/precedence and E2E tests tagged `@basic-auth-mcp`.

## Out of scope

- REST Basic behavior unless trivial shared resolver reuse.
- OAuth bearer handling.
- Basic user management UI already handled.

## Exit criteria

1. Strict Basic route behavior matches PRD.
2. Unified `/mcp` auth precedence matches PRD.
3. Valid Basic callers can list and call all enabled endpoints.
4. Invalid Basic callers cannot fall back to no-auth.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @basic-auth-mcp
- npm run verify

## Implementation notes

- Keep auth principal visible enough for later console evidence.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/SECURITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `basic-auth-management.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T10:58:19.153Z: restored as current task after basic-auth-users-domain-ui promotion.
- 2026-05-05T11:01:31Z: found existing no-auth MCP adapter and Basic user verification service; reused both by adding a shared Basic Authorization parser/resolver, wiring `/mcp/basic`, and changing only `/mcp` Authorization-header precedence.
- 2026-05-05T11:03:00Z: added parser/resolver unit coverage and `@basic-auth-mcp` E2E coverage for default/default, a user-created credential, strict 401 behavior, malformed headers, and unified `/mcp` invalid-header precedence; required `npm run test:unit`, `npm run test:e2e -- --grep @basic-auth-mcp`, and `npm run verify` passed.
- 2026-05-05T11:05:59.758Z: automatically promoted after deterministic checks and evaluator approval.
