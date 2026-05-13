# ARCHITECTURE.md

## Goal
Build MCP Mock Server as an agent-legible codebase with strong boundaries, a short instruction surface, and enough extension seams to support future change without overbuilding v1.

## System Overview
MCP Mock Server is a web application with:
- a public Next.js UI served on port 3000
- server-side route handlers for admin APIs, MCP, REST, OAuth, and discovery metadata
- SQLite persistence prepared by npm run db:prepare
- operator logs under logs/ with LOG_LEVEL selection
- optional app-level HTTPS for local test runs through TLS_CERT_FILE/TLS_KEY_FILE, while public deployments should still terminate TLS at a reverse proxy
- Ralph scripts under scripts/ralph/ driving active task promotion

## Architectural Priorities
- isolate MCP protocol formatting from endpoint matching and auth decisions
- keep auth mode resolution explicit and fail closed for invalid Basic/Bearer headers
- store immutable endpoint IDs and treat names as external labels
- make seeded built-in users/clients impossible to delete or disable through normal flows
- prove persistence and production-style startup with deterministic commands

## Layered Domain Model
Use a strict forward-only dependency shape inside each domain:

`Types -> Config -> Repo -> Service -> Runtime -> UI`

### Why this matters
The repository is intended to work well with long-running agent loops. Strict boundaries reduce accidental coupling and make failure analysis easier.

## Primary Domains
| Domain | Responsibility |
|---|---|
| Endpoint catalog | Endpoint CRUD, parameters, response cases, delete code, enabled state |
| Resource catalog | Direct resource CRUD, resource templates, URI validation, content storage, annotations, and completion candidates |
| Prompt catalog | Prompt CRUD, argument definitions, prompt messages, embedded resource references, and completion candidates |
| Matcher/runtime | Argument normalization, exact match, default/no-match, delay/error/malformed behavior |
| MCP protocol | JSON-RPC request handling, initialize, tools/list, tools/call, resources/list/read/templates/subscribe, prompts/list/get, completion/complete, MCP errors |
| REST API | Tool list/call responses and REST error mapping |
| Basic auth | Basic users, password hashing, built-in default protection, 401 behavior |
| OAuth | Users, clients, codes, JWTs, tool/resource/prompt permissions, revocation, discovery metadata |
| Admin UI | Dashboards, editors, console, config, reset, audit screens |
| Operations | SQLite prep, seed defaults, base URL, Docker/Nginx docs, logs, health |

## Frontend / Backend Shape
### Frontend
- App Router screens should be dense, operational, and optimized for repeated testing
- UI routes read and mutate through server-backed APIs, not local-only state
- route-level loading and error states are required for public mutation surfaces
- test console shows raw request, raw response, principal, matched case, and elapsed time
- OAuth login and consent UI is separate from the admin navigation

### Server
- Next.js route handlers own HTTP surfaces for MVP
- domain services own validation, matching, auth, token, and reset logic
- repositories isolate Prisma access
- protocol adapters convert domain outcomes into MCP JSON-RPC, SSE notification, or REST responses
- startup code prepares runtime state before production-style serving

## Persistence Strategy
- SQLite is the source of truth for endpoints, parameters, cases, MCP resources, resource templates, prompts, users, clients, codes, tokens, audit events, and settings
- Prisma migrations define the schema and db:prepare applies migrations plus idempotent seed defaults
- built-in default/default Basic user, OAuth user, and OAuth client are recreated and protected
- issued token records store jti and metadata; raw tokens are shown only at issuance unless explicitly configured
- tests use isolated temporary databases or resettable seed state

## Verification Shape
- unit tests cover validators, matching, auth precedence, JWT claims, permissions, reset, and protocol formatting
- Playwright proves browser-visible workflows and external-client-like OAuth/MCP/REST flows
- start:smoke builds, prepares runtime state, starts the production server, probes health, and shuts down
- verify runs lint, typecheck, build, unit, E2E, and startup smoke
- failing required checks block Ralph promotion

## Long-Running Agent Readiness
- docs are the system of record
- plans are executable, not aspirational
- domain boundaries are explicit
- repeated issues should be upgraded into tests or static checks
