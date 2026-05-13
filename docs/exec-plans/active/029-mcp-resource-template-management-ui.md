# MCP Resource Template Management UI

```json taskmeta
{
  "id": "mcp-resource-template-management-ui",
  "title": "MCP Resource Template Management UI",
  "order": 29,
  "status": "active",
  "next_task_on_success": "mcp-prompt-management-ui",
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
    "npm run test:e2e -- tests/e2e/resource-templates-ui.spec.ts --grep @ui-resource-templates"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated MCP feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only"
}
```

## Objective
Add focused admin UI and APIs for MCP Resource Templates, including URI-template arguments, rendered mock content, and completion candidates.

## Clarity notes
- Resource Templates are distinct from direct Resources because clients discover them through `resources/templates/list`.
- Completion candidates configured here are later served through `completion/complete`.

## Scope
- Add `/resource-templates`, `/resource-templates/new`, and `/resource-templates/[id]/*` workflows.
- Support metadata, URI template, argument definitions, rendered content body, completion candidates, console preview, and delete.
- Add API routes that use task 027 domain services.
- Show a console preview for `resources/templates/list`, `resources/read` with sample args, and `completion/complete`.

## Out of scope
- Direct resource CRUD changes beyond shared components.
- Prompt templates.
- Runtime MCP protocol handlers.

## Expected result
- A user can configure a URI template such as `resource://mock/tool/{name}` and sample completion values.
- The UI makes argument substitution and completion behavior visible before runtime handlers are wired.

## Exit criteria
- A user can configure a URI template such as `resource://mock/tool/{name}` and sample completion values.
- The UI makes argument substitution and completion behavior visible before runtime handlers are wired.

## Objections / risks to avoid
- Do not use ad hoc string replacement without validating template arguments.
- Do not let template previews imply external network fetching.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:e2e -- tests/e2e/resource-templates-ui.spec.ts --grep @ui-resource-templates`
- Desktop/mobile screenshots, horizontal overflow check, and accessibility assertions in the UI E2E.

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T06:17:52.502Z: restored as current task after mcp-resource-management-ui promotion.
- 2026-05-13T06:27:35Z: added resource-template API routes, focused admin workflows, validated preview substitution, completion candidate editing, console previews, and `@ui-resource-templates` E2E coverage; required lint, typecheck, and focused E2E checks pass.
