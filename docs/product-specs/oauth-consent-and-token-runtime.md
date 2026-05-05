# OAuth Consent and Token Runtime

## Goal
The mock OAuth server issues JWT bearer tokens through browser consent and client credentials, with endpoint-level permissions and revocation.

## Trigger / Entry
OAuth users and clients management

## User-Visible Behavior
- OAuth users and clients management
- Login and consent flow
- Token issuance
- Token list/detail/revoke
- Discovery metadata

## Validation
- Authorization code lifetime/single-use
- Client redirect validation
- JWT claims/signature/expiry
- Permission filtering
- Revocation lookup
- 401 versus 403 mapping
- Authorization-code browser flow selects endpoint permissions, exchanges code for token, calls /mcp/oauth successfully for allowed endpoint, receives 403 for denied endpoint, revokes token and receives 401
