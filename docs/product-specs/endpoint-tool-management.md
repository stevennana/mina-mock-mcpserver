# Endpoint and Tool Management

## Goal
Public users create, edit, test, enable, disable, and delete mock endpoints that become MCP tools and REST call targets.

## Trigger / Entry
Dashboard endpoint counts

## User-Visible Behavior
- Dashboard endpoint counts
- Endpoint list/search
- Endpoint create/edit/delete forms
- Generated MCP schema preview
- Delete code or root password protected deletion
- Successful and failed endpoint delete attempts appear in audit evidence without submitted secrets
- Reset to defaults

## Validation
- Tool name, parameter, delete-code, JSON response, and default-case validation
- Input schema generation
- Exact-match response selection
- Protected deletion and reset invariants
- Audit evidence for endpoint delete success, failed confirmation, and root-password override
- Create endpoint, test via UI console, edit enabled state, delete with code, and verify list updates
