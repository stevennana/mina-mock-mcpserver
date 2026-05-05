# PLANS.md

## Purpose
Execution plans are the main planning unit in this repository.

A plan is not a vague idea. It is an executable work packet with:
- a clearly scoped goal
- explicit non-goals
- ordered implementation steps
- validation criteria
- exit criteria
- linked docs to update
- required commands that prove the task is complete

## Directory Layout
- `docs/exec-plans/active/` -> work currently intended for execution
- `docs/exec-plans/completed/` -> finished plans kept for history
- `docs/exec-plans/tech-debt-tracker.md` -> persistent cleanup and deferred concerns

## How to Use Plans
### Before coding
Read:
1. `ARCHITECTURE.md`
2. the relevant product spec
3. the relevant design doc
4. the target active plan

### Before writing or revising plans
- review the related product, frontend, architecture, and design docs first
- improve those supporting docs if the plan would otherwise need to guess
- keep each active plan page focused on one small feature slice
- review each active plan page on its own before considering the queue ready

### During coding
- keep diffs narrow
- update docs when behavior changes
- use the plan as the source of sequencing
- if the plan is wrong, fix the plan first
- search the codebase before assuming a helper or feature is missing
- prefer targeted checks for the unit or slice you just changed

### After coding
- move completed plans to the completed directory
- update quality scores if a domain meaningfully improved
- record debt instead of letting it stay implicit

## Promotion Rules
- Required commands in a task's `taskmeta` are hard gates.
- Failing tests block promotion even if the feature appears complete by inspection.
- Evaluator judgment exists to catch false positives after checks pass, not to excuse red checks.
- If the tests do not prove the intended behavior, tighten the task contract and checks before promoting.
- Fast local checks are for iteration speed; the required commands remain the promotion contract.
- If a feature depends on an outside resource, include E2E coverage for that feature before promotion.
- If a task is mainly UI or UX work, include a dedicated `@ui-*` Playwright command with screenshot, responsive, and accessibility checks in the promotion contract.
- If a task sets `taskmeta.promotion_mode` to `deterministic_only`, passing the required commands is sufficient for promotion without human review.
- If a plan page is still rough or broad, improve the supporting docs and split the plan before promotion work starts.
- If the same environment-specific blocker repeats three times, let the Ralph harness auto-branch into a dedicated RCA/fix exec-plan and then return to the original task through normal promotion.

## When The Current Queue Is Done
- Do not treat an empty active queue as the end of the product.
- Re-enter through docs first: update the relevant product specs and design docs before writing the next tasks.
- Preserve completed plans as history and seed a new active sequence for the next feature wave.
- Make the next tranche ordered, promotion-ready, and sized to the requested backlog depth before implementation begins.

## Merge / Throughput Philosophy
- small vertical tasks promote only after deterministic gates pass
- evaluator approval is secondary to required command success
- tasks that touch external-client behavior require E2E proof before promotion
- UI-heavy tasks can promote deterministically when screenshot, responsive, and accessibility checks pass
- repeated environment blockers become RCA/fix plans after three occurrences
