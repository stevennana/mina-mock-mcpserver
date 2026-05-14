# MCP Runtime Tools Prompts JSON-RPC

```json taskmeta
{
  "id": "mcp-runtime-tools-prompts-json-rpc",
  "title": "MCP Runtime Tools Prompts JSON-RPC",
  "order": 39,
  "status": "active",
  "next_task_on_success": "mcp-runtime-http-consumer-fixture",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/design-docs/mcp-runtime-library-architecture.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md",
    "docs/RELIABILITY.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run mcp-runtime:build",
    "npm run mcp-runtime:test"
  ],
  "required_files": [
    "packages/mcp-runtime/src/core.ts",
    "packages/mcp-runtime/src/types.ts",
    "packages/mcp-runtime/src/index.ts"
  ],
  "human_review_triggers": [
    "Tool runtime imports endpoint catalog or Mock Server app modules.",
    "Raw tool-call outcomes lose the malformed-response escape hatch needed by Mock Server.",
    "Prompt or completion behavior is hard-coded to seeded Mock Server fixtures."
  ],
  "promotion_mode": "deterministic_only"
}
```

## Objective
Add optional MCP tools, prompts, and completion JSON-RPC handling to the reusable runtime package without coupling it to Mock Server endpoint or prompt catalogs.

## Scope
- Implement `tools/list`, `tools/call`, `prompts/list`, `prompts/get`, and `completion/complete` dispatch on top of the core handler.
- Preserve raw tool-call outcomes so Mock Server can keep malformed-response simulation during the later app migration.
- Map invalid params, not-found, forbidden, tool error, provider protocol error, and unsupported optional methods through package-owned MCP error responses.
- Add package unit tests for tool list/call success, tool error, raw tool outcome, prompt list/get, prompt argument validation delegation, completion success, and unsupported optional methods.

## Out of Scope
- Resource method dispatch already covered by the previous task.
- Fetch `Request`/`Response` adapter.
- Mock Server app migration.
- App-level endpoint matching, failure simulation authoring, auth, CORS, SSE session storage, OAuth challenges, and audit logging.

## Exit Criteria
- Tools, prompts, and completion tests pass using only package-owned provider fixtures.
- Capabilities are advertised only for optional providers that are actually supplied.
- Package resources and core foundation tests still pass.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`

## Evaluator Notes
- Confirm tools are optional and generic; the package must not know about Mock Server endpoint CRUD or exact-match response cases.
- Confirm raw outcomes are explicitly typed rather than leaking endpoint runtime objects into the package.

## Progress Log
- 2026-05-14T00:00:00Z: split out from the broad reusable JSON-RPC core task.

