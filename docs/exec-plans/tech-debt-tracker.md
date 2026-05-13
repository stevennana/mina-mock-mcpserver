# Tech Debt Tracker

## Purpose
Track recurring cleanup and deferred concerns that should not remain implicit.

## Current Debt

- 2026-05-13T07:09:40.812Z: mcp-resources-runtime auto-branched to `mcp-resources-runtime-rca-npx-y-modelcontextprotocol-inspector-0-21-2-cli-` after repeated blocker `deterministic_failure|npx-y-modelcontextprotocol-inspector-0-21-2-cli-|no-path-details` (Repeated required-command failure: npx -y @modelcontextprotocol/inspector@0.21.2 --cli http://127.0.0.1:3100/mcp/none --transport http --method resources/list).

- Define SQLite backup, restore, and retention guidance before any long-lived public deployment.
- Decide audit-log IP/privacy policy before storing or exposing network-origin evidence in public deployments.
- Add production abuse controls outside MVP: rate limiting, request body limits beyond the sample Nginx cap, bot protection, and operational alerting.
- Optimize the Docker image after MVP handoff; the current image favors deterministic Prisma startup preparation over minimal size.
- Add a dedicated container smoke check if Docker packaging becomes a release artifact rather than an operator example.
- Plan Phase 2 MCP resources, prompts, sessions, and SSE only through a new docs-first feature queue.
