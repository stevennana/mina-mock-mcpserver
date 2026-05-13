# Inspector Popup OAuth Flow

```json taskmeta
{
  "id": "inspector-popup-oauth-flow",
  "title": "Inspector Popup OAuth Flow",
  "order": 26,
  "status": "completed",
  "next_task_on_success": null,
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/FRONTEND.md",
    "docs/INSPECTOR.md",
    "docs/product-specs/oauth-consent-and-token-runtime.md",
    "docs/product-specs/operator-configuration.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit",
    "npm run test:e2e -- tests/e2e/standalone-inspector.spec.ts tests/e2e/oauth-code-token.spec.ts tests/e2e/oauth-consent.spec.ts"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task persists OAuth secrets in browser storage.",
    "The task replaces Mock Server OAuth pages instead of testing them.",
    "Required E2E does not prove popup login/consent/token exchange."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-13T00:00:00.000Z",
  "completion_note": "Reconciled during MCP Resources/Prompts queue refresh; implementation was already completed before this wave."
}
```

## Objective
Add a project-owned browser OAuth authorization-code flow to the standalone Inspector UI so users can test the full Mock OAuth user login, consent permission selection, redirect callback, token exchange, and Bearer MCP verification path without relying on upstream Inspector's OAuth UI.

## Clarity notes
- Upstream MCP Inspector remains the recommended generic MCP protocol debugger.
- The project standalone Inspector should cover Mock Server product-specific flows that upstream Inspector does not make easy, especially local OAuth login and endpoint-permission consent.
- The popup flow uses standard OAuth authorization code with PKCE S256.
- The standalone Inspector owns the callback route at `/oauth-callback`, receives `code` and `state`, and exchanges the code through Mock Server `/oauth/token`.
- The flow should be visible and step-based: prepare client, open popup, complete login/consent, exchange code, send token to Generic MCP target, verify MCP OAuth.
- To keep the first run easy, the Inspector may create a temporary OAuth client with redirect URI pointing to the standalone Inspector callback and allowed endpoints copied from enabled Mock Server endpoints.

## Upstream Inspector feature references
- Keep manual Authorization helper behavior: no-auth, Basic, and Bearer header setup.
- Keep server/target configuration copyability where practical.
- Keep history-style step evidence and diagnostics.
- Use PKCE authorization-code flow for browser OAuth verification.
- Do not require Dynamic Client Registration in this project-owned Mock Server flow; the helper creates or uses a pre-registered Mock OAuth client through the Mock Server admin API instead.

## Out of scope
- Do not vendor or fork upstream MCP Inspector.
- Do not implement Dynamic Client Registration in this slice.
- Do not persist Bearer tokens, Basic passwords, OAuth client secrets, authorization codes, code verifiers, or popup state in browser storage.
- Do not replace Mock Server's own OAuth login/consent pages.
- Do not make the standalone Inspector a production OAuth client.

## Scope
- Standalone Inspector OAuth popup page and callback.
- PKCE prepare/exchange helpers.
- Generic MCP target handoff and Bearer verification.
- Docs and E2E coverage for the popup OAuth flow.

## Implementation steps
1. [x] Update docs and specs to define the new `/oauth` standalone Inspector workflow before code changes.
2. [x] Add standalone Inspector routes:
   - `GET /oauth`
   - `GET /oauth-callback`
   - `POST /api/oauth-popup/prepare`
   - `POST /api/oauth-popup/exchange`
3. [x] Add server helpers for PKCE verifier/challenge, random state, temporary OAuth client creation, endpoint permission discovery, and code exchange.
4. [x] Add an OAuth popup page with one primary flow:
   - choose Mock Server base URL
   - choose/create OAuth client
   - open login/consent popup
   - receive callback code
   - exchange token
   - send Bearer token to Generic MCP target
5. [x] Enhance Generic MCP target with clearer upstream-Inspector-inspired actions:
   - copy current target config JSON
   - import/export target preset JSON
   - keep compact request history for current page session only
6. [x] Update README, `docs/INSPECTOR.md`, and `docs/FRONTEND.md`.
7. [x] Add E2E coverage for popup OAuth callback, token exchange, send-to-generic, and Generic MCP Bearer verification.

## Expected result
- A user can open `npm run inspector:ui`, choose OAuth authorization-code flow, and run the user/password/permission consent path in a popup.
- The callback code is captured by the standalone Inspector page without requiring a real external callback server.
- The exchanged Bearer token can be sent into Generic MCP target and used against `/mcp/oauth`.
- Docs show when to use upstream Inspector versus the project-owned OAuth popup helper.

## Exit criteria
- A user can open `npm run inspector:ui`, choose OAuth authorization-code flow, and run the user/password/permission consent path in a popup.
- The callback code is captured by the standalone Inspector page without requiring a real external callback server.
- The exchanged Bearer token can be sent into Generic MCP target and used against `/mcp/oauth`.
- Docs show when to use upstream Inspector versus the project-owned OAuth popup helper.

## Objections / risks to avoid
- Avoid storing secrets in localStorage.
- Avoid screenshots or docs with raw Bearer tokens.
- Avoid coupling the helper to only the built-in `default/default` user; the popup login page should accept any enabled Mock OAuth user.
- Avoid hiding redirect/callback details; users need to understand which callback URL is registered.
- Avoid claiming the helper is a generic OAuth client for arbitrary authorization servers.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e -- tests/e2e/standalone-inspector.spec.ts tests/e2e/oauth-code-token.spec.ts tests/e2e/oauth-consent.spec.ts`
- Manual browser check: `npm run inspector:ui`, open `/oauth`, complete popup login/consent with `default/default`, exchange token, send to `/generic`, run `/mcp/oauth` tools/list.

## Evaluator notes

- Confirm completed history remains consistent with implemented standalone Inspector popup OAuth behavior.

## Progress log

- 2026-05-13T00:00:00Z: converted completed task to Ralph-readable taskmeta during next-wave state repair.
