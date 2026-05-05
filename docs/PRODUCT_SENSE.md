# PRODUCT_SENSE.md

## One-Line Product Definition
MCP Mock Server is a public remote MCP mock server and web UI for testing no-auth, Basic Auth, and mock OAuth bearer tool calls.

## Who It Is For
### Primary user
MCP client developers, AI agent developers, demo/QA users, and the server operator.

## User Problem
MCP client and AI-agent developers need a configurable remote server that behaves enough like a real MCP server to prove connection, auth, token, permission, and tool-call behavior before integrating with production systems.

## Why This Product Exists
Remote MCP adoption is moving auth, transport, and permission bugs into client integration work. A public mock server gives teams a repeatable target for manual testing, automated E2E checks, demos, and negative-path validation.

## Product Principles
- realistic MCP and OAuth behavior over decorative admin features
- public-by-design administration with light destructive-operation protection
- destructive endpoint deletion requires a delete code or root-password override and leaves non-secret audit evidence
- deterministic mocks: exact-match cases, explicit defaults, and observable failures
- endpoint permissions are visible, selectable, and enforced
- operator recovery paths must be simple and root-password protected

## Core Value in v1
- create a mock endpoint once and exercise it through MCP and REST
- inspect the generated MCP input schema and execute REST no-auth or Basic calls from the endpoint console with raw evidence
- initialize no-auth MCP clients, list enabled tools, and execute exact-match tool calls
- manage Basic Auth test users while keeping the built-in default/default fixture locked
- list enabled tools and call configured mock tools through simple REST routes for curl and Postman style testing
- prove no-auth, Basic, and OAuth bearer client behavior against strict routes
- issue mock OAuth tokens with endpoint-level permissions through browser consent or client credentials
- simulate failure cases that clients often mishandle
- persist configuration and provide root-password-protected reset/recovery for a public test service

## Non-Goals for v1
- production-grade identity management
- external OAuth provider integration
- true multi-tenant isolation
- enterprise RBAC for the public admin UI
- handling sensitive customer data
- full MCP resources, prompts, sampling, elicitation, or task-augmented execution in MVP
- replacing a real authorization server

## v1 Success Signals
- a new endpoint can be created and edited through the public endpoint UI, then listed through tools/list and GET /rest/tools, called through tools/call, and called through POST /rest/tools/:name/call
- Basic default/default and additional users work on strict Basic routes while invalid credentials return 401
- OAuth default/default remains locked while additional login users can be configured with hashed passwords and MVP token TTL presets
- OAuth consent can select endpoints, exchange a code for a JWT, allow selected tools, deny unselected tools with 403, and return 401 after revocation
- token and audit screens show enough evidence to debug a client test, including endpoint delete success/failure without stored secrets
- SQLite state survives restart and root reset restores currently implemented built-in endpoint and Basic user defaults
- npm run verify and npm run start:smoke pass before task promotion

## Product Risks
- public UI can be abused or reset if root/delete-code handling is weak
- OAuth semantics can drift into unrealistic behavior unless routes and E2E checks pin 401/403/token claims
- MCP spec details may change, so the implementation must isolate protocol formatting
- failure simulation can intentionally violate protocol behavior and needs visible warnings
- persistent SQLite state can make tests flaky unless seeded and isolated deterministically
