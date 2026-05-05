import type { PrismaClient } from "@prisma/client";
import { createPrismaClient, getDatabaseUrl } from "@/lib/db/client";
import { oauthDiscoveryUrls } from "@/lib/oauth/discovery";
import { recordAuditEvent } from "@/lib/audit/service";
import { verifyRootPassword } from "@/lib/security/root-password";
import { getBootstrapStatus } from "@/lib/bootstrap-status";
import { operatorLog } from "@/lib/operator/logger";

const BASE_URL_SETTING_KEY = "baseUrl";
const LOCAL_FALLBACK_BASE_URL = "http://localhost:3000";

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

export type BaseUrlSource = "app_base_url" | "database" | "forwarded_headers" | "host" | "local_fallback";

export class OperatorConfigAuthorizationError extends Error {
  constructor() {
    super("Root password is required to change operator config.");
    this.name = "OperatorConfigAuthorizationError";
  }
}

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

async function recordBaseUrlAuditEvent(
  input: {
    outcome: "success" | "failure";
    metadata: Record<string, string | number | boolean | null>;
  },
  client: ConfigClient,
) {
  await recordAuditEvent(
    {
      eventType: "system.config.base_url",
      subjectType: "server_setting",
      subjectId: BASE_URL_SETTING_KEY,
      subjectName: "baseUrl",
      outcome: input.outcome,
      metadata: input.metadata,
    },
    client,
  );
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

async function readDatabaseBaseUrl(client: ConfigClient) {
  const setting = await client.serverSetting.findUnique({ where: { key: BASE_URL_SETTING_KEY } });
  return setting?.value ? normalizeBaseUrl(setting.value) : null;
}

export async function resolveBaseUrl(
  request?: Request,
  client: ConfigClient = createPrismaClient(),
): Promise<{ baseUrl: string; source: BaseUrlSource; databaseOverride: string | null; appBaseUrl: string | null }> {
  const appBaseUrl = process.env.APP_BASE_URL ? normalizeBaseUrl(process.env.APP_BASE_URL) : null;
  const databaseOverride = await readDatabaseBaseUrl(client);
  if (appBaseUrl) {
    return { baseUrl: appBaseUrl, source: "app_base_url", databaseOverride, appBaseUrl };
  }
  if (databaseOverride) {
    return { baseUrl: databaseOverride, source: "database", databaseOverride, appBaseUrl };
  }

  const requestOrigin = originFromRequest(request);
  if (requestOrigin) {
    return { baseUrl: requestOrigin.value, source: requestOrigin.source, databaseOverride, appBaseUrl };
  }

  return { baseUrl: LOCAL_FALLBACK_BASE_URL, source: "local_fallback", databaseOverride, appBaseUrl };
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
      version: "1.0.0",
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
      version: "1.0.0",
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
  return {
    baseUrl,
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
            url: `${baseUrl.baseUrl}/mcp/oauth`,
            authorization_server: urls.authorizationServerMetadata,
            protected_resource: urls.protectedResourceMetadata,
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
    },
  };
}

export async function updateOperatorBaseUrl(
  input: { rootPassword: string | null; baseUrl: string | null },
  client: ConfigClient = createPrismaClient(),
) {
  if (!verifyRootPassword(input.rootPassword)) {
    await recordBaseUrlAuditEvent({ outcome: "failure", metadata: { reason: "invalid_root_password" } }, client);
    operatorLog("warn", "base URL override rejected", { reason: "invalid_root_password" });
    throw new OperatorConfigAuthorizationError();
  }

  const rawBaseUrl = input.baseUrl?.trim() ?? "";
  if (!rawBaseUrl) {
    await client.serverSetting.deleteMany({ where: { key: BASE_URL_SETTING_KEY } });
    await recordBaseUrlAuditEvent({ outcome: "success", metadata: { action: "clear" } }, client);
    operatorLog("info", "base URL override cleared");
    return { databaseOverride: null };
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeBaseUrl(rawBaseUrl);
  } catch (error) {
    if (error instanceof OperatorConfigValidationError) {
      await recordBaseUrlAuditEvent(
        { outcome: "failure", metadata: { reason: "validation_failed", fields: Object.keys(error.fieldErrors).join(",") } },
        client,
      );
      operatorLog("warn", "base URL override rejected", { reason: "validation_failed" });
    }
    throw error;
  }

  await client.serverSetting.upsert({
    where: { key: BASE_URL_SETTING_KEY },
    update: { value: baseUrl },
    create: { key: BASE_URL_SETTING_KEY, value: baseUrl },
  });
  await recordBaseUrlAuditEvent({ outcome: "success", metadata: { action: "set", baseUrl } }, client);
  operatorLog("info", "base URL override updated", { baseUrl });
  return { databaseOverride: baseUrl };
}
