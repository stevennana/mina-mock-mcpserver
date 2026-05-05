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
| /config | Server config | Base URL, MCP/REST/OAuth examples, Nginx guide |
| /reset | Reset | Root-password protected reset |
| /audit | Audit log | Public mutation and token evidence |
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
| Endpoints | Manage mock tools, response cases, failure simulation, delete protection |
| Endpoint console | Run MCP and REST calls with selected auth mode and inspect raw evidence |
| Basic Auth users | Manage Basic test identities and built-in lock state |
| OAuth users | Manage login identities and token TTLs |
| OAuth clients | Manage client secrets, redirect URIs, and allowed endpoint set |
| OAuth login/consent | Complete authorization-code flow and select endpoint permissions |
| Issued tokens | Inspect claims, permissions, expiration, and revoke tokens |
| Config/guide | Show base URL, MCP/REST/OAuth URLs, sample client config, curl, Nginx |
| Reset | Root-protected full reset to seed defaults |
| Audit | Review mutation and security-relevant event history |

## UI Rules
- favor quiet, dense, operational layouts over marketing composition
- use icons for copy, edit, delete, revoke, reset, refresh, and external-link actions where available
- every destructive action has a confirmation path and explains whether delete code or root password is accepted
- show protocol/auth warnings inline on malformed-response and public-admin controls
- tables must support search/filter states without layout shift
- console outputs must preserve raw JSON formatting and elapsed/auth/match metadata
- UI-focused tasks must include desktop and mobile screenshots plus accessibility checks

## Search / Share / Admin Notes
- the admin UI is intentionally public, so copy must avoid implying enterprise security
- root-password fields are used only for protected actions and must not be logged
- copy buttons should exist for MCP URLs, REST URLs, client config, curl examples, client secrets at issuance, and JWTs at issuance
- OAuth consent should make selected endpoint permissions unambiguous

## Frontend Non-Goals for v1
- no marketing landing page before the usable dashboard
- no enterprise account settings or RBAC screens
- no hidden destructive operations without confirmation
- no decorative UI that obscures raw request/response evidence
