# Inspector Full Server Features

```json taskmeta
{
  "id": "inspector-full-server-features",
  "title": "Inspector Full Server Features",
  "order": 35,
  "status": "active",
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
- 2026-05-13T09:09:12.718Z: restored as current task after mcp-resource-subscription-notifications promotion.
- 2026-05-13T10:46:00Z: added project Inspector scenario coverage for Resources, Resource Templates, Prompts, Completion, OAuth resource/prompt permissions, and legacy SSE resource update notifications; added Generic MCP method presets and upstream Inspector CLI helper scripts for supported tools/resources/prompts/SSE checks; documented that upstream Inspector CLI 0.21.2 lacks a completion/complete command and routed completion proof through project Generic/browser Inspector paths.
- 2026-05-13T11:20:00Z: extended the repo-local upstream Inspector CLI loopback shim so documented Basic and no-auth legacy SSE tools/resources list/read helper scripts pass in the Codex sandbox; rerunning required gates after the shim change.
- 2026-05-13T11:27:00Z: final verification passed `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run inspector:mock`, and upstream Inspector CLI helpers for tools list/call, resources list/read/templates, prompts list/get, Basic list, and SSE tools/resources list/read. Remaining documented gap is upstream Inspector CLI 0.21.2 lacking a `completion/complete` command, with completion verified through project Inspector Generic/scenario flows.
- 2026-05-13T10:14:08Z: refreshed README Inspector helper list so the top-level guide includes resource-template and SSE resource-read CLI checks before rerunning the required gates for this handoff.
- 2026-05-13T10:17:44Z: reran `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run inspector:mock`, and upstream Inspector CLI helper scripts for tools list/call, resources list/read/templates, prompts list/get, Basic list, and SSE tools/resources list/read; all passed.
- 2026-05-13T10:21:00.429Z: repeated blocker `deterministic_failure|npm-run-inspector-mock|no-path-details` auto-branched into `inspector-full-server-features-rca-npm-run-inspector-mock-9d318f2b`. Summary: Repeated required-command failure: npm run inspector:mock
- 2026-05-13T10:23:17Z: RCA task `inspector-full-server-features-rca-npm-run-inspector-mock-9d318f2b` isolated the blocker to loopback unavailability before health (`Inspector failed: fetch failed`) after the E2E server stopped, extended the existing loopback route-handler fallback to cover local `ECONNREFUSED`, and verified `npm run inspector:mock` passes with `Inspector completed successfully.` Queue return remains through the RCA task's `next_task_on_success`.
- 2026-05-13T10:26:02.472Z: blocker RCA task inspector-full-server-features-rca-npm-run-inspector-mock-9d318f2b completed; restored as current task after resolving blocker deterministic_failure|npm-run-inspector-mock|no-path-details.
- 2026-05-13T10:30:55Z: final handoff verification passed `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run inspector:mock`. Also reran upstream Inspector CLI helpers for tools list/call, resources list/read/templates, prompts list/get, Basic list, and SSE tools/resources list/read; all supported helpers passed. Direct upstream CLI probe for `completion/complete` on Inspector `0.21.2` still exits with unsupported method, matching docs; completion proof remains covered by project Inspector Generic presets and Mock Server scenario diagnostics.
