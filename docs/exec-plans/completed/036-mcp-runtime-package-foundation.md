# MCP Runtime Package Foundation

```json taskmeta
{
  "id": "mcp-runtime-package-foundation",
  "title": "MCP Runtime Package Foundation",
  "order": 36,
  "status": "completed",
  "next_task_on_success": "mcp-runtime-core-json-rpc",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/design-docs/mcp-runtime-library-architecture.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run mcp-runtime:build",
    "npm run mcp-runtime:test"
  ],
  "required_files": [
    "packages/mcp-runtime/package.json",
    "packages/mcp-runtime/src/index.ts",
    "packages/mcp-runtime/src/types.ts",
    "packages/mcp-runtime/tsconfig.json"
  ],
  "human_review_triggers": [
    "The package imports Next.js, Prisma, React, or Mock Server app modules.",
    "The public provider interface drifts from the architecture document without updating it.",
    "The task tries to migrate the app runtime before the package API is stable."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-14T07:13:35.309Z"
}
```

## Objective
Create the `@minasoft/mcp-runtime` package boundary and public TypeScript API contract without changing Mock Server runtime behavior yet.

## Scope
- Add `packages/mcp-runtime` as a buildable TypeScript ESM package.
- Define public MCP DTOs, JSON-RPC response types, provider inputs, provider results, provider error unions, and runtime options in package-owned `types`.
- Export only stable package entrypoints from `@minasoft/mcp-runtime`.
- Add root npm scripts for package build and package unit tests.
- Add focused package tests that compile/import the public API without using `@/` aliases, Next.js, Prisma, or app domain modules.

## Out of Scope
- Migrating `lib/mcp/http.ts` or current app tests to the package.
- Implementing full JSON-RPC method dispatch.
- Adding new MCP product behavior.
- Publishing to npm.

## Exit Criteria
- The package builds independently and emits type declarations.
- A tiny consumer-style test imports only from `@minasoft/mcp-runtime` and can define a minimal resources provider.
- No package source imports from `app/`, `lib/`, Prisma, Next.js, React, or Mock Server aliases.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`

## Evaluator Notes
- Confirm this task creates a clean public API surface, not a shadow copy of current app internals.
- Confirm package scripts are deterministic and available for later tasks.

## Progress Log
- 2026-05-14T00:00:00Z: seeded as the first reusable MCP runtime package task.
- 2026-05-14T07:18:00Z: added `packages/mcp-runtime` package boundary with TypeScript ESM build config, public type exports, root package scripts, and a consumer-style public import test.

## Progress log

- 2026-05-14T07:13:35.309Z: automatically promoted after deterministic checks and evaluator approval.
