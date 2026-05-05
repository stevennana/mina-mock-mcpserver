# Docker, Nginx, Final Docs, and Queue Completion Hardening

```json taskmeta
{
  "id": "docker-nginx-final-hardening",
  "title": "Docker, Nginx, Final Docs, and Queue Completion Hardening",
  "order": 24,
  "status": "queued",
  "next_task_on_success": null,
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/QUALITY_SCORE.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md",
    "docs/references/prd-analysis.md",
    "docs/product-specs/operator-configuration.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run build",
    "npm run test:unit",
    "npm run test:e2e",
    "npm run start:smoke",
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

Package and reconcile the MVP for operator handoff with Docker/Nginx examples, final docs, debt tracking, and full deterministic proof.

## Clarity notes

- This is final hardening and packaging for the current queue, not a feature-expansion task.
- Docs, scripts, Docker/Nginx files, and package commands must describe the same system.
- Remaining gaps should be recorded explicitly rather than hidden in prose.
- The next feature wave must be planned through docs after this queue completes.

## Expected result

- Dockerfile, docker-compose, and Nginx example config exist and match the deployment target.
- Quality, reliability, security, generated schema, and tech-debt docs reflect the implemented MVP.
- Full deterministic verification passes, including production-style startup smoke.
- Operator guidance explains one Ralph cycle, unattended loop, status inspection, logs, artifacts, and next-queue creation.

## Objections / risks to avoid

- Do not add post-MVP features such as SSE, resources/prompts, external providers, or RBAC.
- Do not claim deployment readiness if verify/startup smoke fails.
- Do not leave docs with stale ports, commands, or log paths.
- Do not silently drop known debt; record it.

## Scope

- Add Dockerfile, docker-compose, and Nginx example config.
- Reconcile docs with implemented behavior.
- Update `docs/exec-plans/tech-debt-tracker.md` with remaining debt.
- Run and fix the full deterministic command set.
- Confirm Ralph state and queue exhaustion behavior are documented.

## Out of scope

- New user-visible product features.
- Production SSO/RBAC.
- External OAuth providers.
- SSE/session support unless already implemented earlier.

## Exit criteria

1. Docker/Nginx artifacts align with port 3000 exposure and SQLite volume expectations.
2. Docs match actual commands, routes, auth modes, and logging behavior.
3. Debt tracker is explicit and current.
4. Full verify and startup smoke pass.
5. All required checks pass.

## Required checks

- npm run lint
- npm run typecheck
- npm run build
- npm run test:unit
- npm run test:e2e
- npm run start:smoke
- npm run verify

## Implementation notes

- If this task reveals a new feature need, document it for the next queue instead of implementing it here.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/QUALITY_SCORE.md
- docs/RELIABILITY.md
- docs/SECURITY.md
- docs/references/prd-analysis.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `operator-configuration.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
