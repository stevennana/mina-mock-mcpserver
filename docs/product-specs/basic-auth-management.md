# Basic Auth Management

## Goal
Public users manage Basic Auth test users while the built-in default/default user remains protected and valid.

## Trigger / Entry
Basic users list

## User-Visible Behavior
- Basic users list
- Basic users catalog page is list/search/status focused only
- Create/edit/disable/delete Basic users use focused create/detail pages
- Basic user form inputs expose concise hover tooltips explaining usernames, hashed passwords, enabled state, and how strict Basic runtime validation uses them
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
- Catalog-to-detail navigation keeps the list separate from password and destructive actions
