# Ralph Loop Task Queue

This directory contains only runnable feature and hardening tasks. The completed bootstrap/foundation task is preserved under `docs/exec-plans/completed/` and must not be re-added here.

Task filenames are ordered for human scanning, while Ralph state and promotion use the stable `taskmeta.id` values. Keep both the filename sequence and `taskmeta.order` aligned whenever this queue changes.

## Current recommended sequence
1. `001-endpoint-domain-and-schema.md` -> `endpoint-domain-and-schema` -> Replace the bootstrap runtime placeholder with durable SQLite/Prisma persistence for endpoint/tool data and deterministic seed defaults.
2. `002-endpoint-validation-and-matching.md` -> `endpoint-validation-and-matching` -> Create reusable endpoint domain services for validation, MCP inputSchema generation, and exact-match response-case selection.
3. `003-endpoint-management-list-editor-ui.md` -> `endpoint-management-list-editor-ui` -> Build the first public endpoint-management UI for listing, searching, creating, and editing endpoint definitions.
4. `004-endpoint-console-schema-preview-ui.md` -> `endpoint-console-schema-preview-ui` -> Add generated MCP schema preview and a stable endpoint test-console shell without implementing external MCP or REST calls yet.
5. `005-endpoint-protected-delete-audit.md` -> `endpoint-protected-delete-audit` -> Implement endpoint deletion guarded by delete code or root password, with audit evidence for successful and failed delete attempts.
6. `006-root-reset-defaults.md` -> `root-reset-defaults` -> Implement root-password-protected reset behavior that restores deterministic default state without harming runtime readiness.
7. `007-mcp-initialize-and-tools-list.md` -> `mcp-initialize-and-tools-list` -> Implement no-auth MCP JSON-RPC initialization and tool discovery before adding tool execution.
8. `008-mcp-tools-call-and-errors.md` -> `mcp-tools-call-and-errors` -> Implement no-auth MCP `tools/call` execution and JSON-RPC error semantics using the endpoint matcher.
9. `009-basic-auth-users-domain-ui.md` -> `basic-auth-users-domain-ui` -> Implement Basic Auth user persistence, hashing, built-in protection, and public management UI before strict route enforcement.
10. `010-basic-auth-mcp-runtime.md` -> `basic-auth-mcp-runtime` -> Enforce Basic Auth on `/mcp/basic` and Basic header precedence on `/mcp` using the existing Basic user service.
11. `011-rest-tools-list-runtime.md` -> `rest-tools-list-runtime` -> Expose configured enabled endpoints through `GET /rest/tools` with no-auth and Basic behavior.
12. `012-rest-tools-call-runtime.md` -> `rest-tools-call-runtime` -> Implement `POST /rest/tools/:name/call` and wire endpoint console REST execution for no-auth and Basic modes.
13. `013-oauth-users-management-ui.md` -> `oauth-users-management-ui` -> Implement OAuth login-user persistence, built-in protection, TTL settings, and public management UI.
14. `014-oauth-clients-management-ui.md` -> `oauth-clients-management-ui` -> Implement OAuth client persistence, secret generation, redirect URI management, allowed endpoint selection, and client UI.
15. `015-oauth-authorize-login-consent.md` -> `oauth-authorize-login-consent` -> Implement the browser authorization entry, mock login, consent screen, endpoint selection, and authorization code creation.
16. `016-oauth-code-token-jwt.md` -> `oauth-code-token-jwt` -> Implement `/oauth/token` authorization_code exchange and signed JWT access tokens with endpoint permission claims.
17. `017-oauth-client-credentials-grant.md` -> `oauth-client-credentials-grant` -> Implement non-interactive client_credentials token issuance with endpoint scope intersection.
18. `018-oauth-discovery-metadata.md` -> `oauth-discovery-metadata` -> Expose OAuth protected-resource, authorization-server, OIDC configuration, and JWKS metadata aligned with the mock server runtime.
19. `019-oauth-mcp-rest-permission-enforcement.md` -> `oauth-mcp-rest-permission-enforcement` -> Validate Bearer tokens and enforce endpoint permissions on MCP and REST routes, with correct 401 versus 403 behavior.
20. `020-issued-token-ui-revocation.md` -> `issued-token-ui-revocation` -> Build issued-token inspection/filtering UI and token revocation behavior that affects subsequent OAuth runtime calls.
21. `021-failure-delay-forced-error-runtime.md` -> `failure-delay-forced-error-runtime` -> Implement artificial delay, timeout shortcut, and forced error behavior for MCP and REST calls.
22. `022-malformed-response-console-audit.md` -> `malformed-response-console-audit` -> Implement intentionally malformed response modes with visible warnings, console evidence, and audit logging for failure-simulation changes.
23. `023-operator-config-health-logs.md` -> `operator-config-health-logs` -> Complete operator-facing health, public config, base URL behavior, connection guide, root-protected config changes, and server logging.
24. `024-docker-nginx-final-hardening.md` -> `docker-nginx-final-hardening` -> Package and reconcile the MVP for operator handoff with Docker/Nginx examples, final docs, debt tracking, and full deterministic proof.

## Split Rationale

The queue is intentionally finer-grained than one task per product spec. Larger PRD areas were split where a single task would otherwise mix persistence, UI, protocol runtime, auth enforcement, token operations, failure modes, or deployment hardening.

## Operating rule

A task may be promoted only when all of the following are true:

- deterministic checks pass
- the evaluator marks the task as `done`, unless the task uses `promotion_mode = deterministic_only`
- the evaluator recommends promotion when evaluator review is required
- the task metadata declares a valid `next_task_on_success`, or explicitly declares that the queue ends here

## Required Detail Sections

Every active task page should include these decision-complete sections before implementation starts:

- `Clarity notes`: what the task means, what assumptions are already decided, and how it relates to surrounding slices
- `Expected result`: the concrete repo/user/operator state that should exist after the task lands
- `Objections / risks to avoid`: common wrong turns, scope creep, or implementation shortcuts that should block promotion

## Queue Maintenance Rules

- keep every non-hardening task focused on one primary product spec
- do not leave completed task contracts in this directory
- review supporting product, frontend, architecture, and design docs before adding or revising task pages
- add UI screenshot, responsive, and accessibility checks to UI-heavy tasks before promotion work starts
- external-client behavior such as MCP, REST, Basic Auth, or OAuth must have E2E proof before promotion

## When this queue ends

When the active sequence is exhausted, do not continue with ad hoc prompts alone.
Update the relevant product specs and design docs first, then seed the next active queue for the next feature wave.

