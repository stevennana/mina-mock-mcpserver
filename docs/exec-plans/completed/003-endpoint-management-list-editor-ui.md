# Endpoint List, Search, and Editor UI

```json taskmeta
{
  "id": "endpoint-management-list-editor-ui",
  "title": "Endpoint List, Search, and Editor UI",
  "order": 3,
  "status": "completed",
  "next_task_on_success": "endpoint-console-schema-preview-ui",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/FRONTEND.md",
    "docs/DESIGN.md",
    "docs/product-specs/endpoint-tool-management.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @ui-endpoint-editor",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-05T10:03:54.900Z"
}
```

## Objective

Build the first public endpoint-management UI for listing, searching, creating, and editing endpoint definitions.

## Clarity notes

- This is the endpoint CRUD UI slice, not the test console slice.
- Use domain/API validation from earlier tasks and surface errors clearly in the form.
- The UI should be operational and dense, suitable for repeated test setup.
- This is UI-focused and can promote deterministically if the tagged UI proof passes.

## Expected result

- Dashboard/list views show persisted endpoint counts and rows.
- A user can create and edit endpoint basic info, parameters, response cases, default response, enabled state, delete code, and failure config fields.
- Search filters by name or description without layout shift.
- Desktop/mobile screenshot and accessibility coverage exists under `@ui-endpoint-editor`.

## Objections / risks to avoid

- Do not implement endpoint deletion, reset, or audit here.
- Do not wire fake MCP/REST call success into the editor.
- Do not duplicate server validation with incompatible client rules.
- Do not build a decorative landing page before the usable management UI.

## Scope

- Create endpoint list and search UI.
- Create endpoint create/edit flow backed by persisted endpoint APIs.
- Render validation errors and empty/loading/error states.
- Update dashboard counts from persisted endpoint state.
- Add Playwright UI test coverage tagged `@ui-endpoint-editor` with desktop and mobile assertions.

## Out of scope

- Endpoint test console execution.
- Delete/reset/audit behavior.
- MCP and REST runtime routes.
- OAuth or Basic Auth screens.

## Exit criteria

1. A public user can create and edit endpoint definitions through the UI.
2. List/search and dashboard counts reflect persisted endpoint data.
3. The form captures all MVP endpoint fields without layout overflow on mobile.
4. `@ui-endpoint-editor` proves screenshot, responsive, and accessibility expectations.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @ui-endpoint-editor
- npm run verify

## Implementation notes

- Use stable fixtures for screenshots.
- Keep cards at small radii and avoid nested card layouts per frontend guidance.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/FRONTEND.md
- docs/DESIGN.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `endpoint-tool-management.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T09:44:50.444Z: restored as current task after endpoint-validation-and-matching promotion.
- 2026-05-05T10:01:36Z: reused existing partial endpoint API/UI/test slice, completed missing editor fields for parameter descriptions and response-case error body/message, synced list/header counts after saves, and tightened tagged UI proof for accessible controls, screenshots, and mobile overflow.
- 2026-05-05T10:03:54.900Z: automatically promoted after deterministic checks and evaluator approval.
