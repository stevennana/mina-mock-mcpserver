import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

export const DEFAULT_ENDPOINT_ID = "endpoint_default_echo";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/runtime.sqlite";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

export async function seedEndpointDefaults(client = prisma) {
  await client.endpoint.upsert({
    where: { id: DEFAULT_ENDPOINT_ID },
    update: {
      name: "echo",
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
            matchArgsJson: "{}",
            responseJson: JSON.stringify({ ok: true, source: "default" }),
            statusCode: 200,
            isDefault: true,
          },
          {
            id: `${DEFAULT_ENDPOINT_ID}_case_hello`,
            name: "hello-world",
            matchArgsJson: JSON.stringify({ message: "hello" }),
            responseJson: JSON.stringify({ ok: true, message: "world" }),
            statusCode: 200,
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
      matchArgsJson: "{}",
      responseJson: JSON.stringify({ ok: true, source: "default" }),
      statusCode: 200,
      isDefault: true,
    },
    create: {
      id: `${DEFAULT_ENDPOINT_ID}_case_default`,
      endpointId: DEFAULT_ENDPOINT_ID,
      name: "default",
      matchArgsJson: "{}",
      responseJson: JSON.stringify({ ok: true, source: "default" }),
      statusCode: 200,
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
      matchArgsJson: JSON.stringify({ message: "hello" }),
      responseJson: JSON.stringify({ ok: true, message: "world" }),
      statusCode: 200,
      isDefault: false,
    },
    create: {
      id: `${DEFAULT_ENDPOINT_ID}_case_hello`,
      endpointId: DEFAULT_ENDPOINT_ID,
      name: "hello-world",
      matchArgsJson: JSON.stringify({ message: "hello" }),
      responseJson: JSON.stringify({ ok: true, message: "world" }),
      statusCode: 200,
      isDefault: false,
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedEndpointDefaults();
  await prisma.$disconnect();
}
