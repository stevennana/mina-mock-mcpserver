# OAuth Discovery Metadata and JWKS

```json taskmeta
{
  "id": "oauth-discovery-metadata",
  "title": "OAuth Discovery Metadata and JWKS",
  "order": 18,
  "status": "completed",
  "next_task_on_success": "oauth-mcp-rest-permission-enforcement",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/SECURITY.md",
    "docs/FRONTEND.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @oauth-discovery",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T12:38:08.891Z"
}
```

## Objective

Expose OAuth protected-resource, authorization-server, OIDC configuration, and JWKS metadata aligned with the mock server runtime.

## Clarity notes

- This task advertises already implemented OAuth capabilities; it should not claim unsupported features.
- Metadata URLs must respect configured base URL behavior as far as currently implemented.
- JWKS must match the token signing approach.
- Connection guide should show metadata endpoints for MCP client setup.

## Expected result

- `.well-known/oauth-protected-resource`, `.well-known/oauth-authorization-server`, `.well-known/openid-configuration`, and `/oauth/jwks` return consistent JSON.
- Metadata advertises authorization endpoint, token endpoint, JWKS endpoint, supported grants, response types, auth methods, and scopes.
- Connection guide includes discovery URLs and examples.
- Tests prove metadata shape and URL consistency.

## Objections / risks to avoid

- Do not advertise refresh tokens, PKCE, or external providers unless actually supported.
- Do not expose private signing material in JWKS.
- Do not hardcode public URLs in a way that breaks reverse proxy deployment.
- Do not add new OAuth grants here.

## Scope

- Implement discovery route handlers.
- Implement JWKS route matching signing keys.
- Update connection guide UI/docs for metadata endpoints.
- Add unit/E2E tests tagged `@oauth-discovery`.

## Out of scope

- Client credentials grant already handled.
- MCP permission enforcement.
- Token UI/revocation.

## Exit criteria

1. Metadata endpoints return valid, internally consistent JSON.
2. JWKS can be used to verify issued tokens according to the signing approach.
3. Connection guide examples match actual routes.
4. `@oauth-discovery` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @oauth-discovery
- npm run verify

## Implementation notes

- Keep mock-server limitations explicit.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/SECURITY.md
- docs/FRONTEND.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `oauth-consent-and-token-runtime.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T12:19:37.153Z: restored as current task after oauth-client-credentials-grant promotion.
- 2026-05-05T12:26:34Z: found existing RS256 JWT issuance and request-origin issuer handling; added shared discovery/JWKS helpers, well-known route handlers, `/oauth/jwks`, a `/config` connection guide, docs updates, and unit/E2E coverage for metadata consistency and JWKS token verification.
- 2026-05-05T12:33:03Z: removed unsupported `/mcp/oauth` advertisement from protected-resource metadata and the config guide because bearer MCP enforcement is the next task; tightened unit/E2E checks to assert discovery does not publish unimplemented route URLs.
- 2026-05-05T12:38:08.891Z: automatically promoted after deterministic checks and evaluator approval.
