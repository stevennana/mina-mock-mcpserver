# Endpoint Protected Delete and Audit Evidence

```json taskmeta
{
  "id": "endpoint-protected-delete-audit",
  "title": "Endpoint Protected Delete and Audit Evidence",
  "order": 5,
  "status": "active",
  "next_task_on_success": "root-reset-defaults",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/SECURITY.md",
    "docs/product-specs/endpoint-tool-management.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @endpoint-delete-audit",
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

Implement endpoint deletion guarded by delete code or root password, with audit evidence for successful and failed delete attempts.

## Clarity notes

- This task protects destructive endpoint deletion only; full reset is a separate task.
- The public UI can remain public, but destructive delete needs a deliberate confirmation path.
- Audit entries are product evidence and must avoid secret leakage.
- Root password is an override for protected actions, not an admin login/session feature.

## Expected result

- Endpoint delete prompts for an 8-digit delete code or root password override.
- Correct code or root password deletes the endpoint; incorrect values fail clearly.
- Audit log records successful endpoint deletion and failed delete attempts without storing secrets.
- E2E proof exists under `@endpoint-delete-audit`.

## Objections / risks to avoid

- Do not implement root reset in this task.
- Do not log delete codes or root password values.
- Do not make deletion possible without confirmation.
- Do not delete token history or OAuth mappings beyond safe cleanup documented for endpoint deletion.

## Scope

- Add delete confirmation UI/API.
- Validate endpoint delete code and root password override.
- Clean up endpoint-dependent mappings safely where already present.
- Create audit event storage/use for endpoint delete and failed delete attempts.
- Add E2E coverage for success, failure, and audit evidence.

## Out of scope

- Full reset-to-default behavior.
- Basic/OAuth audit events beyond endpoint delete.
- Historical token deletion.
- Rate limiting or abuse controls.

## Exit criteria

1. Deleting with correct endpoint code succeeds.
2. Deleting with wrong code fails and writes audit evidence.
3. Root password override succeeds without logging the secret.
4. Deleted endpoints are no longer exposed in endpoint list data.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @endpoint-delete-audit
- npm run verify

## Implementation notes

- Use constant-time root password comparison where practical.
- Keep audit event shape extensible for later auth/token events.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/SECURITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `endpoint-tool-management.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T10:09:30.850Z: restored as current task after endpoint-console-schema-preview-ui promotion.
- 2026-05-05T20:21:00+09:00 - Found existing endpoint delete-code persistence and no existing delete/audit implementation; reused endpoint service/API/UI patterns and added guarded delete plus audit storage instead of broadening into reset/auth tasks.
- 2026-05-05T20:24:00+09:00 - Added endpoint delete confirmation UI/API, root-password override validation, non-secret audit evidence, `/audit` read surface, and `@endpoint-delete-audit` E2E coverage for failed code, successful code, and root override paths.
- 2026-05-05T20:32:00+09:00 - Required gates passed: `npm run test:unit`, `npm run test:e2e -- --grep @endpoint-delete-audit`, and `npm run verify`.
