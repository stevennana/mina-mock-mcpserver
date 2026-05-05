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
- Endpoint-level malformed modes are explicit: `invalid_json` returns an invalid JSON body with JSON content type, `wrong_content_type` returns the configured/success body with text/plain content type, and `empty_body` returns an empty body. They apply only after the target endpoint and response case match.
- Endpoint console raw response evidence includes HTTP status, content type, malformed mode header, matched case, principal, elapsed time, and the raw body so developers can see what a client receives.
- Audit events for failure-simulation changes record mode/status/delay and boolean body/message presence without recording delete codes, passwords, raw tokens, or submitted secret values.

## Validation
- Delay bounds
- Forced error probability/config mapping
- Malformed response modes
- Audit event writes for mutations and failures
- Configure forced error/delay/malformed response and observe UI console plus audit events
