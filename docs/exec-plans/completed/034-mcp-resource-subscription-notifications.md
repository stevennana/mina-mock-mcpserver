# MCP Resource Subscription Notifications

```json taskmeta
{
  "id": "mcp-resource-subscription-notifications",
  "title": "MCP Resource Subscription Notifications",
  "order": 34,
  "status": "completed",
  "next_task_on_success": "inspector-full-server-features",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/RELIABILITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md",
    "docs/TRANSPORTS.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit -- tests/unit/mcp-sse-notifications.test.ts",
    "npm run test:e2e -- tests/e2e/mcp-resource-subscriptions.spec.ts"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated MCP feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-13T09:09:12.718Z"
}
```

## Objective
Implement best-effort in-memory resource subscription and list-change notifications for legacy SSE test sessions.

## Clarity notes
- The spec supports `resources/subscribe`, `resources/unsubscribe`, `notifications/resources/updated`, `notifications/resources/list_changed`, and `notifications/prompts/list_changed`.
- This project should keep the behavior local-test oriented and must not claim durable replay.

## Scope
- Track per-session subscribed resource URIs for legacy SSE sessions.
- Implement `resources/subscribe` and `resources/unsubscribe` success/error behavior.
- Emit `notifications/resources/updated` when subscribed resource content changes.
- Emit `notifications/resources/list_changed` and `notifications/prompts/list_changed` for create/update/delete events that affect enabled catalogs.
- Document that Streamable HTTP GET remains a lightweight compatibility stream, not a durable session.

## Out of scope
- Cross-process or cross-restart notification replay.
- Durable Streamable HTTP session persistence.
- Tool list change notifications.

## Expected result
- A legacy SSE client can subscribe to a resource, mutate it through admin UI/API, and observe an update notification on the open stream.
- Prompt/resource list changes are observable in open legacy SSE sessions.

## Exit criteria
- A legacy SSE client can subscribe to a resource, mutate it through admin UI/API, and observe an update notification on the open stream.
- Prompt/resource list changes are observable in open legacy SSE sessions.

## Objections / risks to avoid
- Do not let notification failures break the admin mutation.
- Do not store subscription state in SQLite.
- Do not advertise resumability.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- tests/unit/mcp-sse-notifications.test.ts`
- `npm run test:e2e -- tests/e2e/mcp-resource-subscriptions.spec.ts`

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T08:52:05.662Z: restored as current task after oauth-resource-prompt-permissions promotion.
- 2026-05-13T09:04:52Z: implemented process-local legacy SSE resource subscription tracking, subscribe/unsubscribe JSON-RPC handling, best-effort resource updated and resource/prompt list-change notifications from admin APIs, and focused unit/E2E coverage. Required checks passed: `npm run lint`, `npm run typecheck`, `npm run test:unit -- tests/unit/mcp-sse-notifications.test.ts`, and `npm run test:e2e -- tests/e2e/mcp-resource-subscriptions.spec.ts`.
- 2026-05-13T09:09:12.718Z: automatically promoted after deterministic checks and evaluator approval.
