# Generated DB Schema

Generated for task `endpoint-domain-and-schema`.

Updated by task `endpoint-protected-delete-audit` for endpoint delete audit evidence.
Updated by task `docker-nginx-final-hardening` to reflect the completed MVP schema surface.
Updated by task `mcp-resource-prompt-domain-schema` to include MCP resource, prompt, and completion fixture persistence.

## Runtime Database

- Provider: SQLite through Prisma.
- Default URL: `file:./data/runtime.sqlite`.
- Preparation command: `npm run db:prepare`.
- Preparation behavior: creates `data/`, applies Prisma migrations, generates Prisma Client, and runs idempotent seed defaults.
- Seed defaults include protected endpoint, MCP resource/template/prompt, Basic user, OAuth user, and OAuth client fixtures.
- Persistence source of truth: SQLite. `data/bootstrap-state.json` is no longer used by `db:prepare`.

## Endpoint

Stores durable mock tool records. `id` is the immutable internal identifier used by permission and runtime slices; `name` is the externally visible tool label and may change without changing `id`.

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

Stores ordered parameter definitions for each endpoint. The schema supports the MVP limit of up to three parameters by position; domain validation owns the user-facing limit enforcement.

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

Stores exact-match response cases and a default case marker used by MCP, REST, console, and failure-simulation runtime paths.

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

## McpResource

Stores direct MCP resource fixtures. Content is stored directly as text or base64 blob data; the schema intentionally has no host filesystem path field.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key and future permission binding identifier. |
| `uri` | `String` | Unique MCP resource URI. Local `file:` URIs are rejected by domain validation. |
| `name` | `String` | Operator-facing fixture name. |
| `title` | `String` | Optional display title. |
| `description` | `String` | Optional description. |
| `mimeType` | `String` | Content MIME type. |
| `enabled` | `Boolean` | Runtime visibility toggle for later resource handlers. |
| `protectedDefault` | `Boolean` | Marks seeded smoke-test fixtures. |
| `textContent` | `String?` | Text content when the resource is text-backed. |
| `blobContentBase64` | `String?` | Base64 content when the resource is blob-backed. |
| `annotationsJson` | `String?` | Optional JSON-encoded MCP annotations. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `uri` is unique
- `@@index([enabled, uri])`

## McpResourceTemplate

Stores resource template descriptors and mock rendered content templates.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key and future permission binding identifier. |
| `uriTemplate` | `String` | Unique URI template with named `{arguments}`. |
| `name` | `String` | Unique template name. |
| `title` | `String` | Optional display title. |
| `description` | `String` | Optional description. |
| `mimeType` | `String` | Rendered content MIME type. |
| `enabled` | `Boolean` | Runtime visibility toggle for later template handlers. |
| `protectedDefault` | `Boolean` | Marks seeded smoke-test fixtures. |
| `textTemplate` | `String?` | Text template content. |
| `blobTemplateBase64` | `String?` | Base64 blob template content. |
| `annotationsJson` | `String?` | Optional JSON-encoded MCP annotations. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `uriTemplate` is unique
- `name` is unique
- `@@index([enabled, name])`

## McpResourceTemplateArgument

Stores ordered arguments for resource templates.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key. |
| `resourceTemplateId` | `String` | Resource template relation, cascades on template delete. |
| `position` | `Int` | Argument order. |
| `name` | `String` | Argument name; domain validation requires it to appear in the URI template. |
| `description` | `String` | Optional description. |
| `required` | `Boolean` | Required flag, defaulting to true. |
| `sampleValueJson` | `String?` | Optional JSON-encoded sample value. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `@@unique([resourceTemplateId, position])`
- `@@unique([resourceTemplateId, name])`
- `@@index([resourceTemplateId])`

## McpPrompt

Stores prompt fixture definitions.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key and future permission binding identifier. |
| `name` | `String` | Unique prompt name. |
| `title` | `String` | Optional display title. |
| `description` | `String` | Optional description. |
| `enabled` | `Boolean` | Runtime visibility toggle for later prompt handlers. |
| `protectedDefault` | `Boolean` | Marks seeded smoke-test fixtures. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `name` is unique
- `@@index([enabled, name])`

## McpPromptArgument

