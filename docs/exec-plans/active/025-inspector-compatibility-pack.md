# 025 Inspector Compatibility Pack

## taskmeta
- id: inspector-compatibility-pack
- order: 25
- status: active
- promotion_mode: deterministic_only
- next_task_on_success: null

## Goal
Make MCP Mock Server easier to verify from the upstream `npx @modelcontextprotocol/inspector` UI and CLI across no-auth, Basic, OAuth Bearer, Streamable HTTP, and SSE-compatible flows.

## Clarity notes
- Streamable HTTP remains the primary modern MCP transport.
- The server should still support a lightweight SSE path so Inspector users who choose `transport=sse` can connect without needing a different mock target.
- This pack favors mock-server interoperability over strict production-origin restrictions.
- Browser-based tools should be able to read discovery, JWKS, token, REST, and MCP responses without CORS surprises.
- OAuth compatibility should move closer to standard MCP client expectations by advertising PKCE and a standard revocation endpoint.

## Non-goals
- Full stateful MCP session management with persistent server-to-client notifications.
- Dynamic Client Registration.
- Production-grade OAuth identity management.
- Resources, prompts, sampling, elicitation, or long-running task execution.
- Replacing the standalone local inspector UI with upstream Inspector source.

## Implementation steps
1. Add this plan and update related specs/docs before code changes.
2. Add shared public CORS helpers and apply them to MCP, REST, OAuth metadata, JWKS, token, and revocation routes.
3. Add Streamable HTTP GET SSE support on `/mcp`, `/mcp/none`, `/mcp/basic`, and `/mcp/oauth` with auth behavior matching each route.
4. Add legacy-style SSE aliases `/sse`, `/sse/none`, `/sse/basic`, and `/sse/oauth` that keep a live stream open, emit an `endpoint` event pointing clients to the matching message POST route, and send JSON-RPC responses back as SSE `message` events.
5. Add standard OAuth revocation endpoint `/oauth/revoke` and advertise it in authorization-server metadata.
6. Add PKCE fields to authorization-code storage, support `code_challenge_method=S256`, and require `code_verifier` when a challenge was used.
7. Add upstream Inspector launch/config examples to the Mock UI `/inspector` page and static config files.
8. Update README with `npx @modelcontextprotocol/inspector` UI and CLI verification commands for every auth mode and SSE path.
9. Add E2E coverage for CORS, SSE, PKCE, revocation, and Inspector config/guide output.

## Expected result
- A user can open upstream Inspector against the deployed server with query params for no-auth, Basic, OAuth, Streamable HTTP, and SSE targets.
- `npx @modelcontextprotocol/inspector --cli` works for no-auth, Basic, OAuth Bearer, and SSE-compatible targets where supported by Inspector.
- Browser clients can call mock runtime/discovery/token routes without CORS failures.
- OAuth authorization-code clients can use PKCE S256 and standard token revocation.
- README contains copy-ready commands for local and deployed verification.

## Objections / risks to avoid
- Do not claim full session/resumability; the SSE bridge is in-memory and local-test oriented.
- Do not persist raw Bearer tokens or client secrets beyond issuance.
- Do not make admin mutation CORS policy look like enterprise protection; this is still public mock infrastructure.
- Do not break current no-auth, Basic, and OAuth E2E flows.

## Validation
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e -- tests/e2e/mcp-initialize-list.spec.ts tests/e2e/oauth-code-token.spec.ts tests/e2e/oauth-discovery.spec.ts tests/e2e/oauth-permissions.spec.ts tests/e2e/rest-tools-list.spec.ts tests/e2e/rest-tools-call.spec.ts tests/e2e/operator-config.spec.ts`
- `npm run inspector:mock`
- `npx -y @modelcontextprotocol/inspector@0.21.2 --cli http://127.0.0.1:3100/mcp/none --transport http --method tools/list`
