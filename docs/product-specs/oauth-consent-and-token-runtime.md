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
- Login and consent flow
- Token issuance
- Token list/detail/revoke
- Discovery metadata

## Validation
- Built-in OAuth login user cannot be disabled, deleted, password-changed, or TTL-changed through normal public UI/API flows
- Non-built-in OAuth login user CRUD validates username shape, password length, unique usernames, and token TTL presets
- Authorization code lifetime/single-use
- Client redirect validation
- JWT claims/signature/expiry
- Permission filtering
- Revocation lookup
- 401 versus 403 mapping
- Authorization-code browser flow selects endpoint permissions, exchanges code for token, calls /mcp/oauth successfully for allowed endpoint, receives 403 for denied endpoint, revokes token and receives 401