Stores ordered prompt argument definitions.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key. |
| `promptId` | `String` | Prompt relation, cascades on prompt delete. |
| `position` | `Int` | Argument order. |
| `name` | `String` | Argument name. |
| `title` | `String` | Optional display title. |
| `description` | `String` | Optional description. |
| `required` | `Boolean` | Required flag. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `@@unique([promptId, position])`
- `@@unique([promptId, name])`
- `@@index([promptId])`

## McpPromptMessage

Stores ordered prompt messages. Messages may carry text template content and/or an embedded resource URI reference for later runtime rendering.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key. |
| `promptId` | `String` | Prompt relation, cascades on prompt delete. |
| `position` | `Int` | Message order. |
| `role` | `String` | Prompt message role, currently validated as `user` or `assistant`. |
| `textTemplate` | `String?` | Optional message text template. |
| `resourceUri` | `String?` | Optional embedded MCP resource URI reference. |
| `resourceMimeType` | `String?` | Optional embedded resource MIME type. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `@@unique([promptId, position])`
- `@@index([promptId])`

## McpCompletionCandidate

Stores completion candidates for resource-template arguments and prompt arguments.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key. |
| `ownerType` | `String` | Owner discriminator: `resource_template` or `prompt`. |
| `resourceTemplateId` | `String?` | Resource template relation, cascades on delete. |
| `promptId` | `String?` | Prompt relation, cascades on delete. |
| `argumentName` | `String` | Argument this candidate belongs to. |
| `value` | `String` | Candidate value returned by later completion runtime. |
| `label` | `String` | Optional display label. |
| `position` | `Int` | Candidate order within its owner. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `@@unique([resourceTemplateId, argumentName, value])`
- `@@unique([promptId, argumentName, value])`
- `@@index([ownerType, argumentName])`
- `@@index([resourceTemplateId])`
- `@@index([promptId])`

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

`npm run db:prepare` also upserts protected MCP fixture defaults:

| Model | ID | Name/URI | Notes |
|---|---|---|---|
| `McpResource` | `mcp_resource_default_status` | `mock://resources/server-status` | Enabled JSON text resource for smoke tests. |
| `McpResourceTemplate` | `mcp_resource_template_default_customer` | `mock://resources/customers/{customerId}` | Enabled JSON text template with `customerId` argument and `cust_123` completion candidate. |
| `McpPrompt` | `mcp_prompt_default_support_reply` | `support_reply` | Enabled prompt with required `tone` argument, embedded status resource reference, and `friendly` completion candidate. |
| `McpPrompt` | `mcp_prompt_default_release_notes` | `release_notes` | Enabled prompt with required `version` argument and `v1` completion candidate. |

`npm run db:prepare` also upserts protected test identities:

| Model | ID | Username | Notes |
|---|---|---|---|
| `BasicUser` | `basic_user_default` | `default` | Enabled built-in fixture with hashed `default` password. |
| `OAuthUser` | `oauth_user_default` | `default` | Enabled built-in fixture with hashed `default` password and 3600-second authorization-code token TTL. |
| `OAuthClient` | `oauth_client_default` | `default` | Enabled built-in fixture with hashed `default` secret, localhost redirect URI, 3600-second client-credentials TTL, and default enabled endpoint allowance. |

## ServerSetting

Stores root-protected operator settings.

| Field | Type | Notes |
|---|---|---|
| `key` | `String` | Primary key. Current setting: `baseUrl`. |
| `value` | `String` | Normalized setting value. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

## BasicUser

Stores Basic Auth test users for strict Basic MCP and REST calls.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by domain/seed code. |
| `username` | `String` | Unique Basic Auth username. |
| `passwordHash` | `String` | Scrypt password hash; plaintext passwords are never persisted. |
| `enabled` | `Boolean` | Basic Auth eligibility flag. |
| `builtIn` | `Boolean` | Marks the protected default/default fixture. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `username` is unique
- `@@index([builtIn, username])`

## OAuthClient

Stores mock OAuth clients for authorization-code and client-credentials grants.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by domain/seed code. |
| `clientId` | `String` | Unique public client identifier. |
| `displayName` | `String` | Operator-facing client label. |
| `secretHash` | `String` | Scrypt secret hash; plaintext secrets are shown only at creation/regeneration. |
| `enabled` | `Boolean` | Token issuance eligibility flag. |
| `builtIn` | `Boolean` | Marks the protected default/default fixture. |
| `redirectUrisJson` | `String` | JSON array of exact-match redirect URIs. |
| `clientCredentialsTtlSeconds` | `Int` | Token TTL for client-credentials grants. |
| `createdAt` | `DateTime` | Creation timestamp. |
| `updatedAt` | `DateTime` | Maintained by Prisma. |

