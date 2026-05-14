# MCP Prompt Management UI

```json taskmeta
{
  "id": "mcp-prompt-management-ui",
  "title": "MCP Prompt Management UI",
  "order": 30,
  "status": "completed",
  "next_task_on_success": "mcp-resources-runtime",
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
    "npm run test:e2e -- tests/e2e/prompts-ui.spec.ts --grep @ui-prompts"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated MCP feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-13T06:42:30.312Z"
}
```

## Objective
Add focused admin UI and APIs for MCP Prompts so users can configure reusable prompt templates, arguments, ordered messages, embedded resources, and completion candidates.

## Clarity notes
- Prompts are user-controlled templates, not model-invoked tools.
- Prompt messages should support text content first and embedded server resources where the selected resource is enabled.

## Scope
- Add `/prompts`, `/prompts/new`, and `/prompts/[id]/*` workflows.
- Support metadata, argument definitions, ordered user/assistant text messages, embedded resource references, completion candidates, console preview, and delete.
- Add API routes that use task 027 domain services.
- Show `prompts/list`, `prompts/get`, and `completion/complete` request previews.

## Out of scope
- Runtime MCP protocol handlers.
- External prompt execution or LLM calls.
- Rich media prompt content beyond text and embedded resources.

## Expected result
- A user can create a prompt with required arguments and preview the rendered messages for sample arguments.
- Missing required arguments are visible as validation errors in the UI.

## Exit criteria
- A user can create a prompt with required arguments and preview the rendered messages for sample arguments.
- Missing required arguments are visible as validation errors in the UI.

## Objections / risks to avoid
- Do not imply prompts run automatically.
- Do not persist secrets entered as sample arguments.
- Do not permit embedded disabled resources.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:e2e -- tests/e2e/prompts-ui.spec.ts --grep @ui-prompts`
- Desktop/mobile screenshots, horizontal overflow check, and accessibility assertions in the UI E2E.

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T06:30:10.819Z: restored as current task after mcp-resource-template-management-ui promotion.
- 2026-05-13T06:39:45Z: added prompt CRUD API routes, focused prompt catalog/create/detail subroutes, prompt argument/message/completion/console/delete UI, enabled-resource-only embed validation, protocol request/response previews, and `@ui-prompts` E2E coverage with desktop/mobile screenshots, overflow, and accessibility assertions. Required gates `npm run lint`, `npm run typecheck`, and `npm run test:e2e -- tests/e2e/prompts-ui.spec.ts --grep @ui-prompts` pass.
- 2026-05-13T06:42:30.312Z: automatically promoted after deterministic checks and evaluator approval.
