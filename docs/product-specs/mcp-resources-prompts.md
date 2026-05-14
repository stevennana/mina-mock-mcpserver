# MCP Resources, Prompts, And Completion

## Goal
Expand MCP Mock Server beyond tool calls so users can test the full server-side MCP feature set: Tools, Resources, Prompts, Completion, and resource subscription notifications.

## Trigger / Entry
- Admin UI users configure mock Resources, Resource Templates, and Prompts.
- MCP clients call `resources/*`, `prompts/*`, and `completion/complete` over existing Streamable HTTP and legacy SSE routes.
- OAuth users select tool, resource, and prompt permissions during browser consent.

## User-Visible Behavior
- Resources are read-only context objects exposed through MCP. A resource has a stable URI, name, optional title/description, MIME type, enabled state, text or base64 blob content, and optional annotations.
- Resource Templates are dynamic resource descriptors with URI templates, named arguments, sample values, completion candidates, and rendered mock content.
- Prompts are user-invoked templates with named arguments and ordered messages. Prompt messages may include text content and embedded server resource content.
- Completion supports prompt arguments and resource-template arguments through `completion/complete` with prefix matching, maximum 100 returned values, optional total, and `hasMore`.
- No-auth and Basic routes expose all enabled tools/resources/prompts.
- OAuth Bearer routes expose only the enabled tools/resources/resource templates/prompts included in the token permissions.
- Unknown, disabled, or unauthorized resources/prompts never leak content. Authentication failures remain `401`; valid Bearer tokens without permission return `403`.
- Prompt messages that embed resources must use the same permission-aware resource reader as direct `resources/read`; a token with prompt permission but without embedded resource or resource-template permission receives `403` instead of embedded content.

## MCP Runtime Contract
- `initialize` advertises:
  - `tools: { listChanged: false }`
  - `resources: { subscribe: true, listChanged: true }`
  - `prompts: { listChanged: true }`
  - `completions: {}`
- `resources/list` returns enabled direct resources, supports cursor pagination, and includes URI, name, title, description, MIME type, size, and annotations when present.
- `resources/templates/list` returns enabled templates, supports cursor pagination, and includes URI template, name, title, description, MIME type, and annotations when present.
- `resources/read` returns text or blob contents for a direct URI or a rendered template URI.
- `resources/subscribe` and `resources/unsubscribe` are supported only for live legacy SSE sessions and return empty success results for valid accessible resources. Subscription state is process-local and best-effort; it is not stored in SQLite and is not replayed after disconnects, restarts, or cross-process handoff.
- `prompts/list` returns enabled prompts, supports cursor pagination, and includes name, title, description, and argument metadata.
- `prompts/get` validates required arguments and returns ordered prompt messages with substituted text and optional embedded resource content.
- `completion/complete` supports `ref/prompt` by prompt name and `ref/resource` by URI template.
- Resource-not-found errors use JSON-RPC `-32002`; invalid params use `-32602`; unsupported methods continue to use `-32601`.

## Admin UI Contract
- Add `Resources`, `Resource Templates`, and `Prompts` under the Tools group.
- Catalog pages show list/search/status and one primary create CTA.
- Detail pages use focused sub-routes for overview, edit, content/messages, completion candidates, console/test, and delete.
- Consoles show raw request/response evidence for list/read/get/complete operations and route-specific auth mode.
- Beginner-facing tooltips explain resources as application-controlled context and prompts as user-controlled templates.

## OAuth Permission Contract
- OAuth clients define allowed tools, direct resources, resource templates, and prompts.
- Authorization codes store selected tool/resource/resource-template/prompt permissions.
- Issued token metadata exposes permission summaries without raw token persistence.
- Consent UI groups permission checklists by Tools, Resources, Resource Templates, and Prompts and makes selected scope unambiguous.

## Validation
- Unit tests cover validators, rendering, completion matching, JSON-RPC envelopes, permission filters, and error mapping.
- E2E covers admin CRUD, MCP no-auth/Basic/OAuth list/read/get/complete, OAuth consent denial, SSE resource update notifications, and Inspector scenario evidence.
- UI-heavy slices require screenshots, responsive checks, and accessibility checks before deterministic promotion.
