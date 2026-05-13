# Ralph Loop Active Task Queue

This directory contains only runnable feature and hardening tasks. Completed task history lives under `docs/exec-plans/completed/`.

## Current recommended sequence

1. `027-mcp-resource-prompt-domain-schema.md` -> `mcp-resource-prompt-domain-schema` -> Add persistence, seed defaults, validators, and services for Resources, Resource Templates, Prompts, and Completion candidates.
2. `028-mcp-resource-management-ui.md` -> `mcp-resource-management-ui` -> Add direct Resource admin UI/API workflows with focused catalog/detail pages.
3. `029-mcp-resource-template-management-ui.md` -> `mcp-resource-template-management-ui` -> Add Resource Template admin UI/API workflows with arguments, rendered content, and completion candidates.
4. `030-mcp-prompt-management-ui.md` -> `mcp-prompt-management-ui` -> Add Prompt admin UI/API workflows with arguments, messages, embedded resources, and completion candidates.
5. `031-mcp-resources-runtime.md` -> `mcp-resources-runtime` -> Implement `resources/list`, `resources/templates/list`, and `resources/read` over existing MCP transports.
6. `032-mcp-prompts-completion-runtime.md` -> `mcp-prompts-completion-runtime` -> Implement `prompts/list`, `prompts/get`, and `completion/complete`.
7. `033-oauth-resource-prompt-permissions.md` -> `oauth-resource-prompt-permissions` -> Extend OAuth consent, tokens, and Bearer runtime filtering to resources and prompts.
8. `034-mcp-resource-subscription-notifications.md` -> `mcp-resource-subscription-notifications` -> Add best-effort legacy SSE resource subscriptions and list/update notifications.
9. `035-inspector-full-server-features.md` -> `inspector-full-server-features` -> Update Inspector/docs and prove full server-side MCP feature coverage end to end.

## Queue rationale

The Resources/Prompts wave is intentionally split by risk boundary:

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

- Keep `taskmeta.order` aligned with this sequence.
- Do not collapse multiple MCP feature fronts into one broad task.
- If a task needs behavior not described by `docs/product-specs/mcp-resources-prompts.md`, update the product spec before implementation.
