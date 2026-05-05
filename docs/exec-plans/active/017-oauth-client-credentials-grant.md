# OAuth Client Credentials Grant

```json taskmeta
{
  "id": "oauth-client-credentials-grant",
  "title": "OAuth Client Credentials Grant",
  "order": 17,
  "status": "active",
  "next_task_on_success": "oauth-discovery-metadata",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/SECURITY.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @oauth-client-credentials",
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

Implement non-interactive client_credentials token issuance with endpoint scope intersection.

## Clarity notes

- This task is only the grant behavior, not metadata discovery.
- Client credentials tokens use subject `client:<client_id>` and client TTL settings.
- Requested scopes narrow access and must never expand beyond client allowed endpoints.
- No user login is involved.

## Expected result

- Valid clients can request client_credentials tokens.
- No scope grants all client-allowed endpoints; requested scopes grant the intersection only.
- Invalid client credentials or disabled clients are rejected.
- Issued token records are stored consistently with authorization-code tokens.

## Objections / risks to avoid

- Do not allow requested scopes to exceed allowed endpoints.
- Do not require browser login for this grant.
- Do not leak client secrets in errors or logs.
- Do not implement discovery metadata here.

## Scope

- Add client_credentials branch to `/oauth/token`.
- Validate client ID/secret and enabled state.
- Compute endpoint permission set from requested scopes and allowed endpoints.
- Add unit and E2E tests tagged `@oauth-client-credentials`.

## Out of scope

- OAuth discovery metadata.
- MCP bearer enforcement.
- Token UI/revocation.
- Refresh tokens.

## Exit criteria

1. Client credentials tokens can be issued for valid clients.
2. Scope intersection behavior is tested.
3. Invalid/disabled clients fail safely.
4. Token claims distinguish grant_type and subject from authorization-code tokens.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @oauth-client-credentials
- npm run verify

## Implementation notes

- Reuse JWT creation from authorization-code task.

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
- 2026-05-05T12:10:54.414Z: restored as current task after oauth-code-token-jwt promotion.
- 2026-05-05T12:38:00.000Z: found authorization-code JWT issuance and token persistence helpers already implemented; reused the route error mapping/signing approach while adding a client_credentials token branch and focused unit/E2E coverage.
