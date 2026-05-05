# Generated DB Schema

Generated for task `endpoint-domain-and-schema`.

Updated by task `endpoint-protected-delete-audit` for endpoint delete audit evidence.

## Runtime Database

- Provider: SQLite through Prisma.
- Default URL: `file:./data/runtime.sqlite`.
- Preparation command: `npm run db:prepare`.
- Preparation behavior: creates `data/`, applies Prisma migrations, generates Prisma Client, and runs idempotent endpoint seed defaults.
- Persistence source of truth: SQLite. `data/bootstrap-state.json` is no longer used by `db:prepare`.

## Endpoint

Stores durable mock tool records. `id` is the immutable internal identifier used by later permission and runtime slices; `name` is the externally visible tool label and may change without changing `id`.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by domain/seed code. |
| `name` | `String` | Unique tool name. |
| `title` | `String` | User-facing display title from the endpoint create/edit model. |
| `description` | `String` | Human-readable endpoint description. |
| `enabled` | `Boolean` | Runtime visibility toggle. |
| `protectedDefault` | `Boolean` | Marks built-in defaults that normal flows should protect. |
| `deleteCode` | `String?` | Endpoint delete-code storage for later protected delete flows. |
| `defaultResponseJson` | `String` | JSON-encoded default response body. |
| `failureMode` | `String` | Basic failure simulation mode placeholder, seeded as `none`. |
| `failureStatusCode` | `Int?` | Optional forced-error status. |
| `failureDelayMs` | `Int` | Optional delay duration, seeded as `0`. |
| `failureMessage` | `String?` | Optional forced-error message. |
| `malformedResponseJson` | `String?` | Optional malformed response payload for later runtime slices. |
| `createdAt` | `DateTime` | Audit-ready creation timestamp. |
| `updatedAt` | `DateTime` | Audit-ready update timestamp maintained by Prisma. |

## EndpointParam

Stores ordered parameter definitions for each endpoint. The schema supports the MVP limit of up to three parameters by position; domain validation in the next slice owns the user-facing limit enforcement.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by domain/seed code. |
| `endpointId` | `String` | Required relation to `Endpoint`, cascades on endpoint delete. |
| `position` | `Int` | Parameter order. Unique per endpoint. |
| `name` | `String` | Parameter key. Unique per endpoint. |
| `label` | `String?` | Optional UI label. |
| `description` | `String` | Parameter help text. |
| `type` | `String` | Parameter type placeholder, seeded as `string`. |
| `required` | `Boolean` | Required argument flag. |
| `defaultValueJson` | `String?` | Optional JSON-encoded default value. |
| `createdAt` | `DateTime` | Audit-ready creation timestamp. |
| `updatedAt` | `DateTime` | Audit-ready update timestamp maintained by Prisma. |

Indexes and constraints:

- `@@unique([endpointId, position])`
- `@@unique([endpointId, name])`
- `@@index([endpointId])`

## ResponseCase

Stores exact-match response cases and a default case marker. Matching semantics are intentionally deferred to the endpoint validation and matching task.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by domain/seed code. |
| `endpointId` | `String` | Required relation to `Endpoint`, cascades on endpoint delete. |
| `name` | `String` | Case name. Unique per endpoint. |
| `priority` | `Int` | Case selection ordering placeholder for later matching logic. |
| `matchArgsJson` | `String` | JSON-encoded exact-match argument object. |
| `responseJson` | `String` | JSON-encoded response body. |
| `statusCode` | `Int` | HTTP/runtime status placeholder for later adapters. |
| `delayMs` | `Int` | Case-level delay duration for later failure simulation/runtime slices. |
| `errorMode` | `String` | Case-level error mode placeholder, seeded as `none`. |
| `errorStatusCode` | `Int?` | Optional case-level forced-error status. |
| `errorMessage` | `String?` | Optional case-level forced-error message. |
| `errorBodyJson` | `String?` | Optional JSON-encoded case-level error body. |
| `isDefault` | `Boolean` | Marks the default/no-match case. |
| `createdAt` | `DateTime` | Audit-ready creation timestamp. |
| `updatedAt` | `DateTime` | Audit-ready update timestamp maintained by Prisma. |

Indexes and constraints:

- `@@unique([endpointId, name])`
- `@@index([endpointId, priority])`
- `@@index([endpointId])`

## AuditEvent

Stores non-secret mutation evidence for protected operations such as endpoint deletion.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by audit service code. |
| `eventType` | `String` | Event name such as `endpoint.delete`. |
| `subjectType` | `String` | Subject category, currently `endpoint` for delete audit events. |
| `subjectId` | `String?` | Immutable subject identifier when known. |
| `subjectName` | `String?` | User-visible subject label for operator review. |
| `outcome` | `String` | `success` or `failure`. |
| `actorType` | `String` | Actor category, currently public admin surface. |
| `metadataJson` | `String` | JSON metadata with method or reason codes only; submitted secrets are not stored. |
| `createdAt` | `DateTime` | Event timestamp. |

Indexes and constraints:

- `@@index([eventType, createdAt])`
- `@@index([subjectType, subjectId])`

## Seed Defaults

`npm run db:prepare` upserts one protected enabled endpoint:

- Endpoint ID: `endpoint_default_echo`
- Tool name: `echo`
- Title: `Echo`
- Delete code: `12345678`
- Parameter: `message` at position `0`
- Response cases: `default` at priority `0` and `hello-world` at priority `10`, both with no case-level delay/error configured

The seed uses immutable IDs and unique endpoint-scoped keys, so repeated preparation updates the built-in records without duplicating rows.
