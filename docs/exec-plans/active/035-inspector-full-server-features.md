# Inspector Full Server Features

```json taskmeta
{
  "id": "inspector-full-server-features",
  "title": "Inspector Full Server Features",
  "order": 35,
  "status": "queued",
  "next_task_on_success": null,
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/FEATURES.md",
    "docs/GETTING_STARTED.md",
    "docs/TRANSPORTS.md",
    "docs/INSPECTOR.md",
    "MCPBrowserInspector.md",
    "MinaInspector.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit",
    "npm run test:e2e",
    "npm run inspector:mock"
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
Update the project Inspector, upstream Inspector docs, README guides, and final E2E proof so users can verify Tools, Resources, Prompts, Completion, OAuth permissions, and SSE notifications end to end.

## Clarity notes
- This is a final integration/hardening slice for the Resources/Prompts wave.
- It should not introduce new protocol behavior; it proves and documents behavior delivered by tasks 027-034.

## Scope
- Add Resources, Resource Templates, Prompts, Completion, OAuth permission, and SSE subscription checks to the project Inspector scenario.
- Add Generic target presets for `resources/list`, `resources/read`, `resources/templates/list`, `prompts/list`, `prompts/get`, and `completion/complete`.
- Update README, `docs/FEATURES.md`, `docs/GETTING_STARTED.md`, `docs/TRANSPORTS.md`, `docs/INSPECTOR.md`, `MCPBrowserInspector.md`, and `MinaInspector.md`.
- Add screenshots or browser-based evidence for the standalone Inspector and Mock Server UI.
- Run full verification and record any residual gaps in the tech-debt tracker.

## Out of scope
- New database schema or runtime methods.
- Changing public Docker/release tagging policy.
- Vendor or fork upstream MCP Inspector.

## Expected result
- A first-time user can follow docs to verify the full server-side MCP feature set locally and against the hosted mock server.
- The project Inspector gives sequential evidence instead of one crowded page.
- Upstream Inspector examples cover tools, resources, prompts, completion, Basic, OAuth, and SSE where supported.

## Exit criteria
- A first-time user can follow docs to verify the full server-side MCP feature set locally and against the hosted mock server.
- The project Inspector gives sequential evidence instead of one crowded page.
- Upstream Inspector examples cover tools, resources, prompts, completion, Basic, OAuth, and SSE where supported.

## Objections / risks to avoid
- Do not claim client-side Sampling, Roots, or Elicitation support.
- Do not include screenshots with raw Bearer tokens or secrets.
- Do not leave docs saying Resources/Prompts are out of scope.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run inspector:mock`
- `npm run inspector:ui` manual browser E2E through Mock Server scenario and Generic target
- Upstream Inspector CLI checks for tools, resources, prompts, completion, and SSE list/read flows.

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
