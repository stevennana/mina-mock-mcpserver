import { randomBytes, randomUUID } from "node:crypto";
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
  DEFAULT_OAUTH_PASSWORD,
  DEFAULT_OAUTH_USER_ID,
  DEFAULT_OAUTH_USERNAME,
  OAuthClientBuiltInError,
  OAuthClientNotFoundError,
  OAuthClientValidationError,
  OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS,
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
  OAuthClientListResult,
  OAuthClientSecretResult,
  OAuthClientSummary,
  OAuthClientUpdateInput,
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
} satisfies Prisma.OAuthClientInclude;

type OAuthUserRecord = Prisma.OAuthUserGetPayload<object>;
type OAuthClientRecord = Prisma.OAuthClientGetPayload<{ include: typeof oauthClientInclude }>;
type OAuthUserSeedClient = Pick<PrismaClient, "oAuthUser">;
type OAuthClientSeedClient = Pick<PrismaClient, "oAuthClient" | "oAuthClientAllowedEndpoint" | "endpoint">;
type OAuthClientEndpointLookupClient = Pick<PrismaClient, "endpoint">;
type OAuthClientAllowedEndpointWriteClient = Pick<PrismaClient, "oAuthClientAllowedEndpoint">;

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

function parseRedirectUris(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toClientSummary(client: OAuthClientRecord): OAuthClientSummary {
  const allowedEndpoints = client.allowedEndpoints.map((allowedEndpoint) => endpointToOption(allowedEndpoint.endpoint));
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
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

async function assertAllowedEndpointsExist(endpointIds: string[], client: OAuthClientEndpointLookupClient) {
  if (endpointIds.length === 0) {
    return;
  }
  const count = await client.endpoint.count({ where: { id: { in: endpointIds } } });
  if (count !== endpointIds.length) {
    throw new OAuthClientValidationError({ allowedEndpointIds: "Choose only existing endpoints." });
  }
}

async function replaceAllowedEndpoints(
  oauthClientId: string,
  endpointIds: string[],
  client: OAuthClientAllowedEndpointWriteClient,
) {
  await client.oAuthClientAllowedEndpoint.deleteMany({ where: { oauthClientId } });
  if (endpointIds.length > 0) {
    await client.oAuthClientAllowedEndpoint.createMany({
      data: endpointIds.map((endpointId) => ({ oauthClientId, endpointId })),
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

  const defaultEndpoints = await client.endpoint.findMany({ where: { enabled: true }, select: { id: true } });
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
  const [clients, endpoints] = await Promise.all([
    client.oAuthClient.findMany({
      include: oauthClientInclude,
      orderBy: [{ builtIn: "desc" }, { clientId: "asc" }],
    }),
    client.endpoint.findMany({
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
    ttlPresets: OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS,
  };
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
  await assertAllowedEndpointsExist(validInput.allowedEndpointIds, client);
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
    await replaceAllowedEndpoints(created.id, validInput.allowedEndpointIds, tx);
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
  if (validInput.allowedEndpointIds) {
    await assertAllowedEndpointsExist(validInput.allowedEndpointIds, client);
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
    if (validInput.allowedEndpointIds) {
      await replaceAllowedEndpoints(id, validInput.allowedEndpointIds, tx);
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
