# System Shape

## Purpose
Capture the project-specific design constraints for MCP Mock Server that are too detailed for `ARCHITECTURE.md` but too stable to leave implicit.

## Current Decisions
- browser UI and OAuth consent are served by the same Next.js app
- API route handlers provide admin CRUD, MCP, REST, OAuth, discovery, health, reset, and audit surfaces
- domain services separate endpoint matching, auth validation, token issuance, and protocol response formatting
- Prisma repositories persist SQLite state and seed built-ins
- Playwright starts the app on port 3100 for deterministic E2E checks
- Ralph state tracks the active exec-plan, artifacts, worker heartbeat, and promotion results
