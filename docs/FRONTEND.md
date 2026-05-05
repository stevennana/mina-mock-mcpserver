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
| /endpoints | Endpoint tools | List/search/create/edit/delete/test |
| /basic-users | Basic Auth users | Built-in default locked |
| /oauth-users | OAuth users | Built-in default locked |
| /oauth-clients | OAuth clients | Redirect URIs and allowed endpoints |
| /tokens | Issued tokens | Claims, permissions, revoke, filters |
| /config | Server config | Base URL, MCP/REST/OAuth examples, discovery metadata, JWKS, Nginx guide |
| /reset | Reset | Root-password protected reset |
| /audit | Audit log | Public mutation, protected delete, and token evidence |
| /oauth/login | OAuth login | Separate from admin UI |
| /oauth/consent | OAuth consent | Endpoint permission checklist |
| /api/* | Admin/API | Health, CRUD, config, reset, audit |
| /mcp, /mcp/none, /mcp/basic, /mcp/oauth | MCP JSON-RPC | Unified plus strict auth routes |
| /rest/tools, /rest/tools/:name/call | REST mock API | Same tool catalog through REST |
| /.well-known/*, /oauth/jwks, /oauth/token, /oauth/revoke | OAuth metadata/runtime | Discovery, token, revocation |

## Primary Screens
| Screen | Primary jobs |
|---|---|
| Dashboard | Summarize service state and show connection examples |
| Endpoints | List, search, create, and edit mock tools, response cases, failure simulation, and delete protection |
| Endpoint console | Preview MCP/REST call shape with selected auth mode, run REST no-auth and Basic calls, and show raw execution evidence |
| Basic Auth users | List/search/create/password-edit/disable/delete Basic test identities and show the built-in default/default lock state |
| OAuth users | List/search/create/password-edit/disable/delete OAuth login identities and token TTL presets with built-in default locked |
| OAuth clients | Manage generated client secrets, redirect URIs, client credentials TTL presets, and allowed endpoint set |
| OAuth login/consent | Complete authorization-code flow and select endpoint permissions |
| Issued tokens | Inspect claims, permissions, expiration, and revoke tokens |
| Config/guide | Show base URL, MCP/REST/OAuth URLs, OAuth discovery metadata, JWKS, sample client config, curl, Nginx |
| Reset | Root-protected reset to current seed defaults with exact confirmation text |
| Audit | Review mutation and security-relevant event history without exposing submitted secrets |

## UI Rules
- favor quiet, dense, operational layouts over marketing composition
- use icons for copy, edit, delete, revoke, reset, refresh, and external-link actions where available
- every destructive action has a confirmation path and explains whether delete code or root password is accepted
- endpoint deletion keeps confirmation inputs separate from the endpoint editor values and clears submitted secrets after attempts
- show protocol/auth warnings inline on malformed-response and public-admin controls
- tables must support search/filter states without layout shift
- endpoint editor forms must surface API/domain validation errors next to the affected fields
- endpoint editor forms must show generated MCP `inputSchema` from the shared endpoint domain schema helper
- endpoint console REST execution is available for no-auth and Basic modes and shows raw request, raw response, principal, matched case, and elapsed time
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
- OAuth consent should make selected endpoint permissions unambiguous
- OAuth consent must show client, redirect URI, resource, login user, authorization-code TTL, and the endpoint checklist outside the public admin navigation

## Frontend Non-Goals for v1
- no marketing landing page before the usable dashboard
- no enterprise account settings or RBAC screens
- no hidden destructive operations without confirmation
- no decorative UI that obscures raw request/response evidence
