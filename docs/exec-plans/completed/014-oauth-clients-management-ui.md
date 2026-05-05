# OAuth Clients Management UI and Allowed Endpoints

```json taskmeta
{
  "id": "oauth-clients-management-ui",
  "title": "OAuth Clients Management UI and Allowed Endpoints",
  "order": 14,
  "status": "completed",
  "next_task_on_success": "oauth-authorize-login-consent",
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
    "npm run test:e2e -- --grep @ui-oauth-clients",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-05T11:47:42.510Z"
}
```

## Objective

Implement OAuth client persistence, secret generation, redirect URI management, allowed endpoint selection, and client UI.

## Clarity notes

- This task is only OAuth clients and their maximum allowed endpoint set.
- Client secrets are sensitive copy-once-style values.
- Allowed endpoints constrain later consent and client credentials flows.
- The built-in default/default client must remain protected.

## Expected result

- OAuth clients can be created with user-entered client ID and generated secret.
- Redirect URIs, display name, allowed endpoints, enabled state, and client credentials TTL can be edited.
- Built-in client is visible as locked and cannot be disabled/deleted through normal flows.
- `@ui-oauth-clients` proves the management UI.

## Objections / risks to avoid

- Do not implement `/oauth/token` here.
- Do not repeatedly display stored client secrets unless explicitly configured later.
- Do not allow clients to request endpoints outside their allowed set later.
- Do not delete or weaken the built-in client.

## Scope

- Add OAuth client model/service if not present.
- Generate and hash/store client secrets according to implementation decision.
- Build OAuth clients screen/API.
- Implement allowed endpoint selection.
- Add unit/UI tests tagged `@ui-oauth-clients`.

## Out of scope

- OAuth user management already done.
- Authorization/login/consent flow.
- Client credentials token issuance.
- Discovery metadata.

## Exit criteria

1. Client CRUD works for non-built-in clients.
2. Client secret generation/display behavior is safe and tested.
3. Allowed endpoint mappings persist correctly.
4. Built-in client remains protected.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @ui-oauth-clients
- npm run verify

## Implementation notes

- If secrets are hashed, show raw secret only at creation/regeneration and document that behavior.

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
- 2026-05-05T11:35:14.467Z: restored as current task after oauth-users-management-ui promotion.
- 2026-05-05T12:47:00.000Z: found no existing OAuth client slice; reused OAuth user service/API/UI patterns and added Prisma client persistence, scrypt-hashed generated secrets, redirect URI and allowed-endpoint persistence, built-in client protection, reset/seed coverage, and unit/UI tests.
- 2026-05-05T11:47:42.510Z: automatically promoted after deterministic checks and evaluator approval.
