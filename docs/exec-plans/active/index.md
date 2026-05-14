# Ralph Loop Active Task Queue

This directory contains only runnable feature and hardening tasks. Completed task history lives under `docs/exec-plans/completed/`.

## Current recommended sequence

The next runnable wave extracts the reusable MCP JSON-RPC runtime package and then migrates MCP Mock Server to consume it. This wave is intentionally library-first: the package API must become clean and testable before the app is migrated.

1. `036-mcp-runtime-package-foundation.md` -> create the package boundary, public types, build/test scripts, and consumer-style import proof.
2. `037-mcp-runtime-core-json-rpc.md` -> implement JSON-RPC envelope, initialization, capability, and error-mapping foundations.
3. `038-mcp-runtime-resources-json-rpc.md` -> implement resources, resource templates, resource reads, pagination, and optional subscription dispatch.
4. `039-mcp-runtime-tools-prompts-json-rpc.md` -> implement optional tools, prompts, completion, and raw tool-call outcomes.
5. `040-mcp-runtime-http-consumer-fixture.md` -> add the optional Fetch adapter and external consumer fixture proof.
6. `041-mock-server-runtime-adapter-migration.md` -> migrate Mock Server runtime routes/tests to consume `@minasoft/mcp-runtime`.
7. `042-mcp-runtime-inspector-docs-hardening.md` -> run final E2E/Inspector proof and document downstream consumption.

Completed task history lives under `docs/exec-plans/completed/`.

## Queue rationale

The runtime library wave is split by boundary risk:

- package API and public type stability come before protocol implementation
- core JSON-RPC behavior is split by foundation, resources, and tools/prompts so Ralph can isolate failures
- the Fetch helper and consumer fixture prove downstream npm usability before production app migration
- Mock Server migration proves this package is the real protocol path, not a sidecar implementation
- final Inspector/docs hardening proves compatibility and explains Minakeep-style consumption

## Promotion rules

- Required commands in each task are hard gates.
- Failing deterministic checks block promotion even when the implementation looks complete.
- UI-heavy tasks use deterministic screenshot, responsive, and accessibility proof.
- External-client behavior such as MCP, OAuth, SSE, and upstream Inspector compatibility requires E2E proof before promotion.
- Completed task files must be moved to `docs/exec-plans/completed/` and removed from this active directory.
- `025-inspector-compatibility-pack` and `026-inspector-popup-oauth-flow` are completed history and are intentionally not part of this active wave.
- This wave must not promote if `@minasoft/mcp-runtime` exists but Mock Server still uses the old app-local MCP protocol/type modules.

## Maintenance notes

- Keep `taskmeta.order` aligned with the next active sequence when one exists.
- Do not collapse multiple MCP feature fronts into one broad task.
- If a task needs behavior not described by `docs/design-docs/mcp-runtime-library-architecture.md` or the MCP product specs, update the supporting docs before implementation.
