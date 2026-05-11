import type { PrismaClient } from "@prisma/client";
import { createPrismaClient, getDatabaseUrl } from "@/lib/db/client";
import { oauthDiscoveryUrls } from "@/lib/oauth/discovery";
import { getBootstrapStatus } from "@/lib/bootstrap-status";
import { operatorLog } from "@/lib/operator/logger";
import packageJson from "../../package.json";

const LOCAL_FALLBACK_BASE_URL = "http://localhost:3000";
const APP_VERSION = process.env.APP_VERSION ?? packageJson.version;

type ConfigClient = Pick<
  PrismaClient,
  | "serverSetting"
  | "endpoint"
  | "basicUser"
  | "oAuthUser"
  | "oAuthClient"
  | "oAuthIssuedToken"
  | "auditEvent"
  | "$queryRaw"
>;

export type BaseUrlSource = "app_base_url" | "forwarded_headers" | "host" | "local_fallback";
export type TlsRuntimeMode = "http_or_proxy" | "app_https";

export class OperatorConfigValidationError extends Error {
  constructor(
    public fieldErrors: Record<string, string>,
    message = "Fix the highlighted config fields and save again.",
  ) {
    super(message);
    this.name = "OperatorConfigValidationError";
  }
}

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new OperatorConfigValidationError({ baseUrl: "Enter an absolute http or https URL." });
  }

  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.host || parsed.username || parsed.password) {
    throw new OperatorConfigValidationError({ baseUrl: "Enter an absolute http or https URL without credentials." });
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/+$/, "");
}

export function getTlsRuntimeConfig() {
  const certFileConfigured = Boolean(process.env.TLS_CERT_FILE);
  const keyFileConfigured = Boolean(process.env.TLS_KEY_FILE);
  const caFileConfigured = Boolean(process.env.TLS_CA_FILE);
  const enabled = certFileConfigured && keyFileConfigured;

  return {
    enabled,
    mode: enabled ? ("app_https" as TlsRuntimeMode) : ("http_or_proxy" as TlsRuntimeMode),
    recommendedPublicMode: "nginx_tls_termination",
    certFileConfigured,
    keyFileConfigured,
    caFileConfigured,
    command: "TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 npm run start:tls",
    loggedCommand: "TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 npm run start:logged",
  };
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function originFromRequest(request?: Request): { value: string; source: BaseUrlSource } | null {
  if (!request) {
    return null;
  }

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const proto = firstHeaderValue(request.headers.get("x-forwarded-proto")) ?? new URL(request.url).protocol.replace(":", "");
    return { value: normalizeBaseUrl(`${proto}://${forwardedHost}`), source: "forwarded_headers" };
  }

  const host = firstHeaderValue(request.headers.get("host"));
  if (host) {
    return { value: normalizeBaseUrl(`${new URL(request.url).protocol}//${host}`), source: "host" };
  }

  return { value: normalizeBaseUrl(new URL(request.url).origin), source: "host" };
}

export async function resolveBaseUrl(
  request?: Request,
  _client: ConfigClient = createPrismaClient(),
): Promise<{ baseUrl: string; source: BaseUrlSource; appBaseUrl: string | null }> {
  void _client;
  const appBaseUrl = process.env.APP_BASE_URL ? normalizeBaseUrl(process.env.APP_BASE_URL) : null;
  if (appBaseUrl) {
    return { baseUrl: appBaseUrl, source: "app_base_url", appBaseUrl };
  }

  const requestOrigin = originFromRequest(request);
  if (requestOrigin) {
    return { baseUrl: requestOrigin.value, source: requestOrigin.source, appBaseUrl };
  }

  return { baseUrl: LOCAL_FALLBACK_BASE_URL, source: "local_fallback", appBaseUrl };
}

