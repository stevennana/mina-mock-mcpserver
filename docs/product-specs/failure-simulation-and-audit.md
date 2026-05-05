# Failure Simulation and Audit

## Goal
Users configure delays, forced errors, malformed responses, and review audit evidence for public mutations and token events.

## Trigger / Entry
Failure simulation controls

## User-Visible Behavior
- Failure simulation controls
- Timeout shortcut
- Malformed response warning
- Audit log filters
- Endpoint-level delay applies to matched success or forced endpoint errors unless a response case has its own delay.
- Response-case forced errors can return normal tool-error payloads or protocol errors; REST maps both to configured HTTP status/body shapes while MCP maps tool errors to `isError` tool results and protocol errors to JSON-RPC errors.

## Validation
- Delay bounds
- Forced error probability/config mapping
- Malformed response modes
- Audit event writes for mutations and failures
- Configure forced error/delay/malformed response and observe UI console plus audit events
