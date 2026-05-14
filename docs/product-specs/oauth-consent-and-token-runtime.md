# OAuth Consent and Token Runtime

## Goal
The mock OAuth server issues JWT bearer tokens through browser consent and client credentials, with tool, resource, and prompt permissions plus revocation.

## Trigger / Entry
OAuth users and clients management

## User-Visible Behavior
- OAuth users and clients management
- OAuth user and client catalog pages are list/search/status focused only; create, detail, edit, secret, allowed-endpoint, and delete actions use focused pages
- OAuth user, client, token filter, and permission inputs expose concise hover tooltips explaining login credentials, token TTLs, client credentials, redirect URIs, allowed tools/resources/resource templates/prompts, grants, subjects, and client filters
- OAuth user management lists the locked built-in `default/default` login fixture and allows non-built-in users to be created, password-edited, TTL-edited, enabled/disabled, and deleted
- OAuth login-user token TTLs use MVP presets only: 15 minutes, 1 hour, 8 hours, and 24 hours; never-expiring tokens are not available in this slice
- OAuth user passwords are stored as hashes and never returned through the public management API
- OAuth client management lists the locked built-in `default/default` client fixture and allows non-built-in clients to be created, edited, regenerated, disabled/enabled, and deleted
- OAuth client secrets are generated server-side, stored as hashes, and returned only on create or regenerate responses
- OAuth clients store redirect URIs, client credentials TTL presets, and maximum allowed tool/resource/resource-template/prompt sets that later consent and client credentials flows must not exceed
- Login and consent flow
- `/oauth/authorize` accepts authorization-code requests only after exact client and registered redirect URI validation
- authorization-code requests may include PKCE `code_challenge_method=S256` and `code_challenge`; unsupported PKCE methods fail deterministically before login or consent
- mock login verifies enabled OAuth users and carries the request to consent with a short-lived signed login ticket
- consent displays client, redirect URI, resource, user, authorization-code TTL, and grouped Tools, Resources, Resource Templates, and Prompts permission checklists constrained to the client's allowed sets
- approving consent creates a single-use-ready authorization code bound to client, redirect URI, user, selected tools/resources/resource templates/prompts, resource/audience, optional PKCE challenge, state, expiry, and unused status, then redirects with `code` and `state`
- local callback redirects may land on an unavailable test callback host; this is acceptable for manual mock testing as long as the redirect URL contains the authorization `code` and `state`
- Token issuance
- `/oauth/token` supports the `authorization_code` grant with form-encoded `grant_type`, `code`, `redirect_uri`, `client_id`, `client_secret`, and `code_verifier` when the authorization code was created with PKCE
- valid code exchange marks the code used, returns `access_token`, `token_type`, `expires_in`, and `scope`, and stores issued token metadata by JWT `jti`
- `/oauth/token` supports the `client_credentials` grant with form-encoded `grant_type`, `client_id`, `client_secret`, optional `scope`, and optional `resource`; no login or consent UI is involved
- client-credentials tokens use the client credentials TTL, subject `client:<client_id>`, `grant_type=client_credentials`, and permissions equal to all client-allowed tools/resources/resource templates/prompts when no scope is requested or the intersection of requested `endpoint:<endpoint_id>`, `resource:<resource_id>`, `resource_template:<resource_template_id>`, and `prompt:<prompt_id>` scopes and client-allowed sets when scope is present
- access tokens are RS256 JWTs with issuer, audience/resource, subject, client ID, grant type, issued/expiry times, `jti`, scope, `endpoint_permissions`, `resource_permissions`, `resource_template_permissions`, and `prompt_permissions`
- expired, reused, unknown, redirect-mismatched, client-mismatched, or client-secret-invalid authorization-code exchanges fail with deterministic OAuth-style errors
- Token list/detail/revoke
- `/tokens` and `/api/oauth/tokens` list issued token metadata by stored `jti`, with filters for active, expired, revoked, subject, client, and grant type
- `/tokens` refreshes the visible catalog once when the page opens and keeps a manual Refresh control with visible loading feedback. It does not continuously poll.
- token detail shows reconstructed JWT claims and tool/resource/resource-template/prompt permission metadata from stored records, but does not redisplay raw access token values after issuance
- revoking an issued token sets `revokedAt` on the historical token record and subsequent Bearer runtime validation treats the token as invalid, returning `401`
- `/oauth/revoke` implements standard token revocation for clients that authenticate with `client_secret_post` or HTTP Basic client credentials. The mock server accepts an access token or stored `jti` as the `token` form value and returns `200` for valid client-owned revocation attempts.
- Bearer-protected MCP and REST runtime `401` responses include a `WWW-Authenticate: Bearer` challenge with `resource_metadata` pointing to the protected-resource discovery document; invalid token cases also include `error="invalid_token"`
- Discovery metadata
- `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, and `/oauth/jwks` expose the mock server's implemented OAuth capabilities only
- Discovery advertises authorization code and client credentials grants, `code` response type, `client_secret_post` token authentication, endpoint scope format, token endpoint, authorization endpoint, revocation endpoint, `S256` PKCE support, and JWKS URI
- Discovery must not advertise refresh tokens, external identity providers, or OAuth-protected MCP route URLs until those behaviors are implemented
- Future resource strict mode must be opt-in at first and must prove authorization-code, client-credentials, JWT audience, Bearer validation, and user-facing docs against explicit resource/audience mismatches
- `/oauth/jwks` exposes only the public RS256 verification key matching issued token `kid` and never private signing material

## Validation
- Built-in OAuth login user cannot be disabled, deleted, password-changed, or TTL-changed through normal public UI/API flows
- Non-built-in OAuth login user CRUD validates username shape, password length, unique usernames, and token TTL presets
- Built-in OAuth client cannot be disabled, deleted, edited, or secret-regenerated through normal public UI/API flows
- Non-built-in OAuth client CRUD validates client ID shape, redirect URI shape, TTL presets, unique client IDs, and existing allowed tool/resource/resource-template/prompt IDs
- Authorization code lifetime/single-use
- PKCE S256 challenge storage and token-time verifier checks
- Client redirect validation
- Consent permission selection must be a subset of the registered OAuth client's allowed tool/resource/resource-template/prompt IDs
- Client-credentials requested scopes must never expand beyond the registered OAuth client's allowed tool/resource/resource-template/prompt IDs
- JWT claims/signature/expiry
- Permission filtering
- Revocation lookup
- 401 versus 403 mapping
- Issued-token management must distinguish active, expired, and revoked rows while retaining historical metadata for debugging
- Issued-token catalog remains list/filter focused; token claims, tool/resource/resource-template/prompt permissions, and revoke actions are shown on token detail pages
- Authorization-code browser flow selects tool/resource/resource-template/prompt permissions, exchanges code for token with and without PKCE where applicable, calls /mcp/oauth successfully for allowed items, receives 403 for denied tool/resource/resource-template/prompt access, revokes token and receives 401
- User-facing docs explain that an unavailable local callback page can still be a successful mock authorization result when the redirect URL contains a code
