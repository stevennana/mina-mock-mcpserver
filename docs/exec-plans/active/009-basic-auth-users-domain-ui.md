# Basic Auth Users Domain and Management UI

```json taskmeta
{
  "id": "basic-auth-users-domain-ui",
  "title": "Basic Auth Users Domain and Management UI",
  "order": 9,
  "status": "active",
  "next_task_on_success": "basic-auth-mcp-runtime",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/SECURITY.md",
    "docs/product-specs/basic-auth-management.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @ui-basic-users",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only"
}
```

## Objective

Implement Basic Auth user persistence, hashing, built-in protection, and public management UI before strict route enforcement.

## Clarity notes

- Basic Auth here is a test identity catalog, not public admin UI protection.
- The built-in `default/default` row is a permanent locked fixture.
- Password hashing and built-in invariants should be unit-tested before protocol enforcement.
- This task is UI-heavy because it includes the management screen.

## Expected result

- Basic users can be listed, created, password-edited, enabled/disabled, and deleted where allowed.
- Built-in default user is visible as locked and cannot be weakened.
- Passwords are hashed at rest.
- `@ui-basic-users` proves the management UI on desktop and mobile.

## Objections / risks to avoid

- Do not implement `/mcp/basic` route behavior here.
- Do not store plaintext passwords.
- Do not add sessions, login, or RBAC.
- Do not allow built-in user disable/delete/password change.

## Scope

- Add Basic user model/repository/service if not already present.
- Implement password hashing and credential verification service.
- Build Basic users screen and APIs.
- Add unit tests for hashing and built-in immutability.
- Add UI tests tagged `@ui-basic-users`.

## Out of scope

- MCP Basic strict route behavior.
- REST Basic route behavior unless needed for shared helpers.
- OAuth users/clients.
- Admin UI authentication.

## Exit criteria

1. Built-in Basic user remains protected.
2. Additional Basic users can be managed through UI/API.
3. Password verification works against hashes.
4. `@ui-basic-users` passes with screenshot/responsive/accessibility proof.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @ui-basic-users
- npm run verify

## Implementation notes

- Never log raw passwords.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/SECURITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `basic-auth-management.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T10:49:01.250Z: restored as current task after mcp-tools-call-and-errors promotion.
- 2026-05-05T19:54:46+09:00 - Found only Basic Auth placeholders in dashboard/nav and endpoint console; reused endpoint/reset API, Prisma, audit, and UI patterns instead of duplicating framework shape.
- 2026-05-05T19:54:46+09:00 - Added BasicUser persistence, locked default/default seeding, scrypt password hashing, credential verification, CRUD APIs, management UI, reset reseeding, unit tests, and @ui-basic-users E2E coverage.
