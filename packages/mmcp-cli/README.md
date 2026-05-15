# @minasoft/mmcp-cli

`mmcp` is a standalone command line MCP inspector for local development,
automation, and CI smoke tests.

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

## Auth

```bash
mmcp tools list https://example.com/mcp --bearer "$TOKEN"
mmcp tools list https://example.com/mcp --basic user:pass
mmcp tools list https://example.com/mcp --header "X-Test-Mode: true"
```

Use `--format json` for machine-readable evidence in CI.
