# Endpoint Persistence Schema and Seed Defaults

```json taskmeta
{
  "id": "endpoint-domain-and-schema",
  "title": "Endpoint Persistence Schema and Seed Defaults",
  "order": 1,
  "status": "active",
  "next_task_on_success": "endpoint-validation-and-matching",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/DESIGN.md",
    "docs/references/prd-analysis.md",
    "docs/product-specs/endpoint-tool-management.md"
  ],
  "required_commands": [
    "npm run db:prepare",
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

Replace the bootstrap runtime placeholder with durable SQLite/Prisma persistence for endpoint/tool data and deterministic seed defaults.

## Clarity notes

- This task is only the persistence foundation for endpoints; it should not implement forms, MCP routes, REST routes, or auth behavior.
- The schema must use immutable endpoint IDs internally because later OAuth permissions should not drift when a tool name changes.
- `npm run db:prepare` is the deterministic runtime-prep command used by Ralph and startup smoke, so keep the command name stable.
- Seed behavior should be idempotent and safe to run before every test or startup smoke.

## Expected result

- Prisma and SQLite are wired into the repo with migrations/schema files and deterministic runtime preparation.
- Tables or models exist for endpoints, parameters, response cases, audit-ready timestamps, and enough seed defaults for later slices.
- Seed data can be recreated without duplicating rows or weakening protected/default invariants.
- `docs/generated/db-schema.md` records the schema shape and persistence assumptions.

## Objections / risks to avoid

- Do not keep using `data/bootstrap-state.json` as the real persistence mechanism after this task.
- Do not make endpoint names the only durable identifier.
- Do not add UI screens or external protocol routes in this persistence task.
- Do not leave migrations or seed commands dependent on local manual steps.

## Scope

- Add Prisma/SQLite dependencies, schema, migration or sync path, generated client setup, and repo-local DB configuration.
- Define endpoint, parameter, response case, and timestamp fields required by the PRD for MVP endpoint management.
- Implement idempotent seed preparation for at least one representative enabled endpoint and any protected defaults needed by endpoint flows.
- Update `scripts/db-prepare.mjs` to prepare SQLite state deterministically.
- Add unit coverage or command-level assertions that `db:prepare` can run repeatedly.

## Out of scope

- Endpoint validators and exact-match response selection beyond simple schema constraints.
- Endpoint management UI.
- MCP, REST, Basic Auth, or OAuth runtime behavior.
- Root reset behavior; that has its own task.

## Exit criteria

1. `npm run db:prepare` creates or updates the SQLite runtime state successfully from a clean checkout.
2. Running `npm run db:prepare` twice is safe and does not duplicate seed data.
3. The schema can represent endpoint names, descriptions, enabled state, up to three parameters, response cases, default responses, delete codes, and basic failure config fields.
4. `docs/generated/db-schema.md` matches the implemented persistence shape.
5. All required checks pass.

## Required checks

- npm run db:prepare
- npm run test:unit
- npm run verify

## Implementation notes

- Use the installed `prisma-cli` skill guidance if Prisma command details are needed.
- Keep repositories thin and prepare for domain services in the next task.

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
- 2026-05-05T17:05:00+09:00 - Found only the bootstrap placeholder (`scripts/db-prepare.mjs` writing `data/bootstrap-state.json`) and reused the existing `db:prepare` command name while replacing its implementation with Prisma migration/client/seed preparation.
- 2026-05-05T17:10:00+09:00 - Added Prisma SQLite schema and initial migration for endpoints, ordered parameters, response cases, timestamps, delete-code/default/failure fields, and immutable endpoint IDs.
- 2026-05-05T17:15:00+09:00 - Added idempotent default seed for protected enabled `endpoint_default_echo` plus a repeatability unit test that runs `db:prepare` twice against an isolated SQLite file.
- 2026-05-05T17:18:00+09:00 - Documented implemented persistence assumptions in `docs/generated/db-schema.md`.
- 2026-05-05T16:18:17+09:00 - Re-verified the current checkout for this handoff; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
- 2026-05-05T16:23:00+09:00 - Closed evaluator gaps by adding endpoint `title` plus response-case `priority`, `delayMs`, and case-level error config fields to Prisma schema, migration, seed defaults, generated schema docs, and the repeatability test.
- 2026-05-05T16:29:16+09:00 - Re-read the required repository docs and re-ran the required gates for this task; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed on the current checkout.
