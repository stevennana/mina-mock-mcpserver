# DESIGN.md

## Purpose
Capture the top-level design direction for MCP Mock Server and point to the deeper design docs that define the real constraints.

## Current Design Themes
- public test bench: make the current auth mode, endpoint, and response evidence visible at all times
- protocol clarity: separate MCP JSON-RPC, REST, and OAuth surfaces while keeping shared endpoint concepts consistent
- schema clarity: endpoint pages display MCP `inputSchema` generated from the endpoint domain service, not console-local rules
- fail-closed auth: invalid Basic/Bearer headers never silently downgrade to no-auth
- recoverable public service: root reset and audit evidence are first-class operator tools
- extensible mock behavior: exact matching, failure simulation, and future parameter types should fit the same model
- dense endpoint setup: public endpoint management should prioritize fast repeated create/edit/search workflows over decorative framing

## Source of Truth
Detailed rules belong in:
- `ARCHITECTURE.md`
- `docs/design-docs/`
- `docs/product-specs/`
- `docs/exec-plans/`
