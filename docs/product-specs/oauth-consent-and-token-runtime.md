# OAuth Consent and Token Runtime

## Goal
The mock OAuth server issues JWT bearer tokens through browser consent and client credentials, with endpoint-level permissions and revocation.

## Trigger / Entry
OAuth users and clients management

## User-Visible Behavior
- OAuth users and clients management
- OAuth user management lists the locked built-in `default/default` login fixture and allows non-built-in users to be created, password-edited, TTL-edited, enabled/disabled, and deleted
- OAuth login-user token TTLs use MVP presets only: 15 minutes, 1 hour, 8 hours, and 24 hours; never-expiring tokens are not available in this slice
- OAuth user passwords are stored as hashes and never returned through the public management API
- OAuth client management lists the locked built-in `default/default` client fixture and allows non-built-in clients to be created, edited, regenerated, disabled/enabled, and deleted
- OAuth client secrets are generated server-side, stored as hashes, and returned only on create or regenerate responses
- OAuth clients store redirect URIs, client credentials TTL presets, and a maximum allowed endpoint set that later consent and client credentials flows must not exceed
- Login and consent flow
- `/oauth/authorize` accepts authorization-code requests only after exact client and registered redirect URI validation
- mock login verifies enabled OAuth users and carries the request to consent with a short-lived signed login ticket
- consent displays client, redirect URI, resource, user, authorization-code TTL, and an endpoint permission checklist constrained to the client's allowed endpoint set
- approving consent creates a single-use-ready authorization code bound to client, redirect URI, user, selected endpoints, resource/audience, state, expiry, and unused status, then redirects with `code` and `state`
- local callback redirects may land on an unavailable test callback host; this is acceptable for manual mock testing as long as the redirect URL contains the authorization `code` and `state`
- Token issuance
- `/oauth/token` supports the `authorization_code` grant with form-encoded `grant_type`, `code`, `redirect_uri`, `client_id`, and `client_secret`
- valid code exchange marks the code used, returns `access_token`, `token_type`, `expires_in`, and `scope`, and stores issued token metadata by JWT `jti`
- `/oauth/token` supports the `client_credentials` grant with form-encoded `grant_type`, `client_id`, `client_secret`, optional `scope`, and optional `resource`; no login or consent UI is involved
- client-credentials tokens use the client credentials TTL, subject `client:<client_id>`, `grant_type=client_credentials`, and endpoint permissions equal to all client-allowed endpoints when no scope is requested or the intersection of requested `endpoint:<endpoint_id>` scopes and client-allowed endpoints when scope is present
- access tokens are RS256 JWTs with issuer, audience/resource, subject, client ID, grant type, issued/expiry times, `jti`, scope, and `endpoint_permissions`
- expired, reused, unknown, redirect-mismatched, client-mismatched, or client-secret-invalid authorization-code exchanges fail with deterministic OAuth-style errors
- Token list/detail/revoke
- `/tokens` and `/api/oauth/tokens` list issued token metadata by stored `jti`, with filters for active, expired, revoked, subject, client, and grant type
- token detail shows reconstructed JWT claims and `endpoint_permissions` endpoint metadata from stored records, but does not redisplay raw access token values after issuance
- revoking an issued token sets `revokedAt` on the historical token record and subsequent Bearer runtime validation treats the token as invalid, returning `401`
- Bearer-protected MCP and REST runtime `401` responses include a `WWW-Authenticate: Bearer` challenge with `resource_metadata` pointing to the protected-resource discovery document; invalid token cases also include `error="invalid_token"`
- Discovery metadata
- `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, and `/oauth/jwks` expose the mock server's implemented OAuth capabilities only
- Discovery advertises authorization code and client credentials grants, `code` response type, `client_secret_post` token authentication, endpoint scope format, token endpoint, authorization endpoint, and JWKS URI
- Discovery must not advertise refresh tokens, PKCE, external identity providers, revocation, or OAuth-protected MCP route URLs until those behaviors are implemented
- Future PKCE support must implement authorization request validation, code challenge storage, token-time verifier checks, `S256` tests, and discovery updates in the same change; discovery must continue to report an empty `code_challenge_methods_supported` array until then
- Future resource strict mode must be opt-in at first and must prove authorization-code, client-credentials, JWT audience, Bearer validation, and user-facing docs against explicit resource/audience mismatches
- `/oauth/jwks` exposes only the public RS256 verification key matching issued token `kid` and never private signing material

## Validation
- Built-in OAuth login user cannot be disabled, deleted, password-changed, or TTL-changed through normal public UI/API flows
- Non-built-in OAuth login user CRUD validates username shape, password length, unique usernames, and token TTL presets
- Built-in OAuth client cannot be disabled, deleted, edited, or secret-regenerated through normal public UI/API flows
- Non-built-in OAuth client CRUD validates client ID shape, redirect URI shape, TTL presets, unique client IDs, and existing allowed endpoint IDs
- Authorization code lifetime/single-use
- Client redirect validation
- Consent endpoint selection must be a subset of the registered OAuth client's allowed endpoint IDs
- Client-credentials requested scopes must never expand beyond the registered OAuth client's allowed endpoint IDs
- JWT claims/signature/expiry
- Permission filtering
- Revocation lookup
- 401 versus 403 mapping
- Issued-token management must distinguish active, expired, and revoked rows while retaining historical metadata for debugging
- Authorization-code browser flow selects endpoint permissions, exchanges code for token, calls /mcp/oauth successfully for allowed endpoint, receives 403 for denied endpoint, revokes token and receives 401
- User-facing docs explain that an unavailable local callback page can still be a successful mock authorization result when the redirect URL contains a code
