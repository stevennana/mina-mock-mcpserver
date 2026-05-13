# AGENTS.md

## Purpose
MCP Mock Server is a public remote MCP mock server and web UI for testing no-auth, Basic Auth, and mock OAuth bearer tool calls.

This repository is optimized for agent-legible development and a Ralph-style task-promotion loop.

## Read Order
Before changing code or plans, read these files in order:

1. `ARCHITECTURE.md`
2. `docs/PRODUCT_SENSE.md`
3. `docs/design-docs/core-beliefs.md`
4. `docs/product-specs/index.md`
5. `docs/FRONTEND.md`
6. `docs/PLANS.md`
7. active plans in `docs/exec-plans/active/`

## Scope Guardrails
### In scope for v1
- Next.js App Router web gateway and route handlers
- TypeScript domain/services with Prisma SQLite persistence
- endpoint/tool management with up to three parameters and exact-match response cases
- no-auth, Basic, and OAuth bearer MCP/REST runtime paths
- OAuth user/client/token administration, authorization code flow, client credentials flow, discovery metadata, and JWKS
- failure simulation, audit log, server config, reset, logging, Docker/Nginx guidance, and Ralph harness

### Explicitly out of scope for v1
- production-grade identity management
- external OAuth provider integration
- true multi-tenant isolation
- enterprise RBAC for the public admin UI
- handling sensitive customer data
- MCP client-side sampling, roots, elicitation, or task-augmented execution in MVP
- replacing a real authorization server

## Product Shape
- public admin UI for mock endpoint, auth, token, config, reset, and audit management
- MCP Streamable HTTP-style JSON-RPC endpoints at /mcp and strict auth aliases
- REST tool list/call API for curl and Postman style testing
- mock OAuth authorization server with login, consent, token, revocation, and discovery metadata
- SQLite-backed persistence with deterministic seed defaults

## Technical Shape
- Next.js App Router and TypeScript with npm scripts
- Prisma plus SQLite for migrations, seed defaults, and persistent runtime state
- layered domain shape: types, config, repo, service, runtime, UI
- Playwright for E2E and UI verification, node --import tsx --test for unit tests
- logs/ plus LOG_LEVEL and start:logged for operator-visible server flow

## Validation Strategy
Use layered checks:
- unit tests for domain rules
- integration tests for repository/runtime boundaries where needed
- small E2E coverage for the required user journeys only

Promotion is blocked when required checks fail. Required test commands in active task contracts are hard gates, not suggestions.
While iterating, prefer the smallest targeted check for the code you just changed. Use the full required command set before considering the task done.
If a feature depends on an outside resource such as AI chat or another remote service, keep it in the required E2E flows before allowing promotion.
If a task is mainly UI or UX work, require a dedicated `@ui-*` Playwright command with screenshot, responsive, and accessibility checks before allowing promotion.
If `taskmeta.promotion_mode` is `deterministic_only`, passing the required commands is sufficient for promotion without human review.
For manual server inspection, prefer `npm run start:logged` and set `LOG_LEVEL` intentionally instead of relying only on ephemeral terminal output.

### Required E2E flows
- endpoint create/edit/delete and console call flow
- MCP initialize, tools/list, and tools/call in no-auth mode
- Basic user creation and strict /mcp/basic success/failure
- REST tools list/call across auth modes
- OAuth browser consent, token exchange, allowed tool call, denied tool call, and revocation
- failure simulation and audit evidence
- config/health/reset/startup smoke

## Documentation Discipline
- If behavior changes, update the related spec or design doc in the same cycle.
- Prefer small, executable plans over vague TODOs.
- When a repeated mistake appears, first document it; if it keeps recurring, promote it into tests or lint rules.
- Keep the documented test strategy current; do not leave promotion gates implied.
- When adding or editing tests, explain what behavior the test protects if that intent would otherwise be easy to lose.

## Search Discipline
- Search the codebase before concluding that a thing is unimplemented.
- Prefer multiple targeted searches over one broad assumption.
- If you find a partial implementation, adapt or complete it instead of duplicating it blindly.

## Optional Companion Skills
- If the customer allows them and they are installed, consider relevant companion skills before planning or implementation.
- Good candidates include database, Next.js pattern, UI design, responsive UI, and clean-architecture skills.

## Done Definition
A task is done only when its scoped behavior works in substance, docs and tests match the implementation, required deterministic commands pass, and promotion rules in taskmeta are satisfied.
