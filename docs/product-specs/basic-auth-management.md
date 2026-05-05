# Basic Auth Management

## Goal
Public users manage Basic Auth test users while the built-in default/default user remains protected and valid.

## Trigger / Entry
Basic users list

## User-Visible Behavior
- Basic users list
- Create/edit/disable/delete Basic users
- Locked built-in user state
- Basic credentials in test console
- Strict `/mcp/basic` requires valid Basic credentials.
- Unified `/mcp` treats Basic `Authorization` headers as credentialed calls and fails closed when those headers are invalid.

## Validation
- Password hashing
- Built-in immutability
- 401 behavior for invalid headers
- Auth precedence
- Create a Basic user and call strict /mcp/basic and REST routes
