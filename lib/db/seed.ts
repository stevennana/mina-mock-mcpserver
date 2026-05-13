import type { PrismaClient } from "@prisma/client";
import { seedBasicUserDefaults } from "@/lib/basic-auth/service";
import {
  DEFAULT_MCP_PROMPT_RELEASE_ID,
  DEFAULT_MCP_PROMPT_SUPPORT_ID,
  DEFAULT_MCP_RESOURCE_ID,
  DEFAULT_MCP_RESOURCE_TEMPLATE_ID,
} from "@/lib/mcp-fixtures/service";
import { seedOAuthClientDefaults, seedOAuthUserDefaults } from "@/lib/oauth/service";

export const DEFAULT_ENDPOINT_ID = "endpoint_default_echo";

type SeedClient = Pick<
  PrismaClient,
  | "endpoint"
  | "endpointParam"
  | "responseCase"
  | "basicUser"
  | "oAuthUser"
  | "oAuthClient"
  | "oAuthClientAllowedEndpoint"
  | "oAuthAuthorizationCode"
  | "oAuthAuthorizationCodeEndpoint"
  | "oAuthIssuedToken"
  | "mcpResource"
  | "mcpResourceTemplate"
  | "mcpResourceTemplateArgument"
  | "mcpPrompt"
  | "mcpPromptArgument"
  | "mcpPromptMessage"
  | "mcpCompletionCandidate"
>;

export async function seedEndpointDefaults(client: SeedClient) {
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

export async function seedMcpFixtureDefaults(client: SeedClient) {
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

  await client.mcpPrompt.upsert({
    where: { id: DEFAULT_MCP_PROMPT_SUPPORT_ID },
    update: {
      name: "support_reply",
      title: "Support reply",
      description: "Draft a concise support response for a mock ticket.",
      enabled: true,
      protectedDefault: true,
    },
    create: {
      id: DEFAULT_MCP_PROMPT_SUPPORT_ID,
      name: "support_reply",
      title: "Support reply",
      description: "Draft a concise support response for a mock ticket.",
      enabled: true,
      protectedDefault: true,
    },
  });
  await client.mcpPromptArgument.upsert({
    where: { promptId_name: { promptId: DEFAULT_MCP_PROMPT_SUPPORT_ID, name: "tone" } },
    update: { position: 0, title: "Tone", description: "Response tone.", required: true },
    create: {
      id: `${DEFAULT_MCP_PROMPT_SUPPORT_ID}_argument_tone`,
      promptId: DEFAULT_MCP_PROMPT_SUPPORT_ID,
      position: 0,
      name: "tone",
      title: "Tone",
      description: "Response tone.",
      required: true,
    },
  });
  await client.mcpPromptMessage.upsert({
    where: { promptId_position: { promptId: DEFAULT_MCP_PROMPT_SUPPORT_ID, position: 0 } },
    update: {
      role: "user",
      textTemplate: "Write a {tone} support reply for the provided mock ticket.",
      resourceUri: "mock://resources/server-status",
      resourceMimeType: "application/json",
    },
    create: {
      id: `${DEFAULT_MCP_PROMPT_SUPPORT_ID}_message_0`,
      promptId: DEFAULT_MCP_PROMPT_SUPPORT_ID,
      position: 0,
      role: "user",
      textTemplate: "Write a {tone} support reply for the provided mock ticket.",
      resourceUri: "mock://resources/server-status",
      resourceMimeType: "application/json",
    },
  });
  await client.mcpCompletionCandidate.upsert({
    where: {
      promptId_argumentName_value: {
        promptId: DEFAULT_MCP_PROMPT_SUPPORT_ID,
        argumentName: "tone",
        value: "friendly",
      },
    },
    update: { ownerType: "prompt", resourceTemplateId: null, label: "Friendly", position: 0 },
    create: {
      id: `${DEFAULT_MCP_PROMPT_SUPPORT_ID}_candidate_tone_friendly`,
      ownerType: "prompt",
      promptId: DEFAULT_MCP_PROMPT_SUPPORT_ID,
      argumentName: "tone",
      value: "friendly",
      label: "Friendly",
      position: 0,
    },
  });

  await client.mcpPrompt.upsert({
    where: { id: DEFAULT_MCP_PROMPT_RELEASE_ID },
    update: {
      name: "release_notes",
      title: "Release notes",
      description: "Summarize mock release notes for a client integration update.",
      enabled: true,
      protectedDefault: true,
    },
    create: {
      id: DEFAULT_MCP_PROMPT_RELEASE_ID,
      name: "release_notes",
      title: "Release notes",
      description: "Summarize mock release notes for a client integration update.",
      enabled: true,
      protectedDefault: true,
    },
  });
  await client.mcpPromptArgument.upsert({
    where: { promptId_name: { promptId: DEFAULT_MCP_PROMPT_RELEASE_ID, name: "version" } },
    update: { position: 0, title: "Version", description: "Release version.", required: true },
    create: {
      id: `${DEFAULT_MCP_PROMPT_RELEASE_ID}_argument_version`,
      promptId: DEFAULT_MCP_PROMPT_RELEASE_ID,
      position: 0,
      name: "version",
      title: "Version",
      description: "Release version.",
      required: true,
    },
  });
  await client.mcpPromptMessage.upsert({
    where: { promptId_position: { promptId: DEFAULT_MCP_PROMPT_RELEASE_ID, position: 0 } },
    update: {
      role: "user",
      textTemplate: "Summarize the mock MCP server changes for version {version}.",
      resourceUri: null,
      resourceMimeType: null,
    },
    create: {
      id: `${DEFAULT_MCP_PROMPT_RELEASE_ID}_message_0`,
      promptId: DEFAULT_MCP_PROMPT_RELEASE_ID,
      position: 0,
      role: "user",
      textTemplate: "Summarize the mock MCP server changes for version {version}.",
    },
  });
  await client.mcpCompletionCandidate.upsert({
    where: {
      promptId_argumentName_value: {
        promptId: DEFAULT_MCP_PROMPT_RELEASE_ID,
        argumentName: "version",
        value: "v1",
      },
    },
    update: { ownerType: "prompt", resourceTemplateId: null, label: "Version 1", position: 0 },
    create: {
      id: `${DEFAULT_MCP_PROMPT_RELEASE_ID}_candidate_version_v1`,
      ownerType: "prompt",
      promptId: DEFAULT_MCP_PROMPT_RELEASE_ID,
      argumentName: "version",
      value: "v1",
      label: "Version 1",
      position: 0,
    },
  });
}

export async function seedAllDefaults(client: SeedClient) {
  await seedEndpointDefaults(client);
  await seedMcpFixtureDefaults(client);
  await seedBasicUserDefaults(client);
  await seedOAuthUserDefaults(client);
  await seedOAuthClientDefaults(client);
}
