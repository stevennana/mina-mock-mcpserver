# @minasoft/mmcp-cli

`mmcp` is a standalone command line MCP inspector for local development,
automation, and CI smoke tests.

It uses `@minasoft/mcp-inspector-core` under the hood and can inspect tools,
resources, resource templates, prompts, completion, raw JSON-RPC methods,
Streamable HTTP endpoints, and legacy SSE endpoints.

```bash
mmcp tools list http://127.0.0.1:3100/mcp/none
mmcp tools call http://127.0.0.1:3100/mcp/none --name echo --arg message=hello
mmcp resources read http://127.0.0.1:3100/mcp/none --uri mock://resources/server-status
mmcp prompts get http://127.0.0.1:3100/mcp/none --name support_reply --arg tone=friendly
```

## Install

```bash
npm install -g @minasoft/mmcp-cli
mmcp --help
```

Homebrew distribution is planned through `minasoftai/tap` by installing the npm
package tarball.

Requires Node.js `>=20.11`.

## Commands

Tools:

```bash
mmcp tools list http://127.0.0.1:3100/mcp/none
mmcp tools call http://127.0.0.1:3100/mcp/none --name echo --arg message=hello
mmcp tools call http://127.0.0.1:3100/mcp/none --name echo --json-args '{"message":"hello"}'
```

Resources:

```bash
mmcp resources list http://127.0.0.1:3100/mcp/none
mmcp resources read http://127.0.0.1:3100/mcp/none --uri mock://resources/server-status
mmcp resources templates http://127.0.0.1:3100/mcp/none
```

Prompts:

```bash
mmcp prompts list http://127.0.0.1:3100/mcp/none
mmcp prompts get http://127.0.0.1:3100/mcp/none --name support_reply --arg tone=friendly
mmcp prompts get http://127.0.0.1:3100/mcp/none --name support_reply --json-args '{"tone":"friendly"}'
```

Completion:

```bash
mmcp completion prompt http://127.0.0.1:3100/mcp/none --name support_reply --argument tone=fr
mmcp completion resource http://127.0.0.1:3100/mcp/none --uri 'mock://resources/customers/{customerId}' --argument customerId=cus
```

Raw JSON-RPC:

```bash
mmcp raw http://127.0.0.1:3100/mcp/none --method resources/list --params '{}'
```

## Auth

```bash
mmcp tools list https://example.com/mcp --bearer "$TOKEN"
mmcp tools list https://example.com/mcp --basic user:pass
mmcp tools list https://example.com/mcp --header "X-Test-Mode: true"
```

## Transports

Streamable HTTP-style POST is the default:

```bash
mmcp tools list https://example.com/mcp
```

Legacy SSE:

```bash
mmcp tools list https://example.com/sse --transport sse
```

Local self-signed HTTPS:

```bash
mmcp tools list https://127.0.0.1:3443/mcp/none --insecure-tls
```

## CI Output

Use `--format json` for machine-readable evidence:

```bash
mmcp resources list https://example.com/mcp --format json
```

Pretty mode shows status, method, latency, and a summarized JSON result. Add
`--verbose` to print every step body.

## Exit Codes

- `0`: valid MCP response, including JSON-RPC error envelopes returned by the server
- non-zero: invalid CLI args, invalid JSON, unsupported local command, transport failure, timeout, or malformed response

## Package Boundary

`mmcp` is generic. It does not include Mina Mock Server admin APIs, OAuth popup
automation, Prisma fixtures, or browser UI. Use it against Mina Mock Server or
any compatible MCP HTTP/SSE server.
