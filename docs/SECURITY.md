# SECURITY.md

## Purpose
Define the security posture for MCP Mock Server's current shipped slice.

## Core Security Rules
- protocol-facing mock routes are intentionally CORS-open for local/browser Inspector compatibility; do not treat this mock server as an enterprise security boundary
- unsupported Authorization schemes return 401
- invalid Basic/Bearer credentials never downgrade to no-auth
- OAuth tokens must verify signature, issuer, audience, expiry, jti revocation, and endpoint permissions
- Valid OAuth Bearer tokens with insufficient endpoint permissions return 403; failed Bearer authentication returns 401 and must not fall back to another auth mode
- built-in identities and clients cannot be disabled or deleted through normal UI/API flows
- built-in Basic Auth identities also cannot have passwords changed through normal UI/API flows
- built-in OAuth login identities also cannot have passwords or token TTLs changed through normal UI/API flows
- built-in OAuth clients cannot be disabled, deleted, edited, or assigned regenerated secrets through normal UI/API flows
- root password comparisons must avoid logging and should use constant-time comparison where practical

## Secrets and Config
- ROOT_PASSWORD gates reset, delete override, base URL override, and optional historical token deletion
- Docker Compose includes a placeholder `ROOT_PASSWORD`; operators must replace it before public use.
- Base URL override changes require ROOT_PASSWORD and write non-secret audit evidence for success and failure
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
- Issued token inspection APIs and UI expose stored claim metadata and endpoint permissions only; they must not return raw access token values after issuance
- Token revocation preserves historical issued-token records, sets `revokedAt`, and makes subsequent Bearer validation fail as invalid token authentication with `401`
- `/oauth/jwks` publishes only the public RS256 verification key with the active token `kid`; private key parameters must never be present in the JWKS response
- OAuth discovery metadata must describe implemented mock capabilities only and must not advertise refresh tokens, external providers, or unimplemented behavior
- raw JWT values are shown only at issuance unless a config explicitly permits storage
- LOG_LEVEL controls verbosity but must not expose secrets even at trace/debug
- Operator logger metadata redacts secret-looking keys before writing to stdout or `start:logged` log files
- Built-in HTTPS uses `TLS_CERT_FILE` and `TLS_KEY_FILE` for local protocol/client tests; certificate content, key content, and `TLS_KEY_PASSPHRASE` must not be logged or exposed through public config
- Inspector self-signed HTTPS support must be opt-in per run and must not disable TLS verification process-wide

## Public Surfaces
- public admin UI routes and /api/* mutation endpoints
- MCP routes /mcp, /mcp/none, /mcp/basic, /mcp/oauth and legacy SSE aliases /sse, /sse/none, /sse/basic, /sse/oauth
- REST mock routes /rest/tools and /rest/tools/:name/call
- OAuth browser, token, revocation, discovery, and JWKS routes
- health and public config endpoints

## Deployment Notes
- Run behind TLS when exposing the mock server publicly; the provided Nginx example is a reverse-proxy starting point, not a complete TLS or rate-limit policy.
- App-level HTTPS via `npm run start:tls` is intended for local testing and integration labs. Prefer reverse-proxy TLS termination for public deployments.
- Set `APP_BASE_URL` to the public `https://` origin in deployed environments, or rely on trusted `X-Forwarded-Host` and `X-Forwarded-Proto` headers from the reverse proxy.
- Do not store sensitive customer data in SQLite; the admin UI is intentionally public for the MVP.

## Verification
- unit tests for password hashing, auth precedence, root checks, built-in immutability, JWT signing/claims, code exchange failure cases, and permission denial
- E2E tests for Basic 401/success and OAuth 401/403/revocation
- reset tests prove endpoint defaults are recreated after root-password and confirmation checks
- audit tests prove failed delete attempts and reset events are recorded
