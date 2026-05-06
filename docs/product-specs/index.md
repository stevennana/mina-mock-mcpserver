# Product Specs Index

## Purpose
This directory contains user-facing behavior specs.
If a UI or API behavior is visible to users, it should be defined here before implementation drifts.

## Current Spec Set
| Spec | Status | Scope |
|---|---|---|
| `endpoint-tool-management.md` | confirmed | Endpoint and Tool Management |
| `mcp-json-rpc-runtime.md` | confirmed | MCP JSON-RPC Runtime |
| `rest-mock-api.md` | confirmed | REST Mock API |
| `basic-auth-management.md` | confirmed | Basic Auth Management |
| `oauth-consent-and-token-runtime.md` | confirmed | OAuth Consent and Token Runtime |
| `failure-simulation-and-audit.md` | confirmed | Failure Simulation and Audit |
| `operator-configuration.md` | confirmed | Operator Configuration and Deployment |
| `../INSPECTOR.md` | confirmed | MCP Inspector Integration |

## Editing Rule
When product behavior changes:
1. update the relevant spec
2. update the affected design or architecture docs if needed
3. only then adjust implementation plans
