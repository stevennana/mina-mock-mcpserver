# OAuth Bearer Enforcement for MCP and REST

```json taskmeta
{
  "id": "oauth-mcp-rest-permission-enforcement",
  "title": "OAuth Bearer Enforcement for MCP and REST",
  "order": 19,
  "status": "queued",
  "next_task_on_success": "issued-token-ui-revocation",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/SECURITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/rest-mock-api.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @oauth-permissions",
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

Validate Bearer tokens and enforce endpoint permissions on MCP and REST routes, with correct 401 versus 403 behavior.

## Clarity notes

- This task connects issued tokens to runtime authorization but does not build the token management UI.
- OAuth permissions apply only to Bearer mode, never no-auth or Basic.
- 401 means token auth failed; 403 means token is valid but lacks endpoint permission.
- Both MCP and REST should use the same permission resolver.

## Expected result

- `/mcp/oauth` requires valid Bearer tokens.
- `/mcp` uses Bearer precedence for Bearer headers and rejects invalid Bearer tokens.
- MCP and REST list routes filter to permitted endpoints.
- Allowed calls succeed; denied endpoint calls return 403 with useful MCP/REST error data.

## Objections / risks to avoid

- Do not confuse 401 and 403.
- Do not apply OAuth permissions to no-auth or Basic callers.
- Do not require token UI to exist for enforcement.
- Do not skip E2E proof of allowed and denied external-client behavior.

## Scope

- Implement Bearer token parser and validator.
- Check signature, issuer, audience/resource, expiry, jti revocation state, and endpoint permissions.
- Apply OAuth filtering and call authorization to MCP and REST routes.
- Add unit and E2E tests tagged `@oauth-permissions`.

## Out of scope

- Issued token UI.
- Manual token revocation UI/API except read-only revocation lookup needed for validation.
- New OAuth grants.
- SSE list_changed push.

## Exit criteria

1. Valid tokens expose only permitted endpoints.
2. Denied endpoint calls return 403 and invalid/expired/revoked tokens return 401.
3. No-auth and Basic behavior remains unchanged.
4. `@oauth-permissions` proves allowed and denied MCP/REST flows.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @oauth-permissions
- npm run verify

## Implementation notes

- This is an external-client behavior task and cannot promote without E2E proof.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/SECURITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `oauth-consent-and-token-runtime.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
