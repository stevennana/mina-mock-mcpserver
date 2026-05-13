# MCP Prompts And Completion Runtime

```json taskmeta
{
  "id": "mcp-prompts-completion-runtime",
  "title": "MCP Prompts And Completion Runtime",
  "order": 32,
  "status": "active",
  "next_task_on_success": "oauth-resource-prompt-permissions",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit -- tests/unit/mcp-prompts-runtime.test.ts",
    "npm run test:e2e -- tests/e2e/mcp-prompts-completion.spec.ts"
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
Implement MCP Prompts and Completion runtime methods over existing Streamable HTTP and legacy SSE transports.

## Clarity notes
- This slice may advertise `prompts` and `completions` after handlers are in place.
- Completion supports prompt arguments and resource-template arguments only.

## Scope
- Extend `initialize` capabilities with `prompts: { listChanged: true }` and `completions: {}`.
- Implement `prompts/list`, `prompts/get`, and `completion/complete`.
- Validate required prompt arguments and substitute arguments into text messages.
- Resolve embedded server resources only when the referenced resource is enabled and readable.
- Return JSON-RPC `-32602` for invalid prompt names, missing required args, and malformed completion refs.

## Out of scope
- OAuth permission filtering.
- LLM execution, sampling, elicitation, or roots.
- Image/audio prompt content.

## Expected result
- A standard MCP client can discover prompts, render a prompt with arguments, and request completions for prompt/resource-template arguments.
- Completion responses are bounded to 100 values and expose `total`/`hasMore`.

## Exit criteria
- A standard MCP client can discover prompts, render a prompt with arguments, and request completions for prompt/resource-template arguments.
- Completion responses are bounded to 100 values and expose `total`/`hasMore`.

## Objections / risks to avoid
- Do not make prompt execution model-controlled.
- Do not persist completion request values.
- Do not leak disabled embedded resource content.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- tests/unit/mcp-prompts-runtime.test.ts`
- `npm run test:e2e -- tests/e2e/mcp-prompts-completion.spec.ts`
- Upstream Inspector CLI checks for `prompts/list`, `prompts/get`, and `completion/complete`.

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T07:53:16.034Z: restored as current task after mcp-resources-runtime promotion.
- 2026-05-13T08:01:30Z: implemented Streamable HTTP and legacy SSE handlers for prompts/list, prompts/get, and completion/complete; prompt rendering substitutes text arguments and resolves embedded resources only through enabled resource reads. Added unit and E2E coverage for discovery, rendering, completion bounds metadata, invalid params, and disabled embedded resource protection.