export async function getOperatorHealth(client: ConfigClient = createPrismaClient()) {
  const status = getBootstrapStatus();
  try {
    await client.$queryRaw`SELECT 1`;
    const [endpoints, enabledEndpoints, basicUsers, oauthUsers, oauthClients, issuedTokens] = await Promise.all([
      client.endpoint.count(),
      client.endpoint.count({ where: { enabled: true } }),
      client.basicUser.count(),
      client.oAuthUser.count(),
      client.oAuthClient.count(),
      client.oAuthIssuedToken.count(),
    ]);
    return {
      status: "ok",
      version: APP_VERSION,
      runtime: status,
      database: {
        status: "ok",
        url: getDatabaseUrl(),
        counts: { endpoints, enabledEndpoints, basicUsers, oauthUsers, oauthClients, issuedTokens },
      },
      time: new Date().toISOString(),
    };
  } catch (error) {
    operatorLog("error", "health check failed", { error: error instanceof Error ? error.message : "unknown_error" });
    return {
      status: "error",
      version: APP_VERSION,
      runtime: status,
      database: {
        status: "error",
        url: getDatabaseUrl(),
        counts: null,
      },
      time: new Date().toISOString(),
    };
  }
}

export async function getPublicOperatorConfig(request?: Request, client: ConfigClient = createPrismaClient()) {
  const [baseUrl, health] = await Promise.all([resolveBaseUrl(request, client), getOperatorHealth(client)]);
  const urls = oauthDiscoveryUrls(baseUrl.baseUrl);
  const tls = getTlsRuntimeConfig();
  return {
    baseUrl,
    tls,
    health,
    publicAdminWarning: "The admin UI and mutation APIs are public. Do not store sensitive customer data here.",
    routes: {
      ui: `${baseUrl.baseUrl}/`,
      health: `${baseUrl.baseUrl}/api/health`,
      publicConfig: `${baseUrl.baseUrl}/api/config`,
      mcp: {
        unified: `${baseUrl.baseUrl}/mcp`,
        noAuth: `${baseUrl.baseUrl}/mcp/none`,
        basic: `${baseUrl.baseUrl}/mcp/basic`,
        oauth: `${baseUrl.baseUrl}/mcp/oauth`,
        sseUnified: `${baseUrl.baseUrl}/sse`,
        sseNoAuth: `${baseUrl.baseUrl}/sse/none`,
        sseBasic: `${baseUrl.baseUrl}/sse/basic`,
        sseOAuth: `${baseUrl.baseUrl}/sse/oauth`,
      },
      rest: {
        tools: `${baseUrl.baseUrl}/rest/tools`,
        callTemplate: `${baseUrl.baseUrl}/rest/tools/{tool_name}/call`,
      },
      oauth: urls,
    },
    examples: {
      mcpClient: {
        mcpServers: {
          "mcp-mock-no-auth": {
            url: `${baseUrl.baseUrl}/mcp/none`,
          },
          "mcp-mock-basic": {
            url: `${baseUrl.baseUrl}/mcp/basic`,
            headers: {
              Authorization: "Basic base64(default:default)",
            },
          },
          "mcp-mock-oauth": {
            type: "streamable-http",
            url: `${baseUrl.baseUrl}/mcp/oauth`,
            authorization_server: urls.authorizationServerMetadata,
            protected_resource: urls.protectedResourceMetadata,
          },
          "mcp-mock-sse-no-auth": {
            type: "sse",
            url: `${baseUrl.baseUrl}/sse/none`,
          },
        },
      },
      curl: {
        listTools: `curl ${baseUrl.baseUrl}/rest/tools`,
        callTool: `curl -X POST ${baseUrl.baseUrl}/rest/tools/echo/call -H 'content-type: application/json' -d '{"arguments":{"message":"hello"}}'`,
        basicListTools: `curl -u default:default ${baseUrl.baseUrl}/rest/tools`,
        oauthDiscovery: `curl ${urls.protectedResourceMetadata}`,
      },
      logging: {
        command: "LOG_LEVEL=info npm run start:logged",
        levels: ["trace", "debug", "info", "warn", "error"],
        directory: "logs/",
      },
      tls: {
        devCertCommand: "npm run cert:dev",
        command: tls.command,
        loggedCommand: tls.loggedCommand,
        smokeCommand: "npm run start:tls:smoke",
        inspectorCommand: "npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls",
      },
    },
  };
}
