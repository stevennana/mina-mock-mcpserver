# Operator Configuration and Deployment

## Goal
The operator can inspect health, connection URLs, base URL behavior, reset with root password, logs, Docker/Nginx guidance, and deterministic startup proof.

## Trigger / Entry
Connection guide

## User-Visible Behavior
- Connection guide
- Health endpoint
- Root-protected base URL override
- Root-protected reset
- Reset requires exact confirmation text and records non-secret audit evidence for failed and successful attempts
- Operator-visible logs

## Validation
- Base URL precedence
- Root password checks
- Seed default recreation for currently implemented endpoint defaults
- Log-level filtering without secret leakage
- Health/config page renders, root reset restores defaults, production-style startup smoke passes