Indexes and constraints:

- `clientId` is unique
- `@@index([builtIn, clientId])`

## OAuthClientAllowedEndpoint

Stores endpoint permissions available to an OAuth client.

| Field | Type | Notes |
|---|---|---|
| `oauthClientId` | `String` | OAuth client relation, cascades on client delete. |
| `endpointId` | `String` | Endpoint relation, cascades on endpoint delete. |
| `createdAt` | `DateTime` | Permission creation timestamp. |

Indexes and constraints:

- `@@id([oauthClientId, endpointId])`
- `@@index([endpointId])`

## OAuthUser

Stores mock OAuth login identities for browser authorization-code flow tasks.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by domain/seed code. |
| `username` | `String` | Unique login name. |
| `passwordHash` | `String` | Scrypt password hash; plaintext passwords are never persisted. |
| `enabled` | `Boolean` | Login eligibility flag. |
| `builtIn` | `Boolean` | Marks the protected default/default fixture. |
| `accessTokenTtlSeconds` | `Int` | MVP preset token TTL inherited by later authorization-code tokens. |
| `createdAt` | `DateTime` | Audit-ready creation timestamp. |
| `updatedAt` | `DateTime` | Audit-ready update timestamp maintained by Prisma. |

Indexes and constraints:

- `username` is unique
- `@@index([builtIn, username])`

## OAuthAuthorizationCode

Stores short-lived, single-use authorization codes.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key. |
| `code` | `String` | Unique opaque authorization code. |
| `oauthClientId` | `String` | Client bound to the code. |
| `oauthUserId` | `String` | Login user bound to the code. |
| `redirectUri` | `String` | Exact redirect URI required at token exchange. |
| `resource` | `String` | Audience/resource for issued token claims. |
| `state` | `String?` | Optional OAuth state echoed by the browser flow. |
| `codeChallenge` | `String?` | Optional PKCE S256 challenge captured at authorize time. |
| `codeChallengeMethod` | `String?` | Optional PKCE challenge method. Currently only `S256` is accepted. |
| `expiresAt` | `DateTime` | Expiry timestamp. |
| `usedAt` | `DateTime?` | Set after successful exchange. |
| `createdAt` | `DateTime` | Creation timestamp. |

Indexes and constraints:

- `code` is unique
- `@@index([code])`
- `@@index([oauthClientId, oauthUserId])`
- `@@index([expiresAt])`

## OAuthAuthorizationCodeEndpoint

Stores endpoint permissions selected during browser consent.

| Field | Type | Notes |
|---|---|---|
| `authorizationCodeId` | `String` | Authorization code relation, cascades on code delete. |
| `endpointId` | `String` | Endpoint relation, cascades on endpoint delete. |
| `createdAt` | `DateTime` | Permission creation timestamp. |

Indexes and constraints:

- `@@id([authorizationCodeId, endpointId])`
- `@@index([endpointId])`

## OAuthIssuedToken

Stores non-secret access-token metadata by JWT `jti`. Raw access token values are not persisted; token detail reconstructs claims from stored metadata for debugging.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | Primary key, assigned by token issuance code. |
| `jti` | `String` | Unique JWT ID used for runtime revocation lookup. |
| `oauthClientId` | `String` | Required relation to the issuing OAuth client. |
| `oauthUserId` | `String?` | OAuth user for authorization-code tokens; `null` for client-credentials tokens. |
| `grantType` | `String` | Issuing grant, currently `authorization_code` or `client_credentials`. |
| `scope` | `String` | Space-separated endpoint scope string returned at issuance. |
| `issuer` | `String` | Issuer used in the JWT `iss` claim when the token was issued. |
| `resource` | `String` | Audience/resource claim bound to the token. |
| `endpointPermissionsJson` | `String` | JSON-encoded endpoint ID permissions. |
| `issuedAt` | `DateTime` | JWT issued-at timestamp. |
| `expiresAt` | `DateTime` | JWT expiration timestamp. |
| `revokedAt` | `DateTime?` | Set when revoked; retained for historical inspection. |
| `createdAt` | `DateTime` | Persistence timestamp. |

Indexes and constraints:

- `jti` is unique
- `@@index([jti])`
- `@@index([oauthClientId, oauthUserId])`
- `@@index([expiresAt])`
- `@@index([revokedAt])`
