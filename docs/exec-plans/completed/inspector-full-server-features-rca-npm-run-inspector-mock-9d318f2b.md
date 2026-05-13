# RCA: Inspector Full Server Features blocker

```json taskmeta
{
  "id": "inspector-full-server-features-rca-npm-run-inspector-mock-9d318f2b",
  "title": "RCA: Inspector Full Server Features blocker",
  "order": 35.01,
  "status": "completed",
  "promotion_mode": "standard",
  "next_task_on_success": "inspector-full-server-features",
  "prompt_docs": [
    "AGENTS.md",
    "docs/PLANS.md",
    "docs/exec-plans/active/035-inspector-full-server-features.md",
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
    "npm run inspector:mock"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The fix broadens into unrelated product work instead of isolating the blocker.",
    "The failing command changed without proof that the original blocker is resolved."
  ],
  "rca_for_task_id": "inspector-full-server-features",
  "blocker_signature": "deterministic_failure|npm-run-inspector-mock|no-path-details",
  "blocker_kind": "deterministic_failure",
  "blocker_summary": "Repeated required-command failure: npm run inspector:mock",
  "completed_at": "2026-05-13T10:26:02.472Z"
}
```

## Objective

Resolve the repeated blocker that is preventing `inspector-full-server-features` from promoting, then return the queue to the parent task automatically.

## Scope

- isolate the repeated blocker signature without broadening back into the parent feature
- restore the failing required command path: npm run inspector:mock
- update the parent task log and blocker evidence so the return path is explicit

## Out of scope

- new product scope beyond inspector-full-server-features
- unrelated cleanup outside the blocker signature `deterministic_failure|npm-run-inspector-mock|no-path-details`
- manual queue edits that bypass the normal promotion return path

## Exit criteria

1. The repeated blocker is reproduced or conclusively explained with concrete evidence.
2. npm run inspector:mock pass without the blocker signature recurring.
3. The RCA task can promote back to `inspector-full-server-features` without manual queue surgery.
4. The parent task log records the blocker resolution before work returns to `inspector-full-server-features`.

## Required checks

- `npm run inspector:mock`

## Evaluator notes

Promote only when the blocker-specific evidence is explicit and the queue can safely return to `inspector-full-server-features`.

## Blocker evidence

- Parent task: `inspector-full-server-features`
- Blocker kind: `deterministic_failure`
- Blocker summary: Repeated required-command failure: npm run inspector:mock
- Blocker signature: `deterministic_failure|npm-run-inspector-mock|no-path-details`
- Related path: none captured
- Artifact: none captured
- Saved deterministic failure evidence: `state/deterministic-checks.json` and `state/evaluation.json` show `npm run inspector:mock` stopped during `== Health and operator config` with `Inspector failed: fetch failed`.
- Isolated blocker signature: local loopback target was unreachable before any MCP feature assertion; no endpoint/resource/prompt/OAuth assertion failure was captured.

## Progress log

- 2026-05-13T10:21:00.428Z: Auto-generated RCA/fix plan for repeated blocker `deterministic_failure|npm-run-inspector-mock|no-path-details` while working on `inspector-full-server-features`.
- 2026-05-13T10:23:17Z: Conclusively explained the repeated blocker from saved Ralph evidence: the required command failed before health with `Inspector failed: fetch failed`, meaning the local Inspector CLI depended on a reachable loopback server after Playwright's E2E server had already stopped.
- 2026-05-13T10:23:17Z: Extended the existing loopback-only route-handler fallback in `scripts/mock-inspector.mjs` from sandbox `EPERM` failures to local `ECONNREFUSED` failures, preserving remote and HTTPS behavior while allowing the required command path to run deterministically when no dev server is listening.
- 2026-05-13T10:23:17Z: Verified the no-server failure class with `npm run inspector:mock -- --base-url http://127.0.0.1:3199`; it passed through health, config, OAuth metadata, tools, resources, prompts, completion, SSE notifications, Basic, OAuth permission filtering, audit, reset guard, and cleanup evidence.
- 2026-05-13T10:23:17Z: Verified the required command `npm run inspector:mock`; it passed with final output `Inspector completed successfully.` The RCA task retains `next_task_on_success: inspector-full-server-features`, so normal promotion can return to the parent task without manual queue edits.
- 2026-05-13T10:26:02.472Z: automatically promoted after deterministic checks and evaluator approval.
