import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

export const DEFAULT_ENDPOINT_ID = "endpoint_default_echo";
export const DEFAULT_MCP_RESOURCE_ID = "mcp_resource_default_status";
export const DEFAULT_MCP_RESOURCE_TEMPLATE_ID = "mcp_resource_template_default_customer";
export const DEFAULT_MCP_PROMPT_SUPPORT_ID = "mcp_prompt_default_support_reply";
export const DEFAULT_MCP_PROMPT_RELEASE_ID = "mcp_prompt_default_release_notes";
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

export async function seedMcpFixtureDefaults(client = prisma) {
  await client.mcpResource.upsert({
    where: { id: DEFAULT_MCP_RESOURCE_ID },
    update: {
      uri: "mock://resources/server-status",
      name: "server_status",
      title: "Server status",
      description: "Default text resource for MCP resource smoke tests.",
      mimeType: "application/json",
      enabled: true,
      protectedDefault: true,
      textContent: JSON.stringify({ status: "ok", source: "seed" }, null, 2),
      blobContentBase64: null,
      annotationsJson: JSON.stringify({ audience: ["assistant"], priority: 0.5 }),
    },
    create: {
      id: DEFAULT_MCP_RESOURCE_ID,
      uri: "mock://resources/server-status",
      name: "server_status",
      title: "Server status",
      description: "Default text resource for MCP resource smoke tests.",
      mimeType: "application/json",
      enabled: true,
      protectedDefault: true,
      textContent: JSON.stringify({ status: "ok", source: "seed" }, null, 2),
      annotationsJson: JSON.stringify({ audience: ["assistant"], priority: 0.5 }),
    },
  });

  await client.mcpResourceTemplate.upsert({
    where: { id: DEFAULT_MCP_RESOURCE_TEMPLATE_ID },
    update: {
      uriTemplate: "mock://resources/customers/{customerId}",
      name: "customer_profile",
      title: "Customer profile",
      description: "Default rendered text resource template for MCP smoke tests.",
      mimeType: "application/json",
      enabled: true,
      protectedDefault: true,
      textTemplate: "{\"customerId\":\"{customerId}\",\"tier\":\"demo\"}",
      blobTemplateBase64: null,
      annotationsJson: JSON.stringify({ audience: ["assistant"] }),
    },
    create: {
      id: DEFAULT_MCP_RESOURCE_TEMPLATE_ID,
      uriTemplate: "mock://resources/customers/{customerId}",
      name: "customer_profile",
      title: "Customer profile",
      description: "Default rendered text resource template for MCP smoke tests.",
      mimeType: "application/json",
      enabled: true,
      protectedDefault: true,
      textTemplate: "{\"customerId\":\"{customerId}\",\"tier\":\"demo\"}",
      annotationsJson: JSON.stringify({ audience: ["assistant"] }),
    },
  });
  await client.mcpResourceTemplateArgument.upsert({
    where: { resourceTemplateId_name: { resourceTemplateId: DEFAULT_MCP_RESOURCE_TEMPLATE_ID, name: "customerId" } },
    update: { position: 0, description: "Mock customer identifier.", required: true, sampleValueJson: "\"cust_123\"" },
    create: {
      id: `${DEFAULT_MCP_RESOURCE_TEMPLATE_ID}_argument_customerId`,
      resourceTemplateId: DEFAULT_MCP_RESOURCE_TEMPLATE_ID,
      position: 0,
      name: "customerId",
      description: "Mock customer identifier.",
      required: true,
      sampleValueJson: "\"cust_123\"",
    },
  });
  await client.mcpCompletionCandidate.upsert({
    where: {
      resourceTemplateId_argumentName_value: {
        resourceTemplateId: DEFAULT_MCP_RESOURCE_TEMPLATE_ID,
        argumentName: "customerId",
        value: "cust_123",
      },
    },
    update: { ownerType: "resource_template", promptId: null, label: "Default customer", position: 0 },
    create: {
      id: `${DEFAULT_MCP_RESOURCE_TEMPLATE_ID}_candidate_customerId_cust_123`,
      ownerType: "resource_template",
      resourceTemplateId: DEFAULT_MCP_RESOURCE_TEMPLATE_ID,
      argumentName: "customerId",
      value: "cust_123",
      label: "Default customer",
      position: 0,
    },
  });

  const promptDefaults = [
    {
      id: DEFAULT_MCP_PROMPT_SUPPORT_ID,
      name: "support_reply",
      title: "Support reply",
      description: "Draft a concise support response for a mock ticket.",
      argumentName: "tone",
      argumentTitle: "Tone",
      argumentDescription: "Response tone.",
      message: "Write a {tone} support reply for the provided mock ticket.",
      resourceUri: "mock://resources/server-status",
      resourceMimeType: "application/json",
      candidateValue: "friendly",
      candidateLabel: "Friendly",
    },
    {
      id: DEFAULT_MCP_PROMPT_RELEASE_ID,
      name: "release_notes",
      title: "Release notes",
      description: "Summarize mock release notes for a client integration update.",
      argumentName: "version",
      argumentTitle: "Version",
      argumentDescription: "Release version.",
      message: "Summarize the mock MCP server changes for version {version}.",
      resourceUri: null,
      resourceMimeType: null,
      candidateValue: "v1",
      candidateLabel: "Version 1",
    },
  ];

  for (const prompt of promptDefaults) {
    await client.mcpPrompt.upsert({
      where: { id: prompt.id },
      update: {
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        enabled: true,
        protectedDefault: true,
      },
      create: {
        id: prompt.id,
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        enabled: true,
        protectedDefault: true,
      },
    });
    await client.mcpPromptArgument.upsert({
      where: { promptId_name: { promptId: prompt.id, name: prompt.argumentName } },
      update: { position: 0, title: prompt.argumentTitle, description: prompt.argumentDescription, required: true },
      create: {
        id: `${prompt.id}_argument_${prompt.argumentName}`,
        promptId: prompt.id,
        position: 0,
        name: prompt.argumentName,
        title: prompt.argumentTitle,
        description: prompt.argumentDescription,
        required: true,
      },
    });
    await client.mcpPromptMessage.upsert({
      where: { promptId_position: { promptId: prompt.id, position: 0 } },
      update: {
        role: "user",
        textTemplate: prompt.message,
        resourceUri: prompt.resourceUri,
        resourceMimeType: prompt.resourceMimeType,
      },
      create: {
        id: `${prompt.id}_message_0`,
        promptId: prompt.id,
        position: 0,
        role: "user",
        textTemplate: prompt.message,
        resourceUri: prompt.resourceUri,
        resourceMimeType: prompt.resourceMimeType,
      },
    });
    await client.mcpCompletionCandidate.upsert({
      where: {
        promptId_argumentName_value: {
          promptId: prompt.id,
          argumentName: prompt.argumentName,
          value: prompt.candidateValue,
        },
      },
      update: { ownerType: "prompt", resourceTemplateId: null, label: prompt.candidateLabel, position: 0 },
      create: {
        id: `${prompt.id}_candidate_${prompt.argumentName}_${prompt.candidateValue}`,
        ownerType: "prompt",
        promptId: prompt.id,
        argumentName: prompt.argumentName,
        value: prompt.candidateValue,
        label: prompt.candidateLabel,
        position: 0,
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedEndpointDefaults();
  await seedMcpFixtureDefaults();
  await seedBasicUserDefaults();
  await seedOAuthUserDefaults();
  await seedOAuthClientDefaults();
  await prisma.$disconnect();
}
