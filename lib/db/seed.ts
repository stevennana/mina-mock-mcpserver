import type { PrismaClient } from "@prisma/client";
import { seedBasicUserDefaults } from "@/lib/basic-auth/service";
import { seedOAuthClientDefaults, seedOAuthUserDefaults } from "@/lib/oauth/service";

export const DEFAULT_ENDPOINT_ID = "endpoint_default_echo";

type SeedClient = Pick<
  PrismaClient,
  "endpoint" | "endpointParam" | "responseCase" | "basicUser" | "oAuthUser" | "oAuthClient" | "oAuthClientAllowedEndpoint"
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

export async function seedAllDefaults(client: SeedClient) {
  await seedEndpointDefaults(client);
  await seedBasicUserDefaults(client);
  await seedOAuthUserDefaults(client);
  await seedOAuthClientDefaults(client);
}
