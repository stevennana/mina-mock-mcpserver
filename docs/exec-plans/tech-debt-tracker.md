# Tech Debt Tracker

## Purpose
Track recurring cleanup and deferred concerns that should not remain implicit.

## Current Debt

- Define SQLite backup, restore, and retention guidance before any long-lived public deployment.
- Decide audit-log IP/privacy policy before storing or exposing network-origin evidence in public deployments.
- Add production abuse controls outside MVP: rate limiting, request body limits beyond the sample Nginx cap, bot protection, and operational alerting.
- Optimize the Docker image after MVP handoff; the current image favors deterministic Prisma startup preparation over minimal size.
- Add a dedicated container smoke check if Docker packaging becomes a release artifact rather than an operator example.
- Plan Phase 2 MCP resources, prompts, sessions, and SSE only through a new docs-first feature queue.
