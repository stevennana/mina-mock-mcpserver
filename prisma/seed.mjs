import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

export const DEFAULT_ENDPOINT_ID = "endpoint_default_echo";
export const DEFAULT_BASIC_USER_ID = "basic_user_default";
export const DEFAULT_BASIC_USERNAME = "default";
export const DEFAULT_BASIC_PASSWORD = "default";
export const DEFAULT_OAUTH_USER_ID = "oauth_user_default";
export const DEFAULT_OAUTH_USERNAME = "default";
export const DEFAULT_OAUTH_PASSWORD = "default";
export const DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const DEFAULT_OAUTH_CLIENT_ID = "oauth_client_default";
export const DEFAULT_OAUTH_CLIENT_IDENTIFIER = "default";
export const DEFAULT_OAUTH_CLIENT_SECRET = "default";
export const DEFAULT_OAUTH_CLIENT_DISPLAY_NAME = "Default OAuth client";
export const DEFAULT_OAUTH_CLIENT_REDIRECT_URI = "http://localhost:3000/oauth/callback";
export const DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS = 3600;

const scrypt = promisify(scryptCallback);

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/runtime.sqlite";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function hashBasicPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function seedEndpointDefaults(client = prisma) {
  await client.endpoint.upsert({
    where: { id: DEFAULT_ENDPOINT_ID },
    update: {
      name: "echo",
      title: "Echo",
      description: "Default enabled endpoint for smoke-testing endpoint persistence.",
      enabled: true,
      protectedDefault: true,
      deleteCode: "12345678",
      defaultResponseJson: JSON.stringify({ ok: true, source: "default" }),
      failureMode: "none",
      failureStatusCode: null,
      failureDelayMs: 0,
      failureMessage: null,
      malformedResponseJson: null,
    },
    create: {
      id: DEFAULT_ENDPOINT_ID,
      name: "echo",
      title: "Echo",
      description: "Default enabled endpoint for smoke-testing endpoint persistence.",
      enabled: true,
      protectedDefault: true,
      deleteCode: "12345678",
      defaultResponseJson: JSON.stringify({ ok: true, source: "default" }),
      parameters: {
        create: [
          {
            id: `${DEFAULT_ENDPOINT_ID}_param_message`,
            position: 0,
            name: "message",
            label: "Message",
            description: "Message to echo back in later runtime slices.",
            type: "string",
            required: true,
          },
        ],
      },
      responseCases: {
        create: [
          {
            id: `${DEFAULT_ENDPOINT_ID}_case_default`,
            name: "default",
            priority: 0,
            matchArgsJson: "{}",
            responseJson: JSON.stringify({ ok: true, source: "default" }),
            statusCode: 200,
            delayMs: 0,
            errorMode: "none",
            isDefault: true,
          },
          {
            id: `${DEFAULT_ENDPOINT_ID}_case_hello`,
            name: "hello-world",
            priority: 10,
            matchArgsJson: JSON.stringify({ message: "hello" }),
            responseJson: JSON.stringify({ ok: true, message: "world" }),
            statusCode: 200,
            delayMs: 0,
            errorMode: "none",
            isDefault: false,
          },
        ],
      },
    },
  });

  await client.endpointParam.upsert({
    where: {
      endpointId_name: {
        endpointId: DEFAULT_ENDPOINT_ID,
        name: "message",
      },
    },
    update: {
      position: 0,
      label: "Message",
      description: "Message to echo back in later runtime slices.",
      type: "string",
      required: true,
      defaultValueJson: null,
    },
    create: {
      id: `${DEFAULT_ENDPOINT_ID}_param_message`,
      endpointId: DEFAULT_ENDPOINT_ID,
      position: 0,
      name: "message",
      label: "Message",
      description: "Message to echo back in later runtime slices.",
      type: "string",
      required: true,
    },
  });

  await client.responseCase.upsert({
    where: {
      endpointId_name: {
        endpointId: DEFAULT_ENDPOINT_ID,
        name: "default",
      },
    },
    update: {
      priority: 0,
      matchArgsJson: "{}",
      responseJson: JSON.stringify({ ok: true, source: "default" }),
      statusCode: 200,
      delayMs: 0,
      errorMode: "none",
      errorStatusCode: null,
      errorMessage: null,
      errorBodyJson: null,
      isDefault: true,
    },
    create: {
      id: `${DEFAULT_ENDPOINT_ID}_case_default`,
      endpointId: DEFAULT_ENDPOINT_ID,
      name: "default",
      priority: 0,
      matchArgsJson: "{}",
      responseJson: JSON.stringify({ ok: true, source: "default" }),
      statusCode: 200,
      delayMs: 0,
      errorMode: "none",
      isDefault: true,
    },
  });

  await client.responseCase.upsert({
    where: {
      endpointId_name: {
        endpointId: DEFAULT_ENDPOINT_ID,
        name: "hello-world",
      },
    },
    update: {
      priority: 10,
      matchArgsJson: JSON.stringify({ message: "hello" }),
      responseJson: JSON.stringify({ ok: true, message: "world" }),
      statusCode: 200,
      delayMs: 0,
      errorMode: "none",
      errorStatusCode: null,
      errorMessage: null,
      errorBodyJson: null,
      isDefault: false,
    },
    create: {
      id: `${DEFAULT_ENDPOINT_ID}_case_hello`,
      endpointId: DEFAULT_ENDPOINT_ID,
      name: "hello-world",
      priority: 10,
      matchArgsJson: JSON.stringify({ message: "hello" }),
      responseJson: JSON.stringify({ ok: true, message: "world" }),
      statusCode: 200,
      delayMs: 0,
      errorMode: "none",
      isDefault: false,
    },
  });
}

export async function seedBasicUserDefaults(client = prisma) {
  const passwordHash = await hashBasicPassword(DEFAULT_BASIC_PASSWORD);
  await client.basicUser.upsert({
    where: { id: DEFAULT_BASIC_USER_ID },
    update: {
      username: DEFAULT_BASIC_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
    },
    create: {
      id: DEFAULT_BASIC_USER_ID,
      username: DEFAULT_BASIC_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
    },
  });
}

export async function seedOAuthUserDefaults(client = prisma) {
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

export async function seedOAuthClientDefaults(client = prisma) {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedEndpointDefaults();
  await seedBasicUserDefaults();
  await seedOAuthUserDefaults();
  await seedOAuthClientDefaults();
  await prisma.$disconnect();
}
