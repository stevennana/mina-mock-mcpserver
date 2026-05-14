# Ralph Loop Active Task Queue

This directory contains only runnable feature and hardening tasks. Completed task history lives under `docs/exec-plans/completed/`.

## Current recommended sequence

There are no active runnable Ralph tasks right now.

The MCP runtime extraction wave (`036` through `042`) has been completed and moved to `docs/exec-plans/completed/`. The direct follow-up hardening for public package readiness was handled outside the Ralph queue by adding package metadata, pack verification, an external tarball consumer smoke, package docs, and the public npm release for `@minasoft/mcp-runtime`.

## Queue rationale

Keep this directory empty except for truly runnable next tasks. When the next wave starts, add small executable plans with:

- clear feature boundaries
- explicit satisfaction goals
- hard-gate validation commands
- affected docs and implementation files
- promotion notes that explain what changed

## Promotion rules

- Required commands in each task are hard gates.
- Failing deterministic checks block promotion even when the implementation looks complete.
- UI-heavy tasks use deterministic screenshot, responsive, and accessibility proof.
- External-client behavior such as MCP, OAuth, SSE, and upstream Inspector compatibility requires E2E proof before promotion.
- Completed task files must be moved to `docs/exec-plans/completed/` and removed from this active directory.

## Maintenance notes

- Keep `taskmeta.order` aligned with the next active sequence when one exists.
- Do not collapse multiple MCP feature fronts into one broad task.
- If a task needs behavior not described by `docs/design-docs/mcp-runtime-library-architecture.md` or the MCP product specs, update the supporting docs before implementation.
