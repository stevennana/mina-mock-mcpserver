# MCP Resource/Prompt Domain And Schema

```json taskmeta
{
  "id": "mcp-resource-prompt-domain-schema",
  "title": "MCP Resource/Prompt Domain And Schema",
  "order": 27,
  "status": "completed",
  "next_task_on_success": "mcp-resource-management-ui",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md",
    "docs/product-specs/mcp-resources-prompts.md",
    "docs/product-specs/mcp-json-rpc-runtime.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit -- tests/unit/mcp-resources-prompts.test.ts",
    "npm run db:prepare"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated MCP feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-13T06:06:31.838Z"
}
```

## Objective
Add durable SQLite/Prisma persistence, seed defaults, validators, and domain services for MCP Resources, Resource Templates, Prompts, and Completion candidates.

## Clarity notes
- This is the enabling slice for `docs/product-specs/mcp-resources-prompts.md`.
- Resources and prompts are mock fixtures, not filesystem or external API readers.
- The domain must follow the existing `Types -> Config -> Repo -> Service -> Runtime -> UI` shape.
- Seed defaults should make protocol smoke tests possible without admin setup.

## Scope
- Add Prisma models/migration for direct resources, resource templates, prompt definitions, prompt arguments/messages, completion candidates, and permission-ready IDs.
- Add service APIs for list/get/create/update/delete and enabled runtime reads.
- Add validators for URI format, URI template argument names, MIME type, text/blob exclusivity, prompt required arguments, and completion candidate limits.
- Add seed defaults for one direct resource, one template, and two prompts.

## Out of scope
- Admin UI routes.
- MCP JSON-RPC runtime methods.
- OAuth permission enforcement.
- SSE subscription notifications.

## Expected result
- `db:prepare` creates and seeds resource/prompt data idempotently.
- Unit tests prove validation, seed defaults, and service mapping.
- Existing endpoint/tool behavior remains unchanged.

## Exit criteria
- `db:prepare` creates and seeds resource/prompt data idempotently.
- Unit tests prove validation, seed defaults, and service mapping.
- Existing endpoint/tool behavior remains unchanged.

## Objections / risks to avoid
- Do not store arbitrary local file paths or read host files.
- Do not combine this with UI work.
- Do not advertise new MCP capabilities until runtime handlers exist.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- tests/unit/mcp-resources-prompts.test.ts`
- `npm run db:prepare`

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.
- 2026-05-13T06:02:15Z: added MCP resource/prompt Prisma schema and migration, domain validators/services, idempotent seed defaults, and focused unit coverage for validation, seed rows, and enabled runtime reads. `npm run lint`, `npm run typecheck`, and `npm run test:unit -- tests/unit/mcp-resources-prompts.test.ts` pass; `npm run db:prepare` still pending in this run.
- 2026-05-13T06:03:04Z: completed required gate run. `npm run lint`, `npm run typecheck`, `npm run test:unit -- tests/unit/mcp-resources-prompts.test.ts`, and `npm run db:prepare` all pass.
- 2026-05-13T06:04:02Z: added reset cleanup for the new fixture tables so shared default seeding does not preserve mutable resource/prompt rows through root reset. Re-ran all required gates; all still pass.
- 2026-05-13T06:06:31.838Z: automatically promoted after deterministic checks and evaluator approval.
