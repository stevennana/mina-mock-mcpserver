# Endpoint Validation, Schema Preview, and Response Matching

```json taskmeta
{
  "id": "endpoint-validation-and-matching",
  "title": "Endpoint Validation, Schema Preview, and Response Matching",
  "order": 2,
  "status": "active",
  "next_task_on_success": "endpoint-management-list-editor-ui",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/DESIGN.md",
    "docs/references/prd-analysis.md",
    "docs/product-specs/endpoint-tool-management.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic"
}
```

## Objective

Create reusable endpoint domain services for validation, MCP inputSchema generation, and exact-match response-case selection.

## Clarity notes

- This is pure domain behavior that later UI, MCP, and REST tasks will call.
- All parameter and response-case rules should be enforced here, not independently reimplemented in route handlers.
- The matcher should be testable without HTTP, React, or Prisma setup beyond repository fixtures.
- Malformed response configuration is allowed only when explicitly configured as a negative-test mode.

## Expected result

- Endpoint validation rejects invalid definitions before persistence or runtime exposure.
- Input schema generation produces MCP-compatible object schemas for zero to three parameters.
- Exact-match response selection handles string, number, and boolean values consistently.
- Unit tests pin no-match/default/priority behavior for later MCP and REST use.

## Objections / risks to avoid

- Do not build UI in this task.
- Do not produce MCP JSON-RPC envelopes here; only generate schema/data used by protocol adapters later.
- Do not add future matcher types such as regex, enum, object, array, date, or custom JavaScript.
- Do not silently accept invalid JSON unless the endpoint is intentionally configured for malformed output.

## Scope

- Implement domain types and validation for endpoint name, parameter count, parameter names, parameter types, delete code, enabled state, response JSON, default case, and error/delay config bounds.
- Implement MCP `inputSchema` generation from endpoint parameters.
- Implement argument normalization and exact-match response-case selection with priority/default/no-match outcomes.
- Add focused unit tests for validators, schema generation, normalization, matching, and no-match/default behavior.

## Out of scope

- Prisma schema changes unless required by discovered validation gaps.
- Endpoint UI forms.
- MCP `tools/call` runtime formatting.
- REST route error bodies.

## Exit criteria

1. Validation rules are centralized in a reusable domain module.
2. Matcher behavior is deterministic and covered for string, number, and boolean parameters.
3. Generated input schemas match the PRD example shape, including required parameter names and `additionalProperties` behavior.
4. No route handler needs to invent endpoint validation rules.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run verify

## Implementation notes

- Keep the service API boring and explicit; later tasks should be able to import it without circular dependencies.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/DESIGN.md
- docs/references/prd-analysis.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `endpoint-tool-management.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T09:43:16.706Z: restored as current task after endpoint-domain-and-schema promotion.
