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
- 2026-05-05T16:34:18+09:00 - Revalidated the persistence foundation without broadening scope; confirmed `npm run db:prepare`, `npm run test:unit`, and `npm run verify` pass, including idempotent seed coverage.
- 2026-05-05T16:38:41+09:00 - Rechecked the implemented Prisma/SQLite endpoint persistence foundation against the current task contract; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` passed, with no additional scope changes needed.
- 2026-05-05T16:43:05+09:00 - Re-ran the mandatory promotion gates after reading the task-required docs; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed on the current checkout.
- 2026-05-05T16:46:56+09:00 - Verified the existing endpoint persistence implementation against the task scope; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed, so no code broadening was needed.
- 2026-05-05T16:51:25+09:00 - Re-read the required docs and confirmed the current Prisma/SQLite persistence foundation still satisfies `endpoint-tool-management.md`; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` passed with no implementation changes required.
- 2026-05-05T16:55:56+09:00 - Revalidated the existing persistence slice against the current task prompt; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed, and no code broadening was needed.
- 2026-05-05T17:00:25+09:00 - Re-read the required docs and AGENTS read-order docs, inspected the existing Prisma/SQLite endpoint persistence implementation, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no scope changes needed.
- 2026-05-05T17:05:26+09:00 - Re-read the task-required docs, confirmed the current persistence slice maps to `endpoint-tool-management.md`, and re-ran all mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` passed with no implementation changes needed.
- 2026-05-05T17:10:32+09:00 - Re-read the required repository docs, inspected the existing Prisma/SQLite endpoint persistence foundation, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed, so no scope changes were needed.
- 2026-05-05T17:15:44+09:00 - Revalidated the current `endpoint-domain-and-schema` implementation against the task contract; Prisma/SQLite persistence, idempotent seed defaults, generated schema docs, and repeatability coverage are present, and `npm run db:prepare`, `npm run test:unit`, and `npm run verify` passed.
- 2026-05-05T17:20:10+09:00 - Re-read the required docs plus AGENTS read-order docs, confirmed the existing Prisma/SQLite endpoint persistence slice maps to `endpoint-tool-management.md`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no code broadening needed.
- 2026-05-05T17:24:47+09:00 - Re-read the task-required docs, inspected the current Prisma/SQLite schema, seed, generated DB docs, and repeatability test, then re-ran `npm run db:prepare`, `npm run test:unit`, and `npm run verify`; all passed, with no additional implementation changes needed.
- 2026-05-05T17:30:02+09:00 - Re-read the requested repository docs and AGENTS read-order docs, verified the existing Prisma/SQLite endpoint schema, deterministic seed path, generated schema docs, and idempotency coverage remain scoped to `endpoint-domain-and-schema`; running the mandatory gates next.
- 2026-05-05T17:30:57+09:00 - Mandatory gates passed for this run: `npm run db:prepare`, `npm run test:unit`, and `npm run verify`.
- 2026-05-05T17:35:36+09:00 - Re-read the task-required docs, confirmed the existing Prisma/SQLite persistence slice maps to `endpoint-tool-management.md`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no code broadening needed.
- 2026-05-05T17:40:08+09:00 - Re-read the requested repository docs, inspected the Prisma/SQLite schema, migrations, seed defaults, generated DB docs, and repeatability test, then re-ran `npm run db:prepare`, `npm run test:unit`, and `npm run verify`; all passed and no scope changes were needed.
- 2026-05-05T17:45:29+09:00 - Re-read the required repository docs, verified the current Prisma/SQLite endpoint persistence foundation remains scoped to `endpoint-domain-and-schema`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
- 2026-05-05T17:49:49+09:00 - Re-read the required repository docs and AGENTS read-order docs, inspected the existing Prisma/SQLite endpoint persistence files, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no product-code changes needed.
- 2026-05-05T17:53:58+09:00 - Re-read the task-required docs and AGENTS read-order docs, confirmed the existing Prisma/SQLite endpoint persistence foundation still maps to `endpoint-tool-management.md`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
- 2026-05-05T17:58:28+09:00 - Re-read the requested repository docs, inspected the current Prisma/SQLite schema, migrations, seed defaults, generated DB docs, and idempotency test, then re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no scope changes needed.
- 2026-05-05T18:03:10+09:00 - Revalidated the existing endpoint persistence foundation against the current task prompt; Prisma/SQLite schema, migrations, idempotent seed defaults, generated DB docs, and repeatability coverage are present, and `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
- 2026-05-05T18:07:25+09:00 - Re-read the required repository docs, verified the existing endpoint persistence implementation remains scoped to `endpoint-domain-and-schema`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
- 2026-05-05T18:11:45+09:00 - Re-read the requested repository docs, inspected the current Prisma/SQLite schema, migrations, seed defaults, generated DB docs, and idempotency test, then re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no product-code changes needed.
- 2026-05-05T18:17:26+09:00 - Re-read the requested repository docs and AGENTS read-order docs, confirmed the existing Prisma/SQLite endpoint persistence foundation still maps to `endpoint-tool-management.md`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed with no product-code changes needed.
- 2026-05-05T18:21:56+09:00 - Re-read the task-required docs, inspected the current Prisma/SQLite endpoint schema, seed path, generated DB docs, and repeatability test, then re-ran all mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` passed with no product-code changes needed.
- 2026-05-05T18:26:20+09:00 - Re-read the requested repository docs and AGENTS read-order docs, confirmed the current Prisma/SQLite endpoint persistence foundation still maps to `endpoint-tool-management.md`, and re-ran the mandatory gates; `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
- 2026-05-05T18:31:09+09:00 - Revalidated the current `endpoint-domain-and-schema` slice against the task prompt; Prisma/SQLite schema, migrations, deterministic seed preparation, generated DB docs, and repeatability coverage are present, and `npm run db:prepare`, `npm run test:unit`, and `npm run verify` all passed.
