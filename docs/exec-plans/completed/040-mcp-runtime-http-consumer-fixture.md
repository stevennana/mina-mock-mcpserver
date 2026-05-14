# MCP Runtime HTTP And Consumer Fixture

```json taskmeta
{
  "id": "mcp-runtime-http-consumer-fixture",
  "title": "MCP Runtime HTTP And Consumer Fixture",
  "order": 40,
  "status": "completed",
  "next_task_on_success": "mock-server-runtime-adapter-migration",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/design-docs/mcp-runtime-library-architecture.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run mcp-runtime:build",
    "npm run mcp-runtime:test"
  ],
  "required_files": [
    "packages/mcp-runtime/src/http.ts",
    "packages/mcp-runtime/src/index.ts"
  ],
  "human_review_triggers": [
    "The HTTP adapter takes ownership of application auth or storage policy.",
    "The consumer fixture imports from Mock Server app paths.",
    "The task starts migrating Mock Server routes before the HTTP helper is independently tested."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-14T07:35:29.412Z"
}
```

## Objective
Add the optional Fetch-compatible HTTP adapter and prove the package can be consumed by a small external-app-style fixture.

## Scope
- Implement `createMcpFetchHandler` or equivalent Fetch `Request`/`Response` helper on top of the core handler.
- Handle JSON parse failures, MCP protocol-version headers, response content types, and provider context injection in the HTTP adapter.
- Keep CORS, OAuth challenges, Basic/Bearer parsing, and SSE transport state outside the package.
- Add a tiny consumer fixture test that defines a published-content resources provider and exercises `initialize`, `resources/list`, and `resources/read` through the public package export only.
- Add package docs or README draft text showing a minimal Next.js route using the Fetch helper.

## Out of Scope
- Mock Server route migration.
- Public npm publish automation.
- Production auth middleware for downstream apps.

## Exit Criteria
- A minimal external consumer can use the package without `@/` aliases, Next.js app imports, Prisma, or Mock Server domain types.
- The HTTP adapter is useful for Minakeep-style Next.js apps but does not own app auth.
- Package declaration output includes the HTTP helper.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`

## Evaluator Notes
- Confirm the fixture resembles a downstream npm consumer, not an app-internal unit test.
- Confirm the HTTP layer stays thin and delegates protocol behavior to core.

## Progress Log
- 2026-05-14T00:00:00Z: seeded as the external consumer proof task.

## Progress log

- 2026-05-14T07:30:19.999Z: restored as current task after mcp-runtime-tools-prompts-json-rpc promotion.
- 2026-05-14T07:34:35Z: added `createMcpFetchHandler` and public HTTP exports, covered JSON parse failures, protocol-version headers, response content types, raw responses, and request-derived provider context injection; added a published-content consumer fixture through the public package export plus README draft Next.js route docs. Verified `npm run lint`, `npm run typecheck`, `npm run mcp-runtime:build`, and `npm run mcp-runtime:test` pass.
- 2026-05-14T07:35:29.412Z: automatically promoted after deterministic checks and evaluator approval.
