# OAuth Authorize, Login, and Consent UI

```json taskmeta
{
  "id": "oauth-authorize-login-consent",
  "title": "OAuth Authorize, Login, and Consent UI",
  "order": 15,
  "status": "queued",
  "next_task_on_success": "oauth-code-token-jwt",
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
    "npm run test:e2e -- --grep @oauth-consent",
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

Implement the browser authorization entry, mock login, consent screen, endpoint selection, and authorization code creation.

## Clarity notes

- This task stops at issuing an authorization code; token exchange is next.
- Consent must show endpoint permissions clearly because later tokens enforce them.
- Authorization code records must be single-use-ready and bound to client, redirect URI, user, selected endpoints, and resource/audience.
- The OAuth login UI is separate from the public admin navigation.

## Expected result

- Valid `/oauth/authorize` requests reach login and consent.
- Consent displays client, redirect URI, resource, user, TTL, and endpoint checklist.
- Submitting consent redirects to the registered redirect URI with `code` and `state`.
- Invalid client/redirect/user cases fail deterministically.

## Objections / risks to avoid

- Do not exchange codes for tokens in this task.
- Do not skip consent by issuing codes directly from admin UI.
- Do not accept unregistered redirect URIs.
- Do not allow endpoint selections outside the client allowed set.

## Scope

- Validate authorization request parameters.
- Build login and consent screens.
- Persist authorization codes with expiry and selected endpoint IDs.
- Redirect with code/state or appropriate errors.
- Add E2E tests tagged `@oauth-consent`.

## Out of scope

- `/oauth/token` exchange.
- Client credentials grant.
- Discovery metadata.
- MCP bearer enforcement.

## Exit criteria

1. A valid user can complete login and consent for an OAuth client.
2. Authorization codes store the selected endpoint permissions and binding data.
3. Invalid redirect/client/user paths are tested.
4. `@oauth-consent` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @oauth-consent
- npm run verify

## Implementation notes

- Permit empty-permission token only with explicit user confirmation if implemented in this slice.

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
