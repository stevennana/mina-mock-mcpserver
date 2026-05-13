# MCP Resource Management UI

```json taskmeta
{
  "id": "mcp-resource-management-ui",
  "title": "MCP Resource Management UI",
  "order": 28,
  "status": "completed",
  "next_task_on_success": "mcp-resource-template-management-ui",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/FRONTEND.md",
    "docs/design-docs/product-ui-primitives.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:e2e -- tests/e2e/resources-ui.spec.ts --grep @ui-resources"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated MCP feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-13T06:17:52.502Z"
}
```

## Objective
Add focused admin UI and APIs for direct MCP Resources so users can create, inspect, edit, preview, and delete read-only context resources.

## Clarity notes
- Follow the existing single-purpose page rule from endpoint workflows.
- Resources belong under the Tools navigation group.
- This slice covers direct resources only, not URI templates.

## Scope
- Add `/resources`, `/resources/new`, and `/resources/[id]/*` workflows for catalog, overview, edit metadata, content, console/read preview, and delete.
- Add admin API routes for resource CRUD using the domain service from task 027.
- Add copyable `resources/read` request examples and beginner tooltips explaining application-controlled context.
- Add audit events for create/update/delete and content changes without logging sensitive submitted content beyond normal mock payload evidence.

## Out of scope
- Resource templates.
- Prompt UI.
- MCP runtime handler implementation.
- OAuth consent changes.

## Expected result
- A user can create an enabled text resource and preview the exact MCP `resources/read` request/response shape from the UI.
- Catalog pages stay list/search/status focused.
- UI uses existing product primitives and icons.

## Exit criteria
- A user can create an enabled text resource and preview the exact MCP `resources/read` request/response shape from the UI.
- Catalog pages stay list/search/status focused.
- UI uses existing product primitives and icons.

## Objections / risks to avoid
- Do not place content editors inline in the catalog.
- Do not add file upload or filesystem browsing.
- Do not create a second visual system.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:e2e -- tests/e2e/resources-ui.spec.ts --grep @ui-resources`
- Desktop/mobile screenshots, horizontal overflow check, and accessibility assertions in the UI E2E.

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T06:06:31.838Z: restored as current task after mcp-resource-prompt-domain-schema promotion.
- 2026-05-13T06:16:36Z: added direct Resource admin API routes, focused Resources catalog/detail workflows, resources/read preview UI, resource mutation audit events, and required @ui-resources E2E coverage with screenshots, overflow, and accessibility-name assertions. Required lint, typecheck, and tagged E2E checks passed.
- 2026-05-13T06:17:52.502Z: automatically promoted after deterministic checks and evaluator approval.
