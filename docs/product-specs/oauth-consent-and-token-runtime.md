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
- Token issuance
- Token list/detail/revoke
- Discovery metadata

## Validation
- Built-in OAuth login user cannot be disabled, deleted, password-changed, or TTL-changed through normal public UI/API flows
- Non-built-in OAuth login user CRUD validates username shape, password length, unique usernames, and token TTL presets
- Built-in OAuth client cannot be disabled, deleted, edited, or secret-regenerated through normal public UI/API flows
- Non-built-in OAuth client CRUD validates client ID shape, redirect URI shape, TTL presets, unique client IDs, and existing allowed endpoint IDs
- Authorization code lifetime/single-use
- Client redirect validation
- Consent endpoint selection must be a subset of the registered OAuth client's allowed endpoint IDs
- JWT claims/signature/expiry
- Permission filtering
- Revocation lookup
- 401 versus 403 mapping
- Authorization-code browser flow selects endpoint permissions, exchanges code for token, calls /mcp/oauth successfully for allowed endpoint, receives 403 for denied endpoint, revokes token and receives 401
