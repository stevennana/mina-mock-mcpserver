# PRD Analysis

Source: `PRD/mcp_mock_server_prd.md`

## Product Commitments

- Public remote MCP mock server with a web UI, MCP JSON-RPC routes, REST mock routes, Basic Auth, and mock OAuth bearer auth.
- The UI is intentionally public; destructive operations use an 8-digit endpoint delete code or root password where specified.
- OAuth is a mock authorization server, not a production identity service.
- SQLite persistence is required across restarts.
- Deployment should work directly and behind Nginx, with TLS termination at the proxy.

## Distinct Feature Fronts

- Endpoint/tool management with parameters, response cases, delete protection, reset, and generated MCP schema.
- MCP JSON-RPC runtime for `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`.
- REST tool list and call routes sharing the same endpoint catalog.
- Basic Auth user management and strict Basic route behavior.
- OAuth user/client management, browser consent, client credentials, JWT issuance, discovery metadata, token UI, and revocation.
- Failure simulation for delays, forced errors, timeouts, malformed responses, and audit evidence.
- Operator configuration for base URL, root reset, health, logs, Docker/Nginx guidance, and startup proof.

## Verification Implications

- Auth precedence must be unit-tested: invalid Basic or Bearer headers cannot downgrade to no-auth.
- OAuth permission behavior needs E2E proof before promotion: allowed endpoint succeeds, denied endpoint returns `403`, revoked/expired/invalid token returns `401`.
- MCP JSON-RPC response formatting should be contract-tested separately from endpoint matching.
- UI-heavy endpoint, OAuth, token, and config surfaces need Playwright screenshot, responsive, and accessibility proof.
- Runtime state makes `npm run start:smoke` mandatory; `build` alone is not enough evidence.
