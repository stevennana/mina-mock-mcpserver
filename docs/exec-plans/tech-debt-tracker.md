# Tech Debt Tracker

## Purpose
Track recurring cleanup and deferred concerns that should not remain implicit.

## Current Debt

- 2026-05-13T10:21:00.429Z: inspector-full-server-features auto-branched to `inspector-full-server-features-rca-npm-run-inspector-mock-9d318f2b` after repeated blocker `deterministic_failure|npm-run-inspector-mock|no-path-details` (Repeated required-command failure: npm run inspector:mock).

- 2026-05-13T10:46:00Z: Upstream MCP Inspector CLI `0.21.2` supports tools/resources/prompts but does not expose `completion/complete`; keep using the project Generic Inspector completion presets or an upstream browser Inspector version with Completion controls until upstream CLI adds a completion command.

- 2026-05-13T11:20:00Z: In the Codex sandbox, raw shell/Node loopback TCP to `127.0.0.1:3100` fails with `connect EPERM`; the repo-local upstream Inspector CLI shim now covers documented `/mcp/none`, `/mcp/basic`, and no-auth `/sse/none` tools/resources list/read checks. Recheck without the shim on a normal operator machine before deleting the sandbox workaround.

- 2026-05-14T07:49:46Z: `@minasoft/mcp-runtime` remains workspace-private after extraction. Before claiming npm availability, add a publishing task that finalizes semver/API stability, package metadata, release checks, and install instructions for downstream apps.

- 2026-05-13T07:09:40.812Z: mcp-resources-runtime auto-branched to `mcp-resources-runtime-rca-npx-y-modelcontextprotocol-inspector-0-21-2-cli-` after repeated blocker `deterministic_failure|npx-y-modelcontextprotocol-inspector-0-21-2-cli-|no-path-details` (Repeated required-command failure: npx -y @modelcontextprotocol/inspector@0.21.2 --cli http://127.0.0.1:3100/mcp/none --transport http --method resources/list).

- Define SQLite backup, restore, and retention guidance before any long-lived public deployment.
- Decide audit-log IP/privacy policy before storing or exposing network-origin evidence in public deployments.
- Add production abuse controls outside MVP: rate limiting, request body limits beyond the sample Nginx cap, bot protection, and operational alerting.
- Optimize the Docker image after MVP handoff; the current image favors deterministic Prisma startup preparation over minimal size.
- Add a dedicated container smoke check if Docker packaging becomes a release artifact rather than an operator example.
- Plan Phase 2 MCP resources, prompts, sessions, and SSE only through a new docs-first feature queue.
