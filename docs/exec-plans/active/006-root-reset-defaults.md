# Root-Protected Reset to Defaults

```json taskmeta
{
  "id": "root-reset-defaults",
  "title": "Root-Protected Reset to Defaults",
  "order": 6,
  "status": "active",
  "next_task_on_success": "mcp-initialize-and-tools-list",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/SECURITY.md",
    "docs/RELIABILITY.md",
    "docs/product-specs/operator-configuration.md"
  ],
  "required_commands": [
    "npm run db:prepare",
    "npm run test:unit",
    "npm run test:e2e -- --grep @root-reset",
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

Implement root-password-protected reset behavior that restores deterministic default state without harming runtime readiness.

## Clarity notes

- Reset is an operator recovery path for a public test service.
- This task should reset endpoint data and any seeded defaults currently implemented; future auth slices can extend reset invariants as they add built-ins.
- The reset UI should be explicit about destructive behavior.
- The reset path must leave `db:prepare`, startup smoke, and later queue tasks usable.

## Expected result

- A reset screen/API requires root password and confirmation text.
- Full reset removes user-created endpoint data and recreates current seed defaults.
- Audit evidence records reset attempts and successful reset.
- Tests prove reset recovery from modified public data.

## Objections / risks to avoid

- Do not introduce login/session semantics for root password.
- Do not reset by deleting the SQLite file in a way that bypasses migrations or seed invariants.
- Do not leave stale in-memory data after reset.
- Do not claim future Basic/OAuth built-ins are handled until those slices add their reset extensions.

## Scope

- Implement root password verification for reset.
- Create reset service that clears currently implemented mutable data and reruns seed preparation.
- Build reset confirmation UI.
- Write audit events for reset success/failure.
- Add E2E coverage tagged `@root-reset`.

## Out of scope

- Endpoint delete-by-code behavior already handled in previous task.
- Future Basic/OAuth reset extensions before their domains exist.
- Backup/restore or scheduled maintenance tooling.

## Exit criteria

1. Root password and confirmation are required for reset.
2. Reset restores deterministic endpoint defaults after user-created data exists.
3. Reset failure does not corrupt runtime state.
4. `@root-reset` proves UI/API recovery behavior.
5. All required checks pass.

## Required checks

- npm run db:prepare
- npm run test:unit
- npm run test:e2e -- --grep @root-reset
- npm run verify

## Implementation notes

- Document reset invariants in reliability/security docs if implementation details change.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/SECURITY.md
- docs/RELIABILITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `operator-configuration.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T10:19:51.517Z: restored as current task after endpoint-protected-delete-audit promotion.
- 2026-05-05T19:12:00+09:00 - Found existing endpoint seed preparation, root-password verifier, endpoint deletion API patterns, and audit service; reused those rather than adding sessions or deleting the SQLite file.
- 2026-05-05T19:18:00+09:00 - Added root-password plus exact confirmation reset API/UI, endpoint-table reset service that reruns current seed defaults, non-secret reset audit events, and `@root-reset` UI/API E2E coverage.
- 2026-05-05T19:28:05+09:00 - Required gates passed: `npm run db:prepare`, `npm run test:unit`, `npm run test:e2e -- --grep @root-reset`, and `npm run verify`; `verify` required serial Playwright workers because reset and endpoint mutation E2E share the same SQLite runtime database.
