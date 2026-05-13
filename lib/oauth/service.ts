import { createHash, createHmac, createSign, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { hashBasicPassword, verifyBasicPassword } from "@/lib/basic-auth/passwords";
import { createPrismaClient } from "@/lib/db/client";
import {
  DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS,
  DEFAULT_OAUTH_CLIENT_DISPLAY_NAME,
  DEFAULT_OAUTH_CLIENT_ID,
  DEFAULT_OAUTH_CLIENT_IDENTIFIER,
  DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
  DEFAULT_OAUTH_CLIENT_SECRET,
  DEFAULT_OAUTH_ISSUER,
  DEFAULT_OAUTH_PRIVATE_KEY_PEM,
  DEFAULT_OAUTH_PASSWORD,
  DEFAULT_OAUTH_USER_ID,
  DEFAULT_OAUTH_USERNAME,
  OAUTH_JWT_ALGORITHM,
  OAUTH_JWT_KEY_ID,
  OAUTH_AUTHORIZATION_CODE_TTL_SECONDS,
  OAuthClientBuiltInError,
  OAuthClientNotFoundError,
  OAuthClientValidationError,
  OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS,
  OAuthAuthorizeRequestError,
  OAuthLoginError,
  OAUTH_LOGIN_TICKET_TTL_SECONDS,
  OAuthIssuedTokenNotFoundError,
  OAuthTokenError,
  OAuthUserBuiltInError,
  OAuthUserNotFoundError,
  OAUTH_ACCESS_TOKEN_TTL_PRESETS,
} from "@/lib/oauth/types";
import {
  validateOAuthClientCreateInput,
  validateOAuthClientUpdateInput,
  validateOAuthUserCreateInput,
  validateOAuthUserUpdateInput,
} from "@/lib/oauth/validation";
import type {
  OAuthClientCreateInput,
  OAuthClientEndpointOption,
  OAuthClientPromptOption,
  OAuthClientResourceOption,
  OAuthClientListResult,
  OAuthAuthorizationCodeSummary,
  OAuthAuthorizeContext,
  OAuthAuthorizeRequest,
  OAuthConsentContext,
  OAuthClientSecretResult,
  OAuthClientSummary,
  OAuthClientUpdateInput,
  OAuthAccessTokenClaims,
  OAuthIssuedTokenDetail,
  OAuthIssuedTokenEndpointPermission,
  OAuthIssuedTokenPromptPermission,
  OAuthIssuedTokenResourcePermission,
  OAuthIssuedTokenListFilters,
  OAuthIssuedTokenListResult,
  OAuthIssuedTokenStatus,
  OAuthIssuedTokenSummary,
  OAuthTokenExchangeInput,
  OAuthTokenExchangeResult,
  OAuthUserCreateInput,
  OAuthUserListResult,
  OAuthUserSummary,
  OAuthUserUpdateInput,
} from "@/lib/oauth/types";

const oauthClientInclude = {
  allowedEndpoints: {
    include: { endpoint: true },
    orderBy: { endpoint: { name: "asc" } },
  },
  allowedResources: {
    include: { resource: true },
    orderBy: { resource: { uri: "asc" } },
  },
  allowedPrompts: {
    include: { prompt: true },
    orderBy: { prompt: { name: "asc" } },
  },
} satisfies Prisma.OAuthClientInclude;

type OAuthUserRecord = Prisma.OAuthUserGetPayload<object>;
type OAuthClientRecord = Prisma.OAuthClientGetPayload<{ include: typeof oauthClientInclude }>;
type OAuthAuthorizationCodeRecord = Prisma.OAuthAuthorizationCodeGetPayload<{
  include: { selectedEndpoints: true; selectedResources: true; selectedPrompts: true };
}>;
type OAuthIssuedTokenRecord = Prisma.OAuthIssuedTokenGetPayload<{
  include: { oauthClient: true; oauthUser: true };
}>;
type OAuthUserSeedClient = Pick<PrismaClient, "oAuthUser">;
type OAuthClientSeedClient = Pick<
  PrismaClient,
  "oAuthClient" | "oAuthClientAllowedEndpoint" | "oAuthClientAllowedResource" | "oAuthClientAllowedPrompt" | "endpoint" | "mcpResource" | "mcpPrompt"
>;
type OAuthClientPermissionLookupClient = Pick<PrismaClient, "endpoint" | "mcpResource" | "mcpPrompt">;
type OAuthClientAllowedPermissionWriteClient = Pick<
  PrismaClient,
  "oAuthClientAllowedEndpoint" | "oAuthClientAllowedResource" | "oAuthClientAllowedPrompt"
>;
type OAuthTokenExchangeClient = Pick<
  PrismaClient,
  "oAuthAuthorizationCode" | "oAuthIssuedToken" | "oAuthClient" | "auditEvent" | "$transaction"
>;

function toSummary(user: OAuthUserRecord): OAuthUserSummary {
  return {
    id: user.id,
    username: user.username,
    enabled: user.enabled,
    builtIn: user.builtIn,
    accessTokenTtlSeconds: user.accessTokenTtlSeconds,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function seedOAuthUserDefaults(client: OAuthUserSeedClient = createPrismaClient()) {
  const passwordHash = await hashBasicPassword(DEFAULT_OAUTH_PASSWORD);
  await client.oAuthUser.upsert({
    where: { id: DEFAULT_OAUTH_USER_ID },
    update: {
      username: DEFAULT_OAUTH_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
      accessTokenTtlSeconds: DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    },
    create: {
      id: DEFAULT_OAUTH_USER_ID,
      username: DEFAULT_OAUTH_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
      accessTokenTtlSeconds: DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    },
  });
}

function generateOAuthClientSecret() {
  return `mcp_mock_${randomBytes(24).toString("base64url")}`;
}

function endpointToOption(endpoint: { id: string; name: string; title: string; enabled: boolean }): OAuthClientEndpointOption {
  return {
    id: endpoint.id,
    name: endpoint.name,
    title: endpoint.title,
    enabled: endpoint.enabled,
  };
}

function resourceToOption(resource: { id: string; uri: string; name: string; title: string; enabled: boolean }): OAuthClientResourceOption {
  return {
    id: resource.id,
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    enabled: resource.enabled,
  };
}

function promptToOption(prompt: { id: string; name: string; title: string; enabled: boolean }): OAuthClientPromptOption {
  return {
    id: prompt.id,
    name: prompt.name,
    title: prompt.title,
    enabled: prompt.enabled,
  };
}

function parseRedirectUris(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseStringPermissions(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toClientSummary(client: OAuthClientRecord): OAuthClientSummary {
  const allowedEndpoints = client.allowedEndpoints.map((allowedEndpoint) => endpointToOption(allowedEndpoint.endpoint));
  const allowedResources = client.allowedResources.map((allowedResource) => resourceToOption(allowedResource.resource));
  const allowedPrompts = client.allowedPrompts.map((allowedPrompt) => promptToOption(allowedPrompt.prompt));
  return {
    id: client.id,
    clientId: client.clientId,
    displayName: client.displayName,
    enabled: client.enabled,
    builtIn: client.builtIn,
    redirectUris: parseRedirectUris(client.redirectUrisJson),
    clientCredentialsTtlSeconds: client.clientCredentialsTtlSeconds,
    allowedEndpointIds: allowedEndpoints.map((endpoint) => endpoint.id),
    allowedEndpoints,
    allowedResourceIds: allowedResources.map((resource) => resource.id),
    allowedResources,
    allowedPromptIds: allowedPrompts.map((prompt) => prompt.id),
    allowedPrompts,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

function toAuthorizationCodeSummary(code: OAuthAuthorizationCodeRecord): OAuthAuthorizationCodeSummary {
  return {
    id: code.id,
    code: code.code,
    oauthClientId: code.oauthClientId,
    oauthUserId: code.oauthUserId,
    redirectUri: code.redirectUri,
    resource: code.resource,
    state: code.state,
    codeChallenge: code.codeChallenge,
    codeChallengeMethod: code.codeChallengeMethod,
    selectedEndpointIds: code.selectedEndpoints.map((endpoint) => endpoint.endpointId),
    selectedResourceIds: code.selectedResources.map((resource) => resource.resourceId),
    selectedPromptIds: code.selectedPrompts.map((prompt) => prompt.promptId),
    expiresAt: code.expiresAt.toISOString(),
    usedAt: code.usedAt?.toISOString() ?? null,
    createdAt: code.createdAt.toISOString(),
  };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signJwt(header: Record<string, unknown>, payload: OAuthAccessTokenClaims) {
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(oauthJwtPrivateKey(), "base64url");
  return `${signingInput}.${signature}`;
}

function oauthJwtPrivateKey() {
  return process.env.OAUTH_JWT_PRIVATE_KEY_PEM || DEFAULT_OAUTH_PRIVATE_KEY_PEM;
}

function oauthIssuer(inputIssuer?: string) {
  return inputIssuer || process.env.APP_BASE_URL || DEFAULT_OAUTH_ISSUER;
}

function permissionScope(input: { endpointIds: string[]; resourceIds: string[]; promptIds: string[] }) {
  return [
    ...input.endpointIds.map((endpointId) => `endpoint:${endpointId}`),
    ...input.resourceIds.map((resourceId) => `resource:${resourceId}`),
    ...input.promptIds.map((promptId) => `prompt:${promptId}`),
  ].join(" ");
}

function tokenStatus(token: { expiresAt: Date; revokedAt: Date | null }, now: Date): OAuthIssuedTokenStatus {
  if (token.revokedAt) return "revoked";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

function tokenSubject(token: OAuthIssuedTokenRecord) {
  return token.oauthUser ? token.oauthUser.id : `client:${token.oauthClient.clientId}`;
}

function toIssuedTokenSummary(token: OAuthIssuedTokenRecord, now: Date): OAuthIssuedTokenSummary {
  const endpointPermissions = parseStringPermissions(token.endpointPermissionsJson);
  const resourcePermissions = parseStringPermissions(token.resourcePermissionsJson);
  const promptPermissions = parseStringPermissions(token.promptPermissionsJson);
  return {
    id: token.id,
    jti: token.jti,
    status: tokenStatus(token, now),
    subject: tokenSubject(token),
    clientId: token.oauthClient.clientId,
    oauthClientId: token.oauthClientId,
    oauthUserId: token.oauthUserId,
    username: token.oauthUser?.username ?? null,
    grantType: token.grantType as OAuthAccessTokenClaims["grant_type"],
    scope: token.scope,
    resource: token.resource,
    issuedAt: token.issuedAt.toISOString(),
    expiresAt: token.expiresAt.toISOString(),
    revokedAt: token.revokedAt?.toISOString() ?? null,
    endpointPermissionCount: endpointPermissions.length,
    resourcePermissionCount: resourcePermissions.length,
    promptPermissionCount: promptPermissions.length,
  };
}

function toIssuedTokenClaims(token: OAuthIssuedTokenRecord): OAuthAccessTokenClaims {
  return {
    iss: token.issuer,
    aud: token.resource,
    resource: token.resource,
    sub: tokenSubject(token),
    client_id: token.oauthClient.clientId,
    grant_type: token.grantType as OAuthAccessTokenClaims["grant_type"],
    iat: Math.floor(token.issuedAt.getTime() / 1000),
    exp: Math.floor(token.expiresAt.getTime() / 1000),
    jti: token.jti,
    scope: token.scope,
    endpoint_permissions: parseStringPermissions(token.endpointPermissionsJson),
    resource_permissions: parseStringPermissions(token.resourcePermissionsJson),
    prompt_permissions: parseStringPermissions(token.promptPermissionsJson),
  };
}

function permissionsFromRequestedScope(scope: string, allowed: { endpointIds: string[]; resourceIds: string[]; promptIds: string[] }) {
  if (!scope.trim()) {
    return {
      endpointIds: [...allowed.endpointIds].sort(),
      resourceIds: [...allowed.resourceIds].sort(),
      promptIds: [...allowed.promptIds].sort(),
    };
  }

  const allowedEndpoints = new Set(allowed.endpointIds);
  const allowedResources = new Set(allowed.resourceIds);
  const allowedPrompts = new Set(allowed.promptIds);
  const endpointIds: string[] = [];
  const resourceIds: string[] = [];
  const promptIds: string[] = [];
  for (const rawValue of scope.split(/\s+/)) {
    const value = rawValue.trim();
    if (value.startsWith("endpoint:")) {
      const endpointId = value.slice("endpoint:".length);
      if (endpointId && allowedEndpoints.has(endpointId)) endpointIds.push(endpointId);
    }
    if (value.startsWith("resource:")) {
      const resourceId = value.slice("resource:".length);
      if (resourceId && allowedResources.has(resourceId)) resourceIds.push(resourceId);
    }
    if (value.startsWith("prompt:")) {
      const promptId = value.slice("prompt:".length);
      if (promptId && allowedPrompts.has(promptId)) promptIds.push(promptId);
    }
  }

  return {
    endpointIds: Array.from(new Set(endpointIds)).sort(),
    resourceIds: Array.from(new Set(resourceIds)).sort(),
    promptIds: Array.from(new Set(promptIds)).sort(),
  };
}

async function assertAllowedPermissionsExist(
  input: { endpointIds: string[]; resourceIds: string[]; promptIds: string[] },
  client: OAuthClientPermissionLookupClient,
) {
  const [endpointCount, resourceCount, promptCount] = await Promise.all([
    input.endpointIds.length ? client.endpoint.count({ where: { id: { in: input.endpointIds } } }) : 0,
    input.resourceIds.length ? client.mcpResource.count({ where: { id: { in: input.resourceIds } } }) : 0,
    input.promptIds.length ? client.mcpPrompt.count({ where: { id: { in: input.promptIds } } }) : 0,
  ]);
  if (endpointCount !== input.endpointIds.length) {
    throw new OAuthClientValidationError({ allowedEndpointIds: "Choose only existing endpoints." });
  }
  if (resourceCount !== input.resourceIds.length) {
    throw new OAuthClientValidationError({ allowedResourceIds: "Choose only existing resources." });
  }
  if (promptCount !== input.promptIds.length) {
    throw new OAuthClientValidationError({ allowedPromptIds: "Choose only existing prompts." });
  }
}

async function replaceAllowedPermissions(
  oauthClientId: string,
  input: { endpointIds: string[]; resourceIds: string[]; promptIds: string[] },
  client: OAuthClientAllowedPermissionWriteClient,
) {
  await client.oAuthClientAllowedEndpoint.deleteMany({ where: { oauthClientId } });
  await client.oAuthClientAllowedResource.deleteMany({ where: { oauthClientId } });
  await client.oAuthClientAllowedPrompt.deleteMany({ where: { oauthClientId } });
  if (input.endpointIds.length > 0) {
    await client.oAuthClientAllowedEndpoint.createMany({
      data: input.endpointIds.map((endpointId) => ({ oauthClientId, endpointId })),
    });
  }
  if (input.resourceIds.length > 0) {
    await client.oAuthClientAllowedResource.createMany({
      data: input.resourceIds.map((resourceId) => ({ oauthClientId, resourceId })),
    });
  }
  if (input.promptIds.length > 0) {
    await client.oAuthClientAllowedPrompt.createMany({
      data: input.promptIds.map((promptId) => ({ oauthClientId, promptId })),
    });
  }
}

export async function seedOAuthClientDefaults(client: OAuthClientSeedClient = createPrismaClient()) {
  const secretHash = await hashBasicPassword(DEFAULT_OAUTH_CLIENT_SECRET);
  await client.oAuthClient.upsert({
    where: { id: DEFAULT_OAUTH_CLIENT_ID },
    update: {
      clientId: DEFAULT_OAUTH_CLIENT_IDENTIFIER,
      displayName: DEFAULT_OAUTH_CLIENT_DISPLAY_NAME,
      secretHash,
      enabled: true,
      builtIn: true,
      redirectUrisJson: JSON.stringify([DEFAULT_OAUTH_CLIENT_REDIRECT_URI]),
      clientCredentialsTtlSeconds: DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS,
    },
    create: {
      id: DEFAULT_OAUTH_CLIENT_ID,
      clientId: DEFAULT_OAUTH_CLIENT_IDENTIFIER,
      displayName: DEFAULT_OAUTH_CLIENT_DISPLAY_NAME,
      secretHash,
      enabled: true,
      builtIn: true,
      redirectUrisJson: JSON.stringify([DEFAULT_OAUTH_CLIENT_REDIRECT_URI]),
      clientCredentialsTtlSeconds: DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS,
    },
  });

  const [defaultEndpoints, defaultResources, defaultPrompts] = await Promise.all([
    client.endpoint.findMany({ where: { enabled: true }, select: { id: true } }),
    client.mcpResource.findMany({ where: { enabled: true }, select: { id: true } }),
    client.mcpPrompt.findMany({ where: { enabled: true }, select: { id: true } }),
  ]);
  for (const endpoint of defaultEndpoints) {
    await client.oAuthClientAllowedEndpoint.upsert({
      where: {
        oauthClientId_endpointId: {
          oauthClientId: DEFAULT_OAUTH_CLIENT_ID,
          endpointId: endpoint.id,
        },
      },
      update: {},
      create: {
        oauthClientId: DEFAULT_OAUTH_CLIENT_ID,
        endpointId: endpoint.id,
      },
    });
  }
  for (const resource of defaultResources) {
    await client.oAuthClientAllowedResource.upsert({
      where: {
        oauthClientId_resourceId: {
          oauthClientId: DEFAULT_OAUTH_CLIENT_ID,
          resourceId: resource.id,
        },
      },
      update: {},
      create: {
        oauthClientId: DEFAULT_OAUTH_CLIENT_ID,
        resourceId: resource.id,
      },
    });
  }
  for (const prompt of defaultPrompts) {
    await client.oAuthClientAllowedPrompt.upsert({
      where: {
        oauthClientId_promptId: {
          oauthClientId: DEFAULT_OAUTH_CLIENT_ID,
          promptId: prompt.id,
        },
      },
      update: {},
      create: {
        oauthClientId: DEFAULT_OAUTH_CLIENT_ID,
        promptId: prompt.id,
      },
    });
  }
}

export async function listOAuthUsers(client: PrismaClient = createPrismaClient()): Promise<OAuthUserListResult> {
  const users = await client.oAuthUser.findMany({
    orderBy: [{ builtIn: "desc" }, { username: "asc" }],
  });
  const summaries = users.map(toSummary);

  return {
    total: summaries.length,
    enabled: summaries.filter((user) => user.enabled).length,
    disabled: summaries.filter((user) => !user.enabled).length,
    users: summaries,
    ttlPresets: OAUTH_ACCESS_TOKEN_TTL_PRESETS,
  };
}

export async function listOAuthClients(client: PrismaClient = createPrismaClient()): Promise<OAuthClientListResult> {
  const [clients, endpoints, resources, prompts] = await Promise.all([
    client.oAuthClient.findMany({
      include: oauthClientInclude,
      orderBy: [{ builtIn: "desc" }, { clientId: "asc" }],
    }),
    client.endpoint.findMany({
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
      select: { id: true, name: true, title: true, enabled: true },
    }),
    client.mcpResource.findMany({
      orderBy: [{ enabled: "desc" }, { uri: "asc" }],
      select: { id: true, uri: true, name: true, title: true, enabled: true },
    }),
    client.mcpPrompt.findMany({
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
      select: { id: true, name: true, title: true, enabled: true },
    }),
  ]);
  const summaries = clients.map(toClientSummary);

  return {
    total: summaries.length,
    enabled: summaries.filter((oauthClient) => oauthClient.enabled).length,
    disabled: summaries.filter((oauthClient) => !oauthClient.enabled).length,
    clients: summaries,
    endpointOptions: endpoints.map(endpointToOption),
    resourceOptions: resources.map(resourceToOption),
    promptOptions: prompts.map(promptToOption),
    ttlPresets: OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS,
  };
}

export async function listOAuthIssuedTokens(
  filters: OAuthIssuedTokenListFilters = {},
  client: PrismaClient = createPrismaClient(),
  now: Date = new Date(),
): Promise<OAuthIssuedTokenListResult> {
  const tokens = await client.oAuthIssuedToken.findMany({
    include: { oauthClient: true, oauthUser: true },
    orderBy: [{ issuedAt: "desc" }],
  });
  const summaries = tokens.map((token) => toIssuedTokenSummary(token, now));
  const normalizedSubject = filters.subject?.trim().toLowerCase() ?? "";
  const normalizedClient = filters.client?.trim().toLowerCase() ?? "";
  const filtered = summaries.filter((token) => {
    if (filters.status && filters.status !== "all" && token.status !== filters.status) return false;
    if (filters.grantType && filters.grantType !== "all" && token.grantType !== filters.grantType) return false;
    if (
      normalizedSubject &&
      !token.subject.toLowerCase().includes(normalizedSubject) &&
      !(token.username ?? "").toLowerCase().includes(normalizedSubject)
    ) {
      return false;
    }
    if (normalizedClient && !token.clientId.toLowerCase().includes(normalizedClient)) return false;
    return true;
  });

  return {
    total: summaries.length,
    active: summaries.filter((token) => token.status === "active").length,
    expired: summaries.filter((token) => token.status === "expired").length,
    revoked: summaries.filter((token) => token.status === "revoked").length,
    tokens: filtered,
  };
}

export async function getOAuthIssuedTokenDetail(
  jti: string,
  client: PrismaClient = createPrismaClient(),
  now: Date = new Date(),
): Promise<OAuthIssuedTokenDetail> {
  const token = await client.oAuthIssuedToken.findUnique({
    where: { jti },
    include: { oauthClient: true, oauthUser: true },
  });
  if (!token) {
    throw new OAuthIssuedTokenNotFoundError();
  }

  const endpointIds = parseStringPermissions(token.endpointPermissionsJson);
  const resourceIds = parseStringPermissions(token.resourcePermissionsJson);
  const promptIds = parseStringPermissions(token.promptPermissionsJson);
  const [endpointRecords, resourceRecords, promptRecords] = await Promise.all([
    endpointIds.length
      ? client.endpoint.findMany({
          where: { id: { in: endpointIds } },
          select: { id: true, name: true, title: true, enabled: true },
        })
      : [],
    resourceIds.length
      ? client.mcpResource.findMany({
          where: { id: { in: resourceIds } },
          select: { id: true, uri: true, name: true, title: true, enabled: true },
        })
      : [],
    promptIds.length
      ? client.mcpPrompt.findMany({
          where: { id: { in: promptIds } },
          select: { id: true, name: true, title: true, enabled: true },
        })
      : [],
  ]);
  const endpointLookup = new Map(endpointRecords.map((endpoint) => [endpoint.id, endpoint]));
  const resourceLookup = new Map(resourceRecords.map((resource) => [resource.id, resource]));
  const promptLookup = new Map(promptRecords.map((prompt) => [prompt.id, prompt]));
  const endpointPermissions: OAuthIssuedTokenEndpointPermission[] = endpointIds.map((endpointId) => {
    const endpoint = endpointLookup.get(endpointId);
    return {
      id: endpointId,
      name: endpoint?.name ?? null,
      title: endpoint?.title ?? null,
      enabled: endpoint?.enabled ?? null,
    };
  });
  const resourcePermissions: OAuthIssuedTokenResourcePermission[] = resourceIds.map((resourceId) => {
    const resource = resourceLookup.get(resourceId);
    return {
      id: resourceId,
      uri: resource?.uri ?? null,
      name: resource?.name ?? null,
      title: resource?.title ?? null,
      enabled: resource?.enabled ?? null,
    };
  });
  const promptPermissions: OAuthIssuedTokenPromptPermission[] = promptIds.map((promptId) => {
    const prompt = promptLookup.get(promptId);
    return {
      id: promptId,
      name: prompt?.name ?? null,
      title: prompt?.title ?? null,
      enabled: prompt?.enabled ?? null,
    };
  });

  return {
    ...toIssuedTokenSummary(token, now),
    claims: toIssuedTokenClaims(token),
    endpoint_permissions: endpointPermissions,
    resource_permissions: resourcePermissions,
    prompt_permissions: promptPermissions,
  };
}

export async function revokeOAuthIssuedToken(
  jti: string,
  client: PrismaClient = createPrismaClient(),
  now: Date = new Date(),
): Promise<OAuthIssuedTokenDetail> {
  const existing = await client.oAuthIssuedToken.findUnique({
    where: { jti },
    include: { oauthClient: true, oauthUser: true },
  });
  if (!existing) {
    throw new OAuthIssuedTokenNotFoundError();
  }

  await client.$transaction(async (tx) => {
    if (!existing.revokedAt) {
      await tx.oAuthIssuedToken.update({ where: { jti }, data: { revokedAt: now } });
    }
    await recordAuditEvent(
      {
        eventType: "oauth_token.revoke",
        subjectType: "oauth_issued_token",
        subjectId: jti,
        subjectName: existing.oauthClient.clientId,
        outcome: "success",
        metadata: {
          grantType: existing.grantType,
          oauthClientId: existing.oauthClientId,
          oauthUserId: existing.oauthUserId,
          alreadyRevoked: Boolean(existing.revokedAt),
        },
      },
      tx,
    );
  });

  return getOAuthIssuedTokenDetail(jti, client, now);
}

export async function revokeOAuthIssuedTokenForClient(
  input: { jti: string; clientId: string },
  client: PrismaClient = createPrismaClient(),
  now: Date = new Date(),
) {
  const existing = await client.oAuthIssuedToken.findUnique({
    where: { jti: input.jti },
    include: { oauthClient: true },
  });
  if (!existing || existing.oauthClient.clientId !== input.clientId) {
    return { revoked: false };
  }

  await revokeOAuthIssuedToken(input.jti, client, now);
  return { revoked: true };
}

export async function createOAuthUser(input: OAuthUserCreateInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateOAuthUserCreateInput(input);
  const user = await client.oAuthUser.create({
    data: {
      id: `oauth_user_${randomUUID()}`,
      username: validInput.username,
      passwordHash: await hashBasicPassword(validInput.password),
      enabled: validInput.enabled,
      builtIn: false,
      accessTokenTtlSeconds: validInput.accessTokenTtlSeconds,
    },
  });

  await recordAuditEvent(
    {
      eventType: "oauth_user.create",
      subjectType: "oauth_user",
      subjectId: user.id,
      subjectName: user.username,
      outcome: "success",
      metadata: { enabled: user.enabled, accessTokenTtlSeconds: user.accessTokenTtlSeconds },
    },
    client,
  );

  return toSummary(user);
}

export async function createOAuthClient(
  input: OAuthClientCreateInput,
  client: PrismaClient = createPrismaClient(),
): Promise<OAuthClientSecretResult> {
  const validInput = validateOAuthClientCreateInput(input);
  await assertAllowedPermissionsExist(
    {
      endpointIds: validInput.allowedEndpointIds,
      resourceIds: validInput.allowedResourceIds ?? [],
      promptIds: validInput.allowedPromptIds ?? [],
    },
    client,
  );
  const clientSecret = generateOAuthClientSecret();
  const oauthClient = await client.$transaction(async (tx) => {
    const created = await tx.oAuthClient.create({
      data: {
        id: `oauth_client_${randomUUID()}`,
        clientId: validInput.clientId,
        displayName: validInput.displayName,
        secretHash: await hashBasicPassword(clientSecret),
        enabled: validInput.enabled,
        builtIn: false,
        redirectUrisJson: JSON.stringify(validInput.redirectUris),
        clientCredentialsTtlSeconds: validInput.clientCredentialsTtlSeconds,
      },
    });
    await replaceAllowedPermissions(
      created.id,
      {
        endpointIds: validInput.allowedEndpointIds,
        resourceIds: validInput.allowedResourceIds ?? [],
        promptIds: validInput.allowedPromptIds ?? [],
      },
      tx,
    );
    await recordAuditEvent(
      {
        eventType: "oauth_client.create",
        subjectType: "oauth_client",
        subjectId: created.id,
        subjectName: created.clientId,
        outcome: "success",
        metadata: {
          enabled: created.enabled,
          redirectUriCount: validInput.redirectUris.length,
          allowedEndpointCount: validInput.allowedEndpointIds.length,
          allowedResourceCount: validInput.allowedResourceIds?.length ?? 0,
          allowedPromptCount: validInput.allowedPromptIds?.length ?? 0,
          clientCredentialsTtlSeconds: created.clientCredentialsTtlSeconds,
        },
      },
      tx,
    );
    return tx.oAuthClient.findUniqueOrThrow({ where: { id: created.id }, include: oauthClientInclude });
  });

  return { client: toClientSummary(oauthClient), clientSecret };
}

export async function updateOAuthUser(
  id: string,
  input: OAuthUserUpdateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const existing = await client.oAuthUser.findUnique({ where: { id } });
  if (!existing) {
    throw new OAuthUserNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthUserBuiltInError("update");
  }

  const validInput = validateOAuthUserUpdateInput(input);
  const data: Prisma.OAuthUserUpdateInput = {};
  if (typeof validInput.enabled === "boolean") {
    data.enabled = validInput.enabled;
  }
  if (validInput.password) {
    data.passwordHash = await hashBasicPassword(validInput.password);
  }
  if (typeof validInput.accessTokenTtlSeconds === "number") {
    data.accessTokenTtlSeconds = validInput.accessTokenTtlSeconds;
  }

  const user = await client.oAuthUser.update({
    where: { id },
    data,
  });

  await recordAuditEvent(
    {
      eventType: "oauth_user.update",
      subjectType: "oauth_user",
      subjectId: user.id,
      subjectName: user.username,
      outcome: "success",
      metadata: {
        enabled: user.enabled,
        accessTokenTtlSeconds: user.accessTokenTtlSeconds,
        passwordChanged: Boolean(validInput.password),
      },
    },
    client,
  );

  return toSummary(user);
}

export async function updateOAuthClient(
  id: string,
  input: OAuthClientUpdateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const existing = await client.oAuthClient.findUnique({ where: { id } });
  if (!existing) {
    throw new OAuthClientNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthClientBuiltInError("update");
  }

  const validInput = validateOAuthClientUpdateInput(input);
  if (validInput.allowedEndpointIds || validInput.allowedResourceIds || validInput.allowedPromptIds) {
    const current = await client.oAuthClient.findUniqueOrThrow({ where: { id }, include: oauthClientInclude });
    await assertAllowedPermissionsExist(
      {
        endpointIds: validInput.allowedEndpointIds ?? current.allowedEndpoints.map((endpoint) => endpoint.endpointId),
        resourceIds: validInput.allowedResourceIds ?? current.allowedResources.map((resource) => resource.resourceId),
        promptIds: validInput.allowedPromptIds ?? current.allowedPrompts.map((prompt) => prompt.promptId),
      },
      client,
    );
  }

  const oauthClient = await client.$transaction(async (tx) => {
    const data: Prisma.OAuthClientUpdateInput = {};
    if (validInput.displayName !== undefined) data.displayName = validInput.displayName;
    if (typeof validInput.enabled === "boolean") data.enabled = validInput.enabled;
    if (validInput.redirectUris !== undefined) data.redirectUrisJson = JSON.stringify(validInput.redirectUris);
    if (typeof validInput.clientCredentialsTtlSeconds === "number") {
      data.clientCredentialsTtlSeconds = validInput.clientCredentialsTtlSeconds;
    }

    await tx.oAuthClient.update({ where: { id }, data });
    if (validInput.allowedEndpointIds || validInput.allowedResourceIds || validInput.allowedPromptIds) {
      const current = await tx.oAuthClient.findUniqueOrThrow({ where: { id }, include: oauthClientInclude });
      await replaceAllowedPermissions(
        id,
        {
          endpointIds: validInput.allowedEndpointIds ?? current.allowedEndpoints.map((endpoint) => endpoint.endpointId),
          resourceIds: validInput.allowedResourceIds ?? current.allowedResources.map((resource) => resource.resourceId),
          promptIds: validInput.allowedPromptIds ?? current.allowedPrompts.map((prompt) => prompt.promptId),
        },
        tx,
      );
    }
    const updated = await tx.oAuthClient.findUniqueOrThrow({ where: { id }, include: oauthClientInclude });
    await recordAuditEvent(
      {
        eventType: "oauth_client.update",
        subjectType: "oauth_client",
        subjectId: updated.id,
        subjectName: updated.clientId,
        outcome: "success",
        metadata: {
          enabled: updated.enabled,
          redirectUriCount: parseRedirectUris(updated.redirectUrisJson).length,
          allowedEndpointCount: updated.allowedEndpoints.length,
          allowedResourceCount: updated.allowedResources.length,
          allowedPromptCount: updated.allowedPrompts.length,
          clientCredentialsTtlSeconds: updated.clientCredentialsTtlSeconds,
        },
      },
      tx,
    );
    return updated;
  });

  return toClientSummary(oauthClient);
}

export async function deleteOAuthUser(id: string, client: PrismaClient = createPrismaClient()) {
  const existing = await client.oAuthUser.findUnique({ where: { id } });
  if (!existing) {
    throw new OAuthUserNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthUserBuiltInError("delete");
  }

  await client.$transaction(async (tx) => {
    await tx.oAuthUser.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "oauth_user.delete",
        subjectType: "oauth_user",
        subjectId: existing.id,
        subjectName: existing.username,
        outcome: "success",
      },
      tx,
    );
  });

  return toSummary(existing);
}

export async function deleteOAuthClient(id: string, client: PrismaClient = createPrismaClient()) {
  const existing = await client.oAuthClient.findUnique({ where: { id }, include: oauthClientInclude });
  if (!existing) {
    throw new OAuthClientNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthClientBuiltInError("delete");
  }

  await client.$transaction(async (tx) => {
    await tx.oAuthClient.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "oauth_client.delete",
        subjectType: "oauth_client",
        subjectId: existing.id,
        subjectName: existing.clientId,
        outcome: "success",
      },
      tx,
    );
  });

  return toClientSummary(existing);
}

export async function regenerateOAuthClientSecret(
  id: string,
  client: PrismaClient = createPrismaClient(),
): Promise<OAuthClientSecretResult> {
  const existing = await client.oAuthClient.findUnique({ where: { id } });
  if (!existing) {
    throw new OAuthClientNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthClientBuiltInError("regenerateSecret");
  }

  const clientSecret = generateOAuthClientSecret();
  const oauthClient = await client.$transaction(async (tx) => {
    await tx.oAuthClient.update({
      where: { id },
      data: { secretHash: await hashBasicPassword(clientSecret) },
    });
    const updated = await tx.oAuthClient.findUniqueOrThrow({ where: { id }, include: oauthClientInclude });
    await recordAuditEvent(
      {
        eventType: "oauth_client.secret_regenerate",
        subjectType: "oauth_client",
        subjectId: updated.id,
        subjectName: updated.clientId,
        outcome: "success",
      },
      tx,
    );
    return updated;
  });

  return { client: toClientSummary(oauthClient), clientSecret };
}

export async function verifyOAuthUserCredentials(
  username: string,
  password: string,
  client: PrismaClient = createPrismaClient(),
) {
  const user = await client.oAuthUser.findUnique({ where: { username } });
  if (!user || !user.enabled) {
    return null;
  }
  const verified = await verifyBasicPassword(password, user.passwordHash);
  return verified ? toSummary(user) : null;
}

export async function verifyOAuthClientSecret(
  clientId: string,
  clientSecret: string,
  client: PrismaClient = createPrismaClient(),
) {
  const oauthClient = await client.oAuthClient.findUnique({ where: { clientId }, include: oauthClientInclude });
  if (!oauthClient || !oauthClient.enabled) {
    return null;
  }
  const verified = await verifyBasicPassword(clientSecret, oauthClient.secretHash);
  return verified ? toClientSummary(oauthClient) : null;
}

function normalizeAuthorizeRequest(input: URLSearchParams | Record<string, string | string[] | undefined>): OAuthAuthorizeRequest {
  const read = (key: string) => {
    const value = input instanceof URLSearchParams ? input.get(key) : input[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  return {
    responseType: read("response_type").trim(),
    clientId: read("client_id").trim(),
    redirectUri: read("redirect_uri").trim(),
    state: read("state") ? read("state") : null,
    resource: read("resource").trim() || "mcp-mock-server",
    codeChallenge: read("code_challenge").trim() || null,
    codeChallengeMethod: read("code_challenge_method").trim() || null,
  };
}

export function authorizationRequestToSearchParams(request: OAuthAuthorizeRequest) {
  const params = new URLSearchParams({
    response_type: request.responseType,
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    resource: request.resource,
  });
  if (request.state) params.set("state", request.state);
  if (request.codeChallenge) params.set("code_challenge", request.codeChallenge);
  if (request.codeChallengeMethod) params.set("code_challenge_method", request.codeChallengeMethod);
  return params;
}

export async function validateOAuthAuthorizeRequest(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  client: PrismaClient = createPrismaClient(),
): Promise<OAuthAuthorizeContext> {
  const request = normalizeAuthorizeRequest(input);
  if (request.responseType !== "code") {
    throw new OAuthAuthorizeRequestError("unsupported_response_type", "Only response_type=code is supported.", "response_type");
  }
  if (!request.clientId) {
    throw new OAuthAuthorizeRequestError("invalid_request", "client_id is required.", "client_id");
  }
  if (!request.redirectUri) {
    throw new OAuthAuthorizeRequestError("invalid_request", "redirect_uri is required.", "redirect_uri");
  }
  if (request.codeChallenge || request.codeChallengeMethod) {
    if (!request.codeChallenge) {
      throw new OAuthAuthorizeRequestError("invalid_request", "code_challenge is required when using PKCE.", "code_challenge");
    }
    if (request.codeChallengeMethod !== "S256") {
      throw new OAuthAuthorizeRequestError("invalid_request", "Only code_challenge_method=S256 is supported.", "code_challenge_method");
    }
  }

  const oauthClient = await client.oAuthClient.findUnique({ where: { clientId: request.clientId }, include: oauthClientInclude });
  if (!oauthClient || !oauthClient.enabled) {
    throw new OAuthAuthorizeRequestError("invalid_client", "OAuth client is not registered or enabled.", "client_id");
  }

  const redirectUris = parseRedirectUris(oauthClient.redirectUrisJson);
  if (!redirectUris.includes(request.redirectUri)) {
    throw new OAuthAuthorizeRequestError("invalid_redirect_uri", "redirect_uri is not registered for this client.", "redirect_uri");
  }

  return {
    request,
    client: toClientSummary(oauthClient),
    codeTtlSeconds: OAUTH_AUTHORIZATION_CODE_TTL_SECONDS,
  };
}

function loginTicketSecret() {
  return process.env.ROOT_PASSWORD || "mcp-mock-oauth-development-ticket-secret";
}

function signTicketPayload(encodedPayload: string) {
  return createHmac("sha256", loginTicketSecret()).update(encodedPayload).digest("base64url");
}

export function createOAuthLoginTicket(input: { request: OAuthAuthorizeRequest; oauthUserId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const payload = {
    ...input.request,
    oauthUserId: input.oauthUserId,
    exp: Math.floor(now.getTime() / 1000) + OAUTH_LOGIN_TICKET_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signTicketPayload(encodedPayload)}`;
}

function verifyOAuthLoginTicket(ticket: string, expectedRequest: OAuthAuthorizeRequest) {
  const [encodedPayload, signature] = ticket.split(".");
  if (!encodedPayload || !signature) {
    throw new OAuthLoginError("invalid_ticket", "Login ticket is invalid or expired.");
  }
  const expectedSignature = signTicketPayload(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new OAuthLoginError("invalid_ticket", "Login ticket is invalid or expired.");
  }

  let payload: OAuthAuthorizeRequest & { oauthUserId: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new OAuthLoginError("invalid_ticket", "Login ticket is invalid or expired.");
  }

  const matchesRequest =
    payload.responseType === expectedRequest.responseType &&
    payload.clientId === expectedRequest.clientId &&
    payload.redirectUri === expectedRequest.redirectUri &&
    payload.resource === expectedRequest.resource &&
    (payload.codeChallenge ?? null) === expectedRequest.codeChallenge &&
    (payload.codeChallengeMethod ?? null) === expectedRequest.codeChallengeMethod &&
    (payload.state ?? null) === expectedRequest.state;
  if (!matchesRequest || !payload.oauthUserId || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new OAuthLoginError("invalid_ticket", "Login ticket is invalid or expired.");
  }
  return payload.oauthUserId;
}

export async function loginOAuthUserForConsent(input: {
  authorizeRequest: URLSearchParams | Record<string, string | string[] | undefined>;
  username: string;
  password: string;
}, client: PrismaClient = createPrismaClient()) {
  const context = await validateOAuthAuthorizeRequest(input.authorizeRequest, client);
  const user = await verifyOAuthUserCredentials(input.username, input.password, client);
  if (!user) {
    throw new OAuthLoginError("invalid_user", "OAuth username or password is invalid.");
  }
  return {
    ...context,
    user,
    loginTicket: createOAuthLoginTicket({ request: context.request, oauthUserId: user.id }),
  } satisfies OAuthConsentContext;
}

export async function validateOAuthConsentRequest(input: {
  authorizeRequest: URLSearchParams | Record<string, string | string[] | undefined>;
  loginTicket: string;
}, client: PrismaClient = createPrismaClient()): Promise<OAuthConsentContext> {
  const context = await validateOAuthAuthorizeRequest(input.authorizeRequest, client);
  const oauthUserId = verifyOAuthLoginTicket(input.loginTicket, context.request);
  const user = await client.oAuthUser.findUnique({ where: { id: oauthUserId } });
  if (!user || !user.enabled) {
    throw new OAuthLoginError("invalid_user", "OAuth user is not enabled.");
  }
  return {
    ...context,
    user: toSummary(user),
    loginTicket: input.loginTicket,
  };
}

export async function createOAuthAuthorizationCode(input: {
  authorizeRequest: URLSearchParams | Record<string, string | string[] | undefined>;
  loginTicket: string;
  selectedEndpointIds: string[];
  selectedResourceIds?: string[];
  selectedPromptIds?: string[];
}, client: PrismaClient = createPrismaClient()): Promise<OAuthAuthorizationCodeSummary> {
  const context = await validateOAuthConsentRequest(
    { authorizeRequest: input.authorizeRequest, loginTicket: input.loginTicket },
    client,
  );
  const selectedEndpointIds = Array.from(new Set(input.selectedEndpointIds.map((id) => id.trim()).filter(Boolean)));
  const selectedResourceIds = Array.from(new Set((input.selectedResourceIds ?? []).map((id) => id.trim()).filter(Boolean)));
  const selectedPromptIds = Array.from(new Set((input.selectedPromptIds ?? []).map((id) => id.trim()).filter(Boolean)));
  if (selectedEndpointIds.length + selectedResourceIds.length + selectedPromptIds.length === 0) {
    throw new OAuthLoginError("invalid_selection", "Select at least one permission.");
  }
  const allowedEndpointIds = new Set(context.client.allowedEndpointIds);
  const allowedResourceIds = new Set(context.client.allowedResourceIds);
  const allowedPromptIds = new Set(context.client.allowedPromptIds);
  if (selectedEndpointIds.some((endpointId) => !allowedEndpointIds.has(endpointId))) {
    throw new OAuthLoginError("invalid_selection", "Endpoint selection is outside this client's allowed set.");
  }
  if (selectedResourceIds.some((resourceId) => !allowedResourceIds.has(resourceId))) {
    throw new OAuthLoginError("invalid_selection", "Resource selection is outside this client's allowed set.");
  }
  if (selectedPromptIds.some((promptId) => !allowedPromptIds.has(promptId))) {
    throw new OAuthLoginError("invalid_selection", "Prompt selection is outside this client's allowed set.");
  }

  const code = await client.$transaction(async (tx) => {
    const created = await tx.oAuthAuthorizationCode.create({
      data: {
        id: `oauth_code_${randomUUID()}`,
        code: randomBytes(32).toString("base64url"),
        oauthClientId: context.client.id,
        oauthUserId: context.user.id,
        redirectUri: context.request.redirectUri,
        resource: context.request.resource,
        state: context.request.state,
        codeChallenge: context.request.codeChallenge,
        codeChallengeMethod: context.request.codeChallengeMethod,
        expiresAt: new Date(Date.now() + OAUTH_AUTHORIZATION_CODE_TTL_SECONDS * 1000),
      },
    });
    await tx.oAuthAuthorizationCodeEndpoint.createMany({
      data: selectedEndpointIds.map((endpointId) => ({ authorizationCodeId: created.id, endpointId })),
    });
    if (selectedResourceIds.length) {
      await tx.oAuthAuthorizationCodeResource.createMany({
        data: selectedResourceIds.map((resourceId) => ({ authorizationCodeId: created.id, resourceId })),
      });
    }
    if (selectedPromptIds.length) {
      await tx.oAuthAuthorizationCodePrompt.createMany({
        data: selectedPromptIds.map((promptId) => ({ authorizationCodeId: created.id, promptId })),
      });
    }
    await recordAuditEvent(
      {
        eventType: "oauth_code.create",
        subjectType: "oauth_authorization_code",
        subjectId: created.id,
        subjectName: context.client.clientId,
        outcome: "success",
        metadata: {
          oauthClientId: context.client.id,
          oauthUserId: context.user.id,
          redirectUri: context.request.redirectUri,
          resource: context.request.resource,
          pkce: Boolean(context.request.codeChallenge),
          selectedEndpointCount: selectedEndpointIds.length,
          selectedResourceCount: selectedResourceIds.length,
          selectedPromptCount: selectedPromptIds.length,
          expiresAt: created.expiresAt.toISOString(),
        },
      },
      tx,
    );
    return tx.oAuthAuthorizationCode.findUniqueOrThrow({
      where: { id: created.id },
      include: { selectedEndpoints: true, selectedResources: true, selectedPrompts: true },
    });
  });

  return toAuthorizationCodeSummary(code);
}

function pkceS256Challenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function verifyPkceCodeVerifier(code: { codeChallenge: string | null; codeChallengeMethod: string | null }, codeVerifier?: string) {
  if (!code.codeChallenge) {
    return;
  }
  if (code.codeChallengeMethod !== "S256") {
    throw new OAuthTokenError("invalid_grant", "Authorization code uses an unsupported PKCE method.");
  }
  if (!codeVerifier) {
    throw new OAuthTokenError("invalid_request", "code_verifier is required for this authorization code.");
  }
  if (pkceS256Challenge(codeVerifier) !== code.codeChallenge) {
    throw new OAuthTokenError("invalid_grant", "code_verifier does not match the authorization code challenge.");
  }
}

export async function exchangeOAuthAuthorizationCode(
  input: OAuthTokenExchangeInput,
  client: OAuthTokenExchangeClient = createPrismaClient(),
): Promise<OAuthTokenExchangeResult> {
  if (input.grantType !== "authorization_code") {
    throw new OAuthTokenError("unsupported_grant_type", "Only grant_type=authorization_code is supported.");
  }
  if (!input.code || !input.redirectUri || !input.clientId || !input.clientSecret) {
    throw new OAuthTokenError("invalid_request", "code, redirect_uri, client_id, and client_secret are required.");
  }

  const now = input.now ?? new Date();
  const result = await client.$transaction(async (tx) => {
    const code = await tx.oAuthAuthorizationCode.findUnique({
      where: { code: input.code },
      include: {
        selectedEndpoints: true,
        selectedResources: true,
        selectedPrompts: true,
        oauthClient: true,
        oauthUser: true,
      },
    });
    if (!code) {
      throw new OAuthTokenError("invalid_grant", "Authorization code is invalid.");
    }
    if (!code.oauthClient.enabled || code.oauthClient.clientId !== input.clientId) {
      throw new OAuthTokenError("invalid_client", "OAuth client is invalid.");
    }
    if (!(await verifyBasicPassword(input.clientSecret, code.oauthClient.secretHash))) {
      throw new OAuthTokenError("invalid_client", "OAuth client is invalid.");
    }
    if (code.redirectUri !== input.redirectUri) {
      throw new OAuthTokenError("invalid_grant", "redirect_uri does not match the authorization code.");
    }
    if (code.usedAt) {
      throw new OAuthTokenError("invalid_grant", "Authorization code has already been used.");
    }
    if (code.expiresAt.getTime() <= now.getTime()) {
      throw new OAuthTokenError("invalid_grant", "Authorization code is expired.");
    }
    verifyPkceCodeVerifier(code, input.codeVerifier);
    if (!code.oauthUser.enabled) {
      throw new OAuthTokenError("invalid_grant", "OAuth user is disabled.");
    }

    const endpointPermissions = code.selectedEndpoints.map((endpoint) => endpoint.endpointId).sort();
    const resourcePermissions = code.selectedResources.map((resource) => resource.resourceId).sort();
    const promptPermissions = code.selectedPrompts.map((prompt) => prompt.promptId).sort();
    const iat = Math.floor(now.getTime() / 1000);
    const expiresIn = code.oauthUser.accessTokenTtlSeconds;
    const exp = iat + expiresIn;
    const jti = `oauth_token_${randomUUID()}`;
    const scope = permissionScope({
      endpointIds: endpointPermissions,
      resourceIds: resourcePermissions,
      promptIds: promptPermissions,
    });
    const issuer = oauthIssuer(input.issuer);
    const claims: OAuthAccessTokenClaims = {
      iss: issuer,
      aud: code.resource,
      resource: code.resource,
      sub: code.oauthUser.id,
      client_id: code.oauthClient.clientId,
      grant_type: "authorization_code",
      iat,
      exp,
      jti,
      scope,
      endpoint_permissions: endpointPermissions,
      resource_permissions: resourcePermissions,
      prompt_permissions: promptPermissions,
    };

    await tx.oAuthAuthorizationCode.update({
      where: { id: code.id },
      data: { usedAt: now },
    });
    await tx.oAuthIssuedToken.create({
      data: {
        id: `oauth_issued_token_${randomUUID()}`,
        jti,
        oauthClientId: code.oauthClientId,
        oauthUserId: code.oauthUserId,
        grantType: "authorization_code",
        scope,
        issuer,
        resource: code.resource,
        endpointPermissionsJson: JSON.stringify(endpointPermissions),
        resourcePermissionsJson: JSON.stringify(resourcePermissions),
        promptPermissionsJson: JSON.stringify(promptPermissions),
        issuedAt: new Date(iat * 1000),
        expiresAt: new Date(exp * 1000),
      },
    });
    await recordAuditEvent(
      {
        eventType: "oauth_token.issue",
        subjectType: "oauth_issued_token",
        subjectId: jti,
        subjectName: code.oauthClient.clientId,
        outcome: "success",
        metadata: {
          grantType: "authorization_code",
          oauthClientId: code.oauthClientId,
          oauthUserId: code.oauthUserId,
          resource: code.resource,
          endpointPermissionCount: endpointPermissions.length,
          resourcePermissionCount: resourcePermissions.length,
          promptPermissionCount: promptPermissions.length,
          expiresAt: new Date(exp * 1000).toISOString(),
        },
      },
      tx,
    );

    return {
      accessToken: signJwt({ alg: OAUTH_JWT_ALGORITHM, typ: "JWT", kid: OAUTH_JWT_KEY_ID }, claims),
      expiresIn,
      scope,
    };
  });

  return {
    access_token: result.accessToken,
    token_type: "Bearer",
    expires_in: result.expiresIn,
    scope: result.scope,
  };
}

export async function issueOAuthClientCredentialsToken(
  input: OAuthTokenExchangeInput,
  client: OAuthTokenExchangeClient = createPrismaClient(),
): Promise<OAuthTokenExchangeResult> {
  if (input.grantType !== "client_credentials") {
    throw new OAuthTokenError("unsupported_grant_type", "Only grant_type=client_credentials is supported.");
  }
  if (!input.clientId || !input.clientSecret) {
    throw new OAuthTokenError("invalid_request", "client_id and client_secret are required.");
  }

  const now = input.now ?? new Date();
  const result = await client.$transaction(async (tx) => {
    const oauthClient = await tx.oAuthClient.findUnique({
      where: { clientId: input.clientId },
      include: { allowedEndpoints: true, allowedResources: true, allowedPrompts: true },
    });
    if (!oauthClient?.enabled) {
      throw new OAuthTokenError("invalid_client", "OAuth client is invalid.");
    }
    if (!(await verifyBasicPassword(input.clientSecret, oauthClient.secretHash))) {
      throw new OAuthTokenError("invalid_client", "OAuth client is invalid.");
    }

    const permissions = permissionsFromRequestedScope(input.scope ?? "", {
      endpointIds: oauthClient.allowedEndpoints.map((endpoint) => endpoint.endpointId),
      resourceIds: oauthClient.allowedResources.map((resource) => resource.resourceId),
      promptIds: oauthClient.allowedPrompts.map((prompt) => prompt.promptId),
    });
    const endpointPermissions = permissions.endpointIds;
    const resourcePermissions = permissions.resourceIds;
    const promptPermissions = permissions.promptIds;
    const iat = Math.floor(now.getTime() / 1000);
    const expiresIn = oauthClient.clientCredentialsTtlSeconds;
    const exp = iat + expiresIn;
    const jti = `oauth_token_${randomUUID()}`;
    const scope = permissionScope(permissions);
    const issuer = oauthIssuer(input.issuer);
    const resource = input.resource || issuer;
    const claims: OAuthAccessTokenClaims = {
      iss: issuer,
      aud: resource,
      resource,
      sub: `client:${oauthClient.clientId}`,
      client_id: oauthClient.clientId,
      grant_type: "client_credentials",
      iat,
      exp,
      jti,
      scope,
      endpoint_permissions: endpointPermissions,
      resource_permissions: resourcePermissions,
      prompt_permissions: promptPermissions,
    };

    await tx.oAuthIssuedToken.create({
      data: {
        id: `oauth_issued_token_${randomUUID()}`,
        jti,
        oauthClientId: oauthClient.id,
        oauthUserId: null,
        grantType: "client_credentials",
        scope,
        issuer,
        resource,
        endpointPermissionsJson: JSON.stringify(endpointPermissions),
        resourcePermissionsJson: JSON.stringify(resourcePermissions),
        promptPermissionsJson: JSON.stringify(promptPermissions),
        issuedAt: new Date(iat * 1000),
        expiresAt: new Date(exp * 1000),
      },
    });
    await recordAuditEvent(
      {
        eventType: "oauth_token.issue",
        subjectType: "oauth_issued_token",
        subjectId: jti,
        subjectName: oauthClient.clientId,
        outcome: "success",
        metadata: {
          grantType: "client_credentials",
          oauthClientId: oauthClient.id,
          oauthUserId: null,
          resource,
          endpointPermissionCount: endpointPermissions.length,
          resourcePermissionCount: resourcePermissions.length,
          promptPermissionCount: promptPermissions.length,
          expiresAt: new Date(exp * 1000).toISOString(),
        },
      },
      tx,
    );

    return {
      accessToken: signJwt({ alg: OAUTH_JWT_ALGORITHM, typ: "JWT", kid: OAUTH_JWT_KEY_ID }, claims),
      expiresIn,
      scope,
    };
  });

  return {
    access_token: result.accessToken,
    token_type: "Bearer",
    expires_in: result.expiresIn,
    scope: result.scope,
  };
}

export async function exchangeOAuthToken(
  input: OAuthTokenExchangeInput,
  client: OAuthTokenExchangeClient = createPrismaClient(),
): Promise<OAuthTokenExchangeResult> {
  if (input.grantType === "authorization_code") {
    return exchangeOAuthAuthorizationCode(input, client);
  }
  if (input.grantType === "client_credentials") {
    return issueOAuthClientCredentialsToken(input, client);
  }
  throw new OAuthTokenError(
    "unsupported_grant_type",
    "Only grant_type=authorization_code and grant_type=client_credentials are supported.",
  );
}
