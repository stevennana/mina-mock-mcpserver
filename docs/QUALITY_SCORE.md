# QUALITY_SCORE.md

## Purpose
Track the current quality level of product domains and architectural layers so agent work can target the weakest areas first.
Quality scores should reflect both implemented behavior and how convincingly the test strategy proves it.

## Rubric
- **0** nonexistent
- **1** sketched only
- **2** scaffoldable and specified
- **3** functional and reasonably verified
- **4** strong, legible, and difficult to accidentally regress

## Product Domain Scores
| Area | Current target | Evidence |
|---|---|---|
| Product clarity | Strong | PRD plus product specs per feature front |
| User workflows | Strong | Playwright E2E for endpoint, auth, OAuth, REST, reset, audit |
| Failure behavior | Strong | Unit and E2E coverage for 401/403/no-match/forced/malformed |
| Public admin safety | Medium-high | Delete code, root password, audit log, non-goals documented |
| Operator handoff | Strong | Health/config routes, start:logged, start:smoke, Docker Compose, Nginx example, handoff doc |

## Architecture Layer Scores
| Area | Current target | Evidence |
|---|---|---|
| Boundaries | Strong | Domain/service/repo/protocol adapter split |
| Persistence | Strong | Prisma SQLite migrations and seed defaults |
| Runtime proof | Strong | db:prepare, start:smoke, start:logged |
| Agent harness | Strong | Small task queue with mandatory checks, loop status, artifacts, queue exhaustion guidance |

## Immediate Quality Priorities
- make auth precedence and permission checks unit-tested before UI breadth
- treat MCP JSON-RPC response shapes as contract tests
- keep Playwright data setup deterministic and resettable
- add UI screenshot/responsive/accessibility proof for management screens
- keep docs updated with behavior changes before task promotion
- keep Docker/Nginx examples aligned with port 3000 and SQLite volume expectations
