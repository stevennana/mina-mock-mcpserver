# MCP Runtime Inspector Docs Hardening

```json taskmeta
{
  "id": "mcp-runtime-inspector-docs-hardening",
  "title": "MCP Runtime Inspector Docs Hardening",
  "order": 42,
  "status": "completed",
  "next_task_on_success": null,
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "README.md",
    "docs/FEATURES.md",
    "docs/GETTING_STARTED.md",
    "docs/INSPECTOR.md",
    "docs/TRANSPORTS.md",
    "docs/design-docs/mcp-runtime-library-architecture.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run mcp-runtime:build",
    "npm run mcp-runtime:test",
    "npm run test:unit",
    "npm run test:e2e",
    "npm run inspector:mock",
    "npm run inspector:cli:resources:list",
    "npm run inspector:cli:resources:read"
  ],
  "required_files": [
    "docs/MCP_RUNTIME_PACKAGE.md",
    "README.md"
  ],
  "human_review_triggers": [
    "Docs claim published npm availability before the package is actually published.",
    "Inspector compatibility regresses for existing Tools, Resources, Prompts, or SSE checks.",
    "The final hardening task introduces new runtime behavior instead of proving the migration."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-14T08:04:57.197Z"
}
```

## Objective
Complete documentation and integration proof for the reusable MCP runtime package after Mock Server has migrated to it.

## Scope
- Add `docs/MCP_RUNTIME_PACKAGE.md` with Minakeep-style consumption guidance, provider examples, Fetch route example, package boundaries, and Inspector CLI verification steps.
- Update README and existing protocol/Inspector docs to explain that the Mock Server uses the reusable runtime internally.
- Run full unit, E2E, project Inspector, and upstream Inspector CLI checks for resources/list and resources/read.
- Confirm existing Tools, Resources, Prompts, Completion, Basic, OAuth, and SSE flows still work after package extraction.
- Record any residual publish or API-stability follow-up in the tech-debt tracker instead of broadening this task.

## Out of Scope
- Publishing the package to npm.
- New UI work.
- New MCP methods.
- Changing Docker release or public tag policy.

## Exit Criteria
- First-time downstream developers can understand how to consume the runtime package from docs.
- Mock Server E2E and Inspector verification still pass after the migration.
- README does not overclaim package publication status.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run inspector:mock`
- `npm run inspector:cli:resources:list`
- `npm run inspector:cli:resources:read`

## Evaluator Notes
- Confirm this task is proof and documentation, not another architecture expansion.
- Confirm package docs are usable by a Next.js app that does not share this repo's Prisma schema.

## Progress Log
- 2026-05-14T00:00:00Z: seeded as the final hardening task for the runtime library wave.
- 2026-05-14T07:48:02.208Z: restored as current task after mock-server-runtime-adapter-migration promotion.
- 2026-05-14T07:49:46Z: added downstream-facing runtime package documentation, updated README/protocol/Inspector docs to describe Mock Server's package-backed runtime integration, and recorded npm publish/API-stability follow-up in the tech-debt tracker.
- 2026-05-14T08:01:40Z: fixed Next dev resolution for the workspace-private runtime package, preserved prompt-name evidence for embedded-resource permission denials, aligned E2E unsupported-method expectations with package error data, and verified every required command passes.

## Progress log

- 2026-05-14T08:04:57.197Z: automatically promoted after deterministic checks and evaluator approval.
