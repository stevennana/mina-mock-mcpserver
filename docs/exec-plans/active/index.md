# Ralph Loop Active Task Queue

This directory contains only runnable feature and hardening tasks. Completed task history lives under `docs/exec-plans/completed/`.

## Current recommended sequence

The Resources/Prompts wave has been promoted. There are no active runnable tasks in this queue right now.

Completed task history lives under `docs/exec-plans/completed/`. Start the next wave by updating the relevant product/design docs first, then add new focused active plans.

## Queue rationale

The completed Resources/Prompts wave was intentionally split by risk boundary:

- schema/domain first, before UI or runtime capability advertisement
- each admin surface has a focused UI task with screenshot/responsive/accessibility gates
- runtime handlers are separated from OAuth filtering so no-auth/Basic protocol behavior can stabilize first
- SSE notification support is isolated because it is session-stateful and intentionally in-memory
- Inspector/docs are final hardening, not the place to introduce new protocol behavior

## Promotion rules

- Required commands in each task are hard gates.
- Failing deterministic checks block promotion even when the implementation looks complete.
- UI-heavy tasks use deterministic screenshot, responsive, and accessibility proof.
- External-client behavior such as MCP, OAuth, SSE, and upstream Inspector compatibility requires E2E proof before promotion.
- Completed task files must be moved to `docs/exec-plans/completed/` and removed from this active directory.
- `025-inspector-compatibility-pack` and `026-inspector-popup-oauth-flow` are completed history and are intentionally not part of this active wave.

## Maintenance notes

- Keep `taskmeta.order` aligned with the next active sequence when one exists.
- Do not collapse multiple MCP feature fronts into one broad task.
- If a task needs behavior not described by `docs/product-specs/mcp-resources-prompts.md`, update the product spec before implementation.
