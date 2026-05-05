# Endpoint Schema Preview and Test Console Shell

```json taskmeta
{
  "id": "endpoint-console-schema-preview-ui",
  "title": "Endpoint Schema Preview and Test Console Shell",
  "order": 4,
  "status": "active",
  "next_task_on_success": "endpoint-protected-delete-audit",
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
    "npm run test:e2e -- --grep @ui-endpoint-console",
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

Add generated MCP schema preview and a stable endpoint test-console shell without implementing external MCP or REST calls yet.

## Clarity notes

- This task gives users visibility into how an endpoint will be called, but actual protocol execution lands in later MCP/REST tasks.
- The console shell should make future auth modes and raw evidence panels obvious without pretending unavailable calls work.
- Generated schema preview must come from the domain service, not handwritten UI logic.
- The task is UI-focused and requires deterministic screenshot/responsive/accessibility proof.

## Expected result

- Endpoint detail/editor pages can show generated MCP inputSchema preview.
- A console shell exists with auth mode selector, Basic credential fields, OAuth token field, arguments JSON editor, raw request panel, raw response panel, matched case area, principal, and elapsed time placeholders.
- Unavailable call buttons or placeholder states clearly indicate which runtime task will make them active.
- `@ui-endpoint-console` proves the console layout is stable on desktop and mobile.

## Objections / risks to avoid

- Do not fake successful MCP or REST calls.
- Do not implement Basic or OAuth credential validation here.
- Do not create console-only schema generation logic.
- Do not let JSON panels overflow or obscure controls in mobile screenshots.

## Scope

- Render schema preview for selected endpoint definitions.
- Build console shell controls and read-only evidence panels.
- Validate arguments JSON syntax locally enough to show user-friendly errors.
- Add UI tests tagged `@ui-endpoint-console` for preview and console shell states.

## Out of scope

- Actual `/mcp*` calls.
- Actual `/rest*` calls.
- Basic/OAuth runtime auth.
- Audit logging for console calls.

## Exit criteria

1. Schema preview reflects endpoint parameter changes.
2. Console shell has stable controls and evidence panels ready for later runtime wiring.
3. Invalid arguments JSON is visibly handled without crashing the page.
4. `@ui-endpoint-console` passes with screenshot, responsive, and accessibility checks.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @ui-endpoint-console
- npm run verify

## Implementation notes

- Prefer a predictable split-pane or stacked layout over decorative cards.
- Keep future runtime placeholders honest.

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
- 2026-05-05T10:03:54.900Z: restored as current task after endpoint-management-list-editor-ui promotion.
- 2026-05-05T19:21:00+09:00 - Found existing endpoint editor/persistence UI but no reusable schema helper in `lib/endpoints`; added a shared MCP inputSchema generator, live editor preview, disabled console shell evidence panels, and `@ui-endpoint-console` coverage.
