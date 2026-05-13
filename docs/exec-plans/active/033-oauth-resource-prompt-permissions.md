# OAuth Resource And Prompt Permissions

```json taskmeta
{
  "id": "oauth-resource-prompt-permissions",
  "title": "OAuth Resource And Prompt Permissions",
  "order": 33,
  "status": "active",
  "next_task_on_success": "mcp-resource-subscription-notifications",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/SECURITY.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit -- tests/unit/oauth-token.test.ts tests/unit/mcp-permissions.test.ts",
    "npm run test:e2e -- tests/e2e/oauth-resource-prompt-permissions.spec.ts tests/e2e/oauth-consent.spec.ts"
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
Extend mock OAuth clients, consent, authorization codes, issued tokens, and runtime enforcement to cover tool, resource, and prompt permissions.

## Clarity notes
- Existing endpoint permissions become the tool-permission group.
- No-auth and Basic remain unrestricted for enabled mock features.
- OAuth Bearer list methods must filter results; read/get methods must deny unselected IDs.

## Scope
- Add resource and prompt allowed sets to OAuth clients.
- Add resource and prompt selected permissions to authorization codes and issued-token metadata.
- Update OAuth consent UI to group Tools, Resources, and Prompts.
- Update `/mcp/oauth`, `/sse/oauth`, and unified Bearer behavior to filter/deny resources and prompts.
- Update token UI detail to show resource/prompt permission summaries.

## Out of scope
- External OAuth providers.
- Refresh tokens.
- Enterprise RBAC or private admin UI.

## Expected result
- A valid Bearer token can list/read/get only selected resources and prompts.
- Unselected resource or prompt access returns `403` with JSON-RPC error data, while invalid tokens still return `401`.
- Consent and token screens make selected permissions understandable.

## Exit criteria
- A valid Bearer token can list/read/get only selected resources and prompts.
- Unselected resource or prompt access returns `403` with JSON-RPC error data, while invalid tokens still return `401`.
- Consent and token screens make selected permissions understandable.

## Objections / risks to avoid
- Do not reuse endpoint IDs as resource/prompt IDs.
- Do not silently grant all resources/prompts to existing OAuth clients unless seed/default migration explicitly records that behavior for test compatibility.
- Do not expose raw tokens after issuance.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- tests/unit/oauth-token.test.ts tests/unit/mcp-permissions.test.ts`
- `npm run test:e2e -- tests/e2e/oauth-resource-prompt-permissions.spec.ts tests/e2e/oauth-consent.spec.ts`

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T08:05:20.793Z: restored as current task after mcp-prompts-completion-runtime promotion.
- 2026-05-13T18:05:00+09:00: added OAuth client, authorization-code, token-claim, and stored-token metadata for resource and prompt permissions; Bearer MCP runtime now filters resources/prompts and returns JSON-RPC 403 for valid-token permission denials.
- 2026-05-13T18:05:00+09:00: updated consent/client/token UI copy and controls to group Tools, Resources, and Prompts; added unit and E2E coverage for resource/prompt permission filtering and denial paths.
- 2026-05-13T18:05:00+09:00: required checks passed: lint, typecheck, targeted unit command, and targeted E2E command.
