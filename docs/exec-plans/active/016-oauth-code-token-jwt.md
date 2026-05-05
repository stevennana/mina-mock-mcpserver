# Authorization Code Token Exchange and JWT Claims

```json taskmeta
{
  "id": "oauth-code-token-jwt",
  "title": "Authorization Code Token Exchange and JWT Claims",
  "order": 16,
  "status": "active",
  "next_task_on_success": "oauth-client-credentials-grant",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/SECURITY.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @oauth-code-token",
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

Implement `/oauth/token` authorization_code exchange and signed JWT access tokens with endpoint permission claims.

## Clarity notes

- This task consumes codes created by the previous task.
- Tokens must include claims required by later permission enforcement.
- Code exchange must be single-use and bound to the same client and redirect URI.
- RS256 is preferred; if HS256 is used temporarily, the fallback must be explicit and tested.

## Expected result

- Valid code exchange returns access_token, token_type, expires_in, and scope.
- JWT claims include issuer, audience/resource, subject, client_id, grant_type, iat, exp, jti, scope, and endpoint_permissions.
- Expired, reused, mismatched, or invalid codes are rejected.
- Issued token metadata is stored by `jti` for later revocation.

## Objections / risks to avoid

- Do not implement client_credentials in this task.
- Do not ignore redirect_uri or client binding during exchange.
- Do not omit endpoint_permissions from the token.
- Do not log full token values.

## Scope

- Implement token endpoint authorization_code branch.
- Implement JWT signing and claim creation.
- Persist issued token metadata.
- Add unit and E2E tests tagged `@oauth-code-token`.

## Out of scope

- Client credentials grant.
- Token management UI/revocation controls.
- MCP bearer enforcement.
- Discovery/JWKS unless needed minimally for signing key exposure later.

## Exit criteria

1. Authorization codes exchange exactly once.
2. JWT claims match the PRD contract.
3. Invalid exchange cases return deterministic OAuth-style errors.
4. Issued token records are ready for revocation enforcement later.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @oauth-code-token
- npm run verify

## Implementation notes

- Keep signing keys/config documented in security docs if behavior changes.

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
- 2026-05-05T12:00:21.257Z: restored as current task after oauth-authorize-login-consent promotion.
- 2026-05-05T21:23:00+09:00: found existing authorization-code creation path with client, redirect URI, user, resource, and selected endpoint bindings; reused it for token exchange instead of duplicating consent state.
- 2026-05-05T21:23:00+09:00: added `OAuthIssuedToken` persistence, RS256 JWT claim creation, `/oauth/token` authorization_code handling, and focused unit/E2E coverage for single-use exchange and invalid cases.
