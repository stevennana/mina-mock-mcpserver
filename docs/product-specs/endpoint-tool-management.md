# Endpoint and Tool Management

## Goal
Public users create, edit, test, enable, disable, and delete mock endpoints that become MCP tools and REST call targets.

## Trigger / Entry
Dashboard endpoint counts

## User-Visible Behavior
- Dashboard endpoint counts
- Endpoint list/search
- Endpoint catalog page is list/search/status focused only
- Endpoint create, overview, edit, parameters/schema, responses, failure simulation, console, and delete flows use focused pages instead of one dense all-in-one editor
- Endpoint workflow inputs expose concise hover tooltips that explain MCP-facing concepts such as tool name, generated inputSchema parameters, exact-match response cases, failure simulation modes, auth mode, and call arguments
- Generated MCP schema preview is shown with parameter editing and endpoint overview
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
- Catalog-to-detail navigation keeps the list usable without inline editor overload
