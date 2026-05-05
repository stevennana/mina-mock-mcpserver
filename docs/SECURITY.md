# SECURITY.md

## Purpose
Define the security posture for MCP Mock Server's current shipped slice.

## Core Security Rules
- validate Origin for Streamable HTTP-style MCP routes where browser-origin risk applies
- unsupported Authorization schemes return 401
- invalid Basic/Bearer credentials never downgrade to no-auth
- OAuth tokens must verify signature, issuer, audience, expiry, jti revocation, and endpoint permissions
- built-in identities and clients cannot be disabled or deleted through normal UI/API flows
- built-in Basic Auth identities also cannot have passwords changed through normal UI/API flows
- built-in OAuth login identities also cannot have passwords or token TTLs changed through normal UI/API flows
- built-in OAuth clients cannot be disabled, deleted, edited, or assigned regenerated secrets through normal UI/API flows
- root password comparisons must avoid logging and should use constant-time comparison where practical

## Secrets and Config
- ROOT_PASSWORD gates reset, delete override, base URL override, and optional historical token deletion
- client secrets and passwords are never logged
- endpoint delete audit entries store method/reason metadata, not submitted delete codes or root passwords
- reset audit entries store success/failure reason and seed counts, not submitted root passwords
- passwords are stored only as hashes
- Basic Auth password verification compares submitted credentials against stored hashes without logging submitted passwords
- OAuth login-user passwords are stored only as hashes and are not logged by management APIs
- OAuth client secrets are generated server-side, stored only as hashes, and returned only at creation or regeneration
- OAuth browser consent uses exact registered redirect URI matching and a short-lived signed login ticket before authorization code creation
- OAuth authorization codes are stored as single-use-ready records with expiry, client, redirect URI, user, audience/resource, and selected endpoint bindings
- `/oauth/token` authorization-code exchange requires the same client, client secret, and redirect URI; consumed, expired, mismatched, or unknown codes fail with OAuth-style errors
- `/oauth/token` client-credentials exchange requires a valid enabled client and secret, does not require user login, and intersects requested endpoint scopes with the client's allowed endpoint set
- Access tokens are RS256 JWTs signed with `OAUTH_JWT_PRIVATE_KEY_PEM` when configured, otherwise a documented development key; issued token metadata is stored by `jti`, and raw token values are not persisted
- raw JWT values are shown only at issuance unless a config explicitly permits storage
- LOG_LEVEL controls verbosity but must not expose secrets even at trace/debug

## Public Surfaces
- public admin UI routes and /api/* mutation endpoints
- MCP routes /mcp, /mcp/none, /mcp/basic, /mcp/oauth
- REST mock routes /rest/tools and /rest/tools/:name/call
- OAuth browser, token, revocation, discovery, and JWKS routes
- health and public config endpoints

## Verification
- unit tests for password hashing, auth precedence, root checks, built-in immutability, JWT signing/claims, code exchange failure cases, and permission denial
- E2E tests for Basic 401/success and OAuth 401/403/revocation
- reset tests prove endpoint defaults are recreated after root-password and confirmation checks
- audit tests prove failed delete attempts and reset events are recorded
