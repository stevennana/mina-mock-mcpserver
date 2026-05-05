# OAuth Users Management UI and Built-In Protection

```json taskmeta
{
  "id": "oauth-users-management-ui",
  "title": "OAuth Users Management UI and Built-In Protection",
  "order": 13,
  "status": "completed",
  "next_task_on_success": "oauth-clients-management-ui",
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
    "npm run test:e2e -- --grep @ui-oauth-users",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-05T11:35:14.467Z"
}
```

## Objective

Implement OAuth login-user persistence, built-in protection, TTL settings, and public management UI.

## Clarity notes

- This is only OAuth users, not clients or tokens.
- The built-in OAuth `default/default` user must always remain usable for later login flow tasks.
- Token TTL settings belong to users here because authorization-code tokens later inherit them.
- The UI is public configuration, not an authenticated admin surface.

## Expected result

- OAuth users can be listed, created, password-edited, TTL-edited, enabled/disabled, and deleted where allowed.
- Built-in OAuth user is visible as locked and protected from weakening.
- Passwords are hashed and not logged.
- `@ui-oauth-users` proves UI behavior and responsive/accessibility quality.

## Objections / risks to avoid

- Do not implement OAuth clients in this task.
- Do not implement login/authorize/token routes yet.
- Do not allow never-expiring tokens unless root-enabled in a later explicit feature.
- Do not store plaintext passwords.

## Scope

- Add OAuth user model/service if not present.
- Implement TTL presets and validation.
- Build OAuth users screen/API.
- Add tests for password hashing, built-in immutability, TTL validation, and UI.

## Out of scope

- OAuth clients.
- Authorization code flow.
- Token management UI.
- MCP bearer enforcement.

## Exit criteria

1. OAuth user CRUD works for non-built-in users.
2. Built-in user cannot be deleted, disabled, or password-changed.
3. TTL validation follows MVP constraints.
4. `@ui-oauth-users` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @ui-oauth-users
- npm run verify

## Implementation notes

- Avoid duplicating Basic user service if a shared credential helper is clean and local.

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
- 2026-05-05T11:25:21.487Z: restored as current task after rest-tools-call-runtime promotion.
- 2026-05-05T12:15:00.000Z: found no existing OAuth user slice; reused Basic user service/API/UI patterns for OAuth-only model, seed, CRUD, built-in protection, TTL presets, and tests.
- 2026-05-05T11:35:14.467Z: automatically promoted after deterministic checks and evaluator approval.
