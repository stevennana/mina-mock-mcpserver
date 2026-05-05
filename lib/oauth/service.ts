import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
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
  OAUTH_AUTHORIZATION_CODE_TTL_SECONDS,
  OAuthClientBuiltInError,
  OAuthClientNotFoundError,
  OAuthClientValidationError,
  OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS,
  OAuthAuthorizeRequestError,
  OAuthLoginError,
  OAUTH_LOGIN_TICKET_TTL_SECONDS,
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
  OAuthAuthorizationCodeSummary,
  OAuthAuthorizeContext,
  OAuthAuthorizeRequest,
  OAuthConsentContext,
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
type OAuthAuthorizationCodeRecord = Prisma.OAuthAuthorizationCodeGetPayload<{
  include: { selectedEndpoints: true };
}>;
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

function toAuthorizationCodeSummary(code: OAuthAuthorizationCodeRecord): OAuthAuthorizationCodeSummary {
  return {
    id: code.id,
    code: code.code,
    oauthClientId: code.oauthClientId,
    oauthUserId: code.oauthUserId,
    redirectUri: code.redirectUri,
    resource: code.resource,
    state: code.state,
    selectedEndpointIds: code.selectedEndpoints.map((endpoint) => endpoint.endpointId),
    expiresAt: code.expiresAt.toISOString(),
    usedAt: code.usedAt?.toISOString() ?? null,
    createdAt: code.createdAt.toISOString(),
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
}, client: PrismaClient = createPrismaClient()): Promise<OAuthAuthorizationCodeSummary> {
  const context = await validateOAuthConsentRequest(
    { authorizeRequest: input.authorizeRequest, loginTicket: input.loginTicket },
    client,
  );
  const selectedEndpointIds = Array.from(new Set(input.selectedEndpointIds.map((id) => id.trim()).filter(Boolean)));
  if (selectedEndpointIds.length === 0) {
    throw new OAuthLoginError("invalid_selection", "Select at least one endpoint permission.");
  }
  const allowedEndpointIds = new Set(context.client.allowedEndpointIds);
  if (selectedEndpointIds.some((endpointId) => !allowedEndpointIds.has(endpointId))) {
    throw new OAuthLoginError("invalid_selection", "Endpoint selection is outside this client's allowed set.");
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
        expiresAt: new Date(Date.now() + OAUTH_AUTHORIZATION_CODE_TTL_SECONDS * 1000),
      },
    });
    await tx.oAuthAuthorizationCodeEndpoint.createMany({
      data: selectedEndpointIds.map((endpointId) => ({ authorizationCodeId: created.id, endpointId })),
    });
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
          selectedEndpointCount: selectedEndpointIds.length,
          expiresAt: created.expiresAt.toISOString(),
        },
      },
      tx,
    );
    return tx.oAuthAuthorizationCode.findUniqueOrThrow({
      where: { id: created.id },
      include: { selectedEndpoints: true },
    });
  });

  return toAuthorizationCodeSummary(code);
}
