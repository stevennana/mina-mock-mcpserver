# Issued Token UI and Revocation

```json taskmeta
{
  "id": "issued-token-ui-revocation",
  "title": "Issued Token UI and Revocation",
  "order": 20,
  "status": "completed",
  "next_task_on_success": "failure-delay-forced-error-runtime",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/SECURITY.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @token-revocation",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T13:10:29.907Z"
}
```

## Objective

Build issued-token inspection/filtering UI and token revocation behavior that affects subsequent OAuth runtime calls.

## Clarity notes

- This task is token operations and evidence, after bearer enforcement exists.
- Raw access token values should not be redisplayed after issuance by default.
- Revocation changes runtime authorization via stored `jti` state.
- Token detail should help developers debug claims and endpoint permissions.

## Expected result

- Issued tokens can be listed, filtered, and inspected by status, subject, client, grant type, expiry, and endpoint count.
- Token detail shows claims and endpoint_permissions metadata.
- Revoking a token marks it revoked and subsequent OAuth calls fail with 401.
- E2E tests prove UI revocation affects runtime behavior.

## Objections / risks to avoid

- Do not store or redisplay raw token values unless explicit config exists.
- Do not delete historical token records by default.
- Do not implement new OAuth grants.
- Do not let revocation return 403; revoked tokens are invalid and should return 401.

## Scope

- Build token list/detail/filter UI.
- Implement revoke action/API and optional `/oauth/revoke` if aligned with docs.
- Wire revocation state into existing bearer validator.
- Add unit and E2E tests tagged `@token-revocation`.

## Out of scope

- Historical token deletion with root password unless separately trivial and tested.
- OAuth grant behavior already implemented.
- Discovery metadata.

## Exit criteria

1. Token UI exposes claims/permissions without raw-token leakage.
2. Revocation is persistent and affects runtime calls.
3. Filters distinguish active, expired, and revoked tokens.
4. `@token-revocation` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @token-revocation
- npm run verify

## Implementation notes

- Keep token metadata useful for client debugging.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/SECURITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `oauth-consent-and-token-runtime.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T12:49:29.501Z: restored as current task after oauth-mcp-rest-permission-enforcement promotion.
- 2026-05-05T12:51:21Z: found existing bearer validator already rejects stored `revokedAt`; reused it and added issued-token list/detail/revoke service/API/UI plus focused unit and `@token-revocation` E2E coverage.
- 2026-05-05T13:23:00Z: addressed evaluator gaps by persisting issued-token `issuer`, reconstructing detail claims from stored issuer metadata, checking stored issuer during bearer validation, and adding deterministic expired-token list/filter unit coverage.
- 2026-05-05T13:10:29.907Z: automatically promoted after deterministic checks and evaluator approval.
