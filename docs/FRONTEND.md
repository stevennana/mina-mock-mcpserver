# FRONTEND.md

## Goal
Describe the user-facing structure of MCP Mock Server so an agent can implement the UI without guessing the product model.

## Tech Direction
- Next.js application
- TypeScript
- App Router
- server-backed data flows where appropriate

## Route Map
| Route | Surface | Notes |
|---|---|---|
| / | Dashboard | Counts, URL examples, public UI warning |
| /endpoints | Endpoint catalog | List/search/status only |
| /endpoints/new, /endpoints/[id]/* | Endpoint workflows | Create, overview, edit, parameters/schema, responses, failure, console, delete |
| /resources | Resource catalog | List/search/status only |
| /resources/new, /resources/[id]/* | Resource workflows | Create, overview, edit metadata, content, completion/test console, delete |
| /resource-templates | Resource template catalog | List/search/status only |
| /resource-templates/new, /resource-templates/[id]/* | Resource template workflows | Create, overview, edit URI template, arguments, completion candidates, rendered content, console, delete |
| /prompts | Prompt catalog | List/search/status only |
| /prompts/new, /prompts/[id]/* | Prompt workflows | Create, overview, edit metadata, arguments, messages, completion candidates, console, delete |
| /basic-users | Basic Auth user catalog | List/search/status only |
| /basic-users/new, /basic-users/[id] | Basic Auth user workflows | Create, detail, edit/delete actions |
| /oauth-users | OAuth user catalog | List/search/status only |
| /oauth-users/new, /oauth-users/[id] | OAuth login-user workflows | Create, detail, TTL, edit/delete actions |
| /oauth-clients | OAuth client catalog | List/search/status only |
| /oauth-clients/new, /oauth-clients/[id] | OAuth client workflows | Create, detail, redirects, allowed tools/resources/resource templates/prompts, secret actions |
| /tokens | Issued token catalog | List/filter/status with initial refresh and manual refresh |
| /tokens/[jti] | Issued token detail | Claims, permissions, revoke |
| /config | Server config | Effective base URL, health, core connection URLs |
| /inspector | Inspector/verification hub | Standalone inspector UI command, Mock Server scenario runner, local inspector command, MCP Inspector targets, OAuth authorization-code/Bearer setup guide, base URL diagnostics |
| /reset | Reset | Root-password protected reset |
| /audit | Audit log | Filtered, incrementally loaded mutation evidence |
| /audit/[id] | Audit event detail | Full evidence payload |
| /oauth/login | OAuth login | Separate from admin UI |
| /oauth/consent | OAuth consent | Grouped Tools, Resources, and Prompts permission checklists |
| /api/* | Admin/API | Health, CRUD, config, reset, audit |
| /mcp, /mcp/none, /mcp/basic, /mcp/oauth | MCP JSON-RPC | Unified plus strict auth routes with Streamable HTTP POST and lightweight GET SSE |
| /sse, /sse/none, /sse/basic, /sse/oauth | Legacy MCP SSE | Inspector-compatible SSE stream and message POST aliases |
| /rest/tools, /rest/tools/:name/call | REST mock API | Same tool catalog through REST |
| /.well-known/*, /oauth/jwks, /oauth/token, /oauth/revoke, /api/oauth/tokens/[jti]/revoke | OAuth metadata/runtime | Discovery, token, standard revocation, issued-token revocation |

## Primary Screens
| Screen | Primary jobs |
|---|---|
| Dashboard | Summarize service state and show connection examples |
| Endpoints | List, search, create, and edit mock tools, response cases, failure simulation, timeout shortcut, and delete protection |
| Resources | List, search, create, edit, preview, read, and delete direct MCP context resources |
| Resource Templates | Configure parameterized MCP resource URI templates, rendered mock content, and completion candidates |
| Prompts | Configure reusable MCP prompt templates, arguments, ordered messages, embedded resources, and completion candidates |
| Endpoint console | Preview MCP/REST call shape with selected auth mode, run REST no-auth and Basic calls, and show raw execution evidence |
| Basic Auth users | List/search/create/password-edit/disable/delete Basic test identities and show the built-in default/default lock state |
| OAuth users | List/search/create/password-edit/disable/delete OAuth login identities and token TTL presets with built-in default locked |
| OAuth clients | Manage generated client secrets, redirect URIs, client credentials TTL presets, and allowed tool/resource/resource-template/prompt sets |
| OAuth login/consent | Complete authorization-code flow and select tool/resource/resource-template/prompt permissions |
| Issued tokens | Inspect claims, permissions, expiration, and revoke tokens |
| Config/guide | Show effective base URL, health summary, MCP/REST/OAuth URLs, OAuth discovery metadata, JWKS, sample client config, curl, public UI warning, and log command |
| Inspector guide | Explain how to launch upstream MCP Inspector against local MCP routes and when to use project UI/curl instead |
| Reset | Root-protected reset to current seed defaults with exact confirmation text |
| Audit | Filter and incrementally review mutation and security-relevant event history without exposing submitted secrets |

## UI Rules
- favor quiet, dense, operational layouts over marketing composition
- follow the product primitive system in `docs/design-docs/product-ui-primitives.md` before creating page-specific UI; start with shared shell, header, panel, metric, action, form, table, status, code, empty, loading, and error primitives
- admin pages must follow a single-purpose rule: catalog pages list and search only; create, edit, test, delete, inspect, and diagnostic work moves to focused pages or focused sub-nav destinations
- list rows should navigate to detail pages with links instead of opening dense inline editors in the catalog
- resource, resource-template, and prompt pages should mirror the endpoint single-purpose page pattern rather than adding inline editors to catalogs
- detail pages should expose local sub-nav for closely related workflows and should keep destructive actions behind a dedicated delete/revoke/reset destination or confirmation panel
- use icons for copy, edit, delete, revoke, reset, refresh, and external-link actions where available
- every destructive action has a confirmation path and explains whether delete code or root password is accepted
- endpoint deletion keeps confirmation inputs separate from the endpoint editor values and clears submitted secrets after attempts
- show protocol/auth warnings inline on malformed-response and public-admin controls
- tables must support search/filter states without layout shift
- token catalogs refresh once when the page opens and keep a manual Refresh control with visible loading feedback; do not poll continuously
- audit tables must not force-load the full event history; use filters plus cursor/incremental loading for large records
- endpoint editor forms must surface API/domain validation errors next to the affected fields
- endpoint editor forms must show generated MCP `inputSchema` from the shared endpoint domain schema helper
- Mock Server admin forms should use concise hover tooltips for beginner-facing concepts such as MCP tool names, inputSchema parameters, response case matching, failure simulation, auth modes, OAuth client permissions, token filters, and destructive reset inputs
- endpoint console REST execution is available for no-auth and Basic modes and shows raw request, raw response, principal, matched case, and elapsed time
- endpoint failure simulation controls must make endpoint-level delay/error/malformed settings and case-level tool/protocol errors explicit
- malformed-response modes must show inline warnings before save and console execution because they intentionally break normal client parsing expectations
- Basic user forms must not display password hashes and must disable mutation controls for built-in rows
- OAuth user forms must not display password hashes, must use bounded token TTL presets, and must disable mutation controls for the built-in row
- OAuth client forms must not display stored secret hashes, must show generated raw client secrets only at creation or regeneration, and must disable mutation controls for the built-in row
- console outputs must preserve raw JSON formatting and elapsed/auth/match metadata
- console shell states must clearly mark unavailable runtime actions instead of faking calls
- UI-focused tasks must include desktop and mobile screenshots plus accessibility checks

## Search / Share / Admin Notes
- the admin UI is intentionally public, so copy must avoid implying enterprise security
- root-password fields are used only for protected actions and must not be logged
- reset confirmation must make clear that currently implemented endpoint data is deleted and seed defaults are recreated
- copy buttons should exist for MCP URLs, REST URLs, client config, curl examples, client secrets at issuance, and JWTs at issuance
- Config and Inspector command rows should expose touch-friendly copy buttons for operational commands and connection URLs, including local TLS and self-signed inspector commands
- Inspector guidance should live in the Mock UI `/inspector` hub and distinguish the standalone generic MCP endpoint inspector from the Mock Server scenario runner that covers REST, OAuth setup, token, audit, reset guard, and config workflows
- `/inspector` should surface authorization-code verification from the currently effective base URL and configured OAuth client so users can copy the browser authorization URL, token exchange curl, and Bearer MCP call without reconstructing OAuth parameters by hand
- Config should show read-only base URL diagnostics, local-test TLS commands, and current app HTTPS env status while keeping Nginx TLS termination positioned as the public deployment recommendation
- The standalone inspector UI should keep one primary action per mode: generic MCP inspection for arbitrary endpoints, and Mock Server scenario execution for local product E2E evidence
- The standalone inspector UI should route users through focused pages: `/` as the workflow choice screen, `/mock` for Mock Server scenario execution, `/generic` for one generic MCP target inspection, and `/oauth` for Mock OAuth authorization-code popup verification
- `/mock` and `/generic` should provide a direct workflow switch link so users do not have to return to `/` to move between the two focused modes
- `/oauth` should guide users through a single visible OAuth authorization-code workflow: prepare client, open popup, login/consent, exchange code, send Bearer token to Generic MCP target, and verify `/mcp/oauth`
- The standalone OAuth popup helper should use PKCE S256 and must not persist access tokens, client secrets, authorization codes, code verifiers, or popup state in browser storage
- Mock Server scenario results should show in-flight step progress, keep the completed progress checklist visible after completion, then show summary counters, diagnostics, and sequential step cards instead of dumping every request/response body into one continuous page
- Every scenario step card should expose a visible Send to Generic MCP target action in the card header; the action opens `/generic` and pre-fills a repeatable seeded target so users can manually rerun the protocol call
- Scenario step cards and generic target inputs should include concise hover tooltips that explain the purpose of each MCP/OAuth/REST call or request option for users who are new to MCP
- Generic target select controls should show the current preset/auth-mode meaning inline, not only in hidden hover text, so users can understand how the request will change before running it
- The standalone inspector UI should provide a no-auth/Basic/Bearer authorization helper for generic MCP targets so users do not have to hand-build common Authorization headers
- The standalone inspector UI should model targets as Base URL plus Endpoint path, show the combined Full URL preview, and lock Endpoint path when a Mock route preset for `/mcp/none`, `/mcp/basic`, or `/mcp/oauth` is selected
- Resource and prompt checks should remain MCP method presets on the selected endpoint path; they should not appear as route presets because they run through the same MCP JSON-RPC transport route
- The standalone inspector UI should provide a Mock OAuth `client_credentials` token helper for the `/mcp/oauth` preset while still using the standard Mock Server `/oauth/token` endpoint
- The Generic MCP target page should include upstream Inspector-inspired helpers for copying the current server target JSON, importing a target JSON preset, and reviewing collapsed Previous runs history separated from the current result
- The standalone inspector UI may remember non-secret local target settings in browser storage, but must not persist headers, Basic passwords, Bearer tokens, OAuth client secrets, root passwords, reset choices, or tool argument payloads
- OAuth consent should make selected tool/resource/resource-template/prompt permissions unambiguous
- OAuth consent must show client, redirect URI, resource, login user, authorization-code TTL, and grouped Tools, Resources, Resource Templates, and Prompts checklists outside the public admin navigation

## Frontend Non-Goals for v1
- no marketing landing page before the usable dashboard
- no enterprise account settings or RBAC screens
- no hidden destructive operations without confirmation
- no decorative UI that obscures raw request/response evidence
