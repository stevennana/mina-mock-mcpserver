# Operator Handoff

## Local Production Smoke

Run the full deterministic gate before handoff:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm run start:smoke
npm run verify
```

`npm run start:smoke` prepares SQLite state with `npm run db:prepare`, starts the production server, probes `/api/health`, and shuts the server down. The smoke script defaults to port `3100` for local verification; deployment artifacts set `PORT=3000`.

## Direct Operation

Prepare state and start a logged production server:

```bash
npm run db:prepare
PORT=3000 HOST=0.0.0.0 LOG_LEVEL=info npm run start:logged
```

`start:logged` writes timestamped server output under `logs/`. Supported `LOG_LEVEL` values are `trace`, `debug`, `info`, `warn`, and `error`.

For local HTTPS client testing without Nginx, create a short-lived localhost certificate and start the app-level TLS server:

```bash
npm run cert:dev
npm run build
npm run db:prepare
TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 APP_BASE_URL=https://127.0.0.1:3443 npm run start:tls
```

Use `npm run start:logged` with the same `TLS_CERT_FILE` and `TLS_KEY_FILE` values when you want HTTPS plus log capture. This path is for local protocol/client tests; keep Nginx or another reverse proxy as the preferred public TLS termination layer.

To prove the local HTTPS path end to end:

```bash
npm run start:tls:smoke
npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls
```

Use `--insecure-tls` only for local self-signed certificates under your control.

## Docker Compose

Build and run the packaged app:

```bash
docker compose up --build
```

The compose file exposes host port `3000`, persists SQLite under the `mcp-mock-data` volume mounted at `/app/data`, and persists logs under the `mcp-mock-logs` volume mounted at `/app/logs`. Change `ROOT_PASSWORD` before public use and set `APP_BASE_URL` to the public origin when running behind a real domain.

## Nginx

Use `deploy/nginx.conf` as a starting point for reverse proxying to a process listening on `127.0.0.1:3000`. The proxy forwards `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`; the app uses those headers in base URL resolution when `APP_BASE_URL` and the database override are unset. This remains the recommended TLS shape for public deployments.

## Routes

- Admin UI: `/`
- Health: `/api/health`
- Public config and connection examples: `/api/config`
- MCP: `/mcp`, `/mcp/none`, `/mcp/basic`, `/mcp/oauth`
- REST: `GET /rest/tools`, `POST /rest/tools/{tool_name}/call`
- OAuth metadata and runtime: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, `/oauth/token`, `/oauth/jwks`

## Ralph Loop

Run one task cycle:

```bash
./scripts/ralph/run-once.sh
./scripts/ralph/status.sh
```

Run unattended cycles:

```bash
RALPH_LOOP_SLEEP_SECONDS=45 ./scripts/ralph/run-loop.sh
```

Inspect state and artifacts:

```bash
tail -f state/run-log.md
cat state/current-cycle.json
cat state/evaluation.json
cat state/last-result.txt
ls state/artifacts/
```

When `state/current-task.txt` is `NONE`, the active queue is exhausted. Do not continue with ad hoc implementation; update the product specs/design docs first, then seed the next active queue under `docs/exec-plans/active/`.
