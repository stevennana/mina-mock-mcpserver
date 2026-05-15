# `mmcp` Command Line MCP Inspector

`mmcp` is a standalone command line MCP inspector built from the same generic
inspection core used by Mina Inspector. Use it when you want quick terminal or
CI evidence without opening a browser.

## Install

During local development:

```bash
npm run mcp-inspector-core:build
npm run mmcp:build
node packages/mmcp-cli/dist/bin/mmcp.js --help
```

After npm publication:

```bash
npm install -g @minasoft/mmcp-cli
mmcp --help
```

Homebrew distribution is intended to use a `minasoftai/tap` formula named
`mmcp` that installs the published npm package tarball.

## Command Shape

```bash
mmcp <family> <action> <url> [options]
```

Examples:

```bash
mmcp tools list http://127.0.0.1:3100/mcp/none
mmcp tools call http://127.0.0.1:3100/mcp/none --name echo --arg message=hello
mmcp resources list http://127.0.0.1:3100/mcp/none
mmcp resources read http://127.0.0.1:3100/mcp/none --uri mock://resources/server-status
mmcp resources templates http://127.0.0.1:3100/mcp/none
mmcp prompts list http://127.0.0.1:3100/mcp/none
mmcp prompts get http://127.0.0.1:3100/mcp/none --name support_reply --arg tone=friendly
mmcp completion prompt http://127.0.0.1:3100/mcp/none --name support_reply --argument tone=friendly
mmcp raw http://127.0.0.1:3100/mcp/none --method resources/list --params '{}'
```

## Shared Options

```bash
--transport http|sse
--header "Name: Value"
--basic user:pass
--bearer token
--protocol-version 2025-06-18
--insecure-tls
--format pretty|json
--verbose
```

Use `--format json` for machine-readable CI evidence:

```bash
mmcp resources list http://127.0.0.1:3100/mcp/none --format json
```

## Auth Examples

Basic Auth:

```bash
mmcp tools list http://127.0.0.1:3100/mcp/basic --basic default:default
```

Bearer token:

```bash
mmcp tools list http://127.0.0.1:3100/mcp/oauth --bearer "$ACCESS_TOKEN"
```

Raw header:

```bash
mmcp tools list https://example.com/mcp --header "Authorization: Bearer $ACCESS_TOKEN"
```

## Transports

Streamable HTTP-style POST is the default:

```bash
mmcp tools list http://127.0.0.1:3100/mcp/none
```

Legacy SSE can be selected explicitly:

```bash
mmcp tools list http://127.0.0.1:3100/sse/none --transport sse
```

## Package Boundary

`mmcp` is intentionally thin. Protocol request building, HTTP/SSE execution,
header redaction, response normalization, and diagnostics live in
`@minasoft/mcp-inspector-core`.

The core package does not include Mock Server admin APIs, OAuth popup UI,
scenario runner behavior, Prisma, React, or Next.js. This keeps it reusable for
other MCP-compatible services.

## Verification

```bash
npm run mcp-inspector-core:test
npm run mmcp:test
npm run mmcp:smoke
```
