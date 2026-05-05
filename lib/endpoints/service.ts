import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { createPrismaClient } from "@/lib/db/client";
import { generateMcpInputSchema } from "@/lib/endpoints/schema";
import { EndpointDeleteAuthorizationError, EndpointNotFoundError } from "@/lib/endpoints/types";
import { validateEndpointInput } from "@/lib/endpoints/validation";
import { verifyRootPassword } from "@/lib/security/root-password";
import type {
  EndpointDeleteInput,
  EndpointDetail,
  EndpointInput,
  EndpointListResult,
  EndpointSummary,
} from "@/lib/endpoints/types";

const endpointInclude = {
  parameters: { orderBy: { position: "asc" } },
  responseCases: { orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { name: "asc" }] },
} satisfies Prisma.EndpointInclude;

type EndpointRecord = Prisma.EndpointGetPayload<{ include: typeof endpointInclude }>;

function toSummary(endpoint: EndpointRecord): EndpointSummary {
  return {
    id: endpoint.id,
    name: endpoint.name,
    title: endpoint.title,
    description: endpoint.description,
    enabled: endpoint.enabled,
    protectedDefault: endpoint.protectedDefault,
    parameterCount: endpoint.parameters.length,
    responseCaseCount: endpoint.responseCases.length,
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

function toDetail(endpoint: EndpointRecord): EndpointDetail {
  const parameters = endpoint.parameters.map((parameter) => ({
    id: parameter.id,
    position: parameter.position,
    name: parameter.name,
    label: parameter.label ?? "",
    description: parameter.description,
    type: parameter.type as EndpointDetail["parameters"][number]["type"],
    required: parameter.required,
    defaultValueJson: parameter.defaultValueJson,
  }));

  return {
    ...toSummary(endpoint),
    deleteCode: endpoint.deleteCode,
    defaultResponseJson: endpoint.defaultResponseJson,
    inputSchema: generateMcpInputSchema({ parameters }),
    failureMode: endpoint.failureMode as EndpointDetail["failureMode"],
    failureStatusCode: endpoint.failureStatusCode,
    failureDelayMs: endpoint.failureDelayMs,
    failureMessage: endpoint.failureMessage,
    malformedResponseJson: endpoint.malformedResponseJson,
    parameters,
    responseCases: endpoint.responseCases.map((responseCase) => ({
      id: responseCase.id,
      name: responseCase.name,
      priority: responseCase.priority,
      matchArgsJson: responseCase.matchArgsJson,
      responseJson: responseCase.responseJson,
      statusCode: responseCase.statusCode,
      delayMs: responseCase.delayMs,
      errorMode: responseCase.errorMode as EndpointDetail["responseCases"][number]["errorMode"],
      errorStatusCode: responseCase.errorStatusCode,
      errorMessage: responseCase.errorMessage,
      errorBodyJson: responseCase.errorBodyJson,
      isDefault: responseCase.isDefault,
    })),
  };
}

export async function listEndpoints(client: PrismaClient = createPrismaClient()): Promise<EndpointListResult> {
  const endpoints = await client.endpoint.findMany({
    include: endpointInclude,
    orderBy: [{ protectedDefault: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
  });

  const summaries = endpoints.map(toSummary);
  return {
    total: summaries.length,
    enabled: summaries.filter((endpoint) => endpoint.enabled).length,
    disabled: summaries.filter((endpoint) => !endpoint.enabled).length,
    endpoints: summaries,
  };
}

export async function getEndpoint(id: string, client: PrismaClient = createPrismaClient()) {
  const endpoint = await client.endpoint.findUnique({ where: { id }, include: endpointInclude });
  return endpoint ? toDetail(endpoint) : null;
}

export async function createEndpoint(input: EndpointInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateEndpointInput(input);
  const id = `endpoint_${randomUUID()}`;

  const endpoint = await client.endpoint.create({
    data: {
      id,
      name: validInput.name,
      title: validInput.title ?? "",
      description: validInput.description ?? "",
      enabled: validInput.enabled,
      protectedDefault: false,
      deleteCode: validInput.deleteCode,
      defaultResponseJson: validInput.defaultResponseJson,
      failureMode: validInput.failureMode,
      failureStatusCode: validInput.failureStatusCode,
      failureDelayMs: validInput.failureDelayMs,
      failureMessage: validInput.failureMessage,
      malformedResponseJson: validInput.malformedResponseJson,
      parameters: {
        create: validInput.parameters.map((parameter, position) => ({
          id: `${id}_param_${position}_${randomUUID()}`,
          position,
          name: parameter.name,
          label: parameter.label || null,
          description: parameter.description ?? "",
          type: parameter.type,
          required: parameter.required,
          defaultValueJson: parameter.defaultValueJson,
        })),
      },
      responseCases: {
        create: validInput.responseCases.map((responseCase) => ({
          id: `${id}_case_${randomUUID()}`,
          ...responseCase,
        })),
      },
    },
    include: endpointInclude,
  });

  return toDetail(endpoint);
}

export async function updateEndpoint(
  id: string,
  input: EndpointInput,
  client: PrismaClient = createPrismaClient(),
) {
  const validInput = validateEndpointInput(input);

  const endpoint = await client.$transaction(async (tx) => {
    await tx.endpointParam.deleteMany({ where: { endpointId: id } });
    await tx.responseCase.deleteMany({ where: { endpointId: id } });

    return tx.endpoint.update({
      where: { id },
      data: {
        name: validInput.name,
        title: validInput.title ?? "",
        description: validInput.description ?? "",
        enabled: validInput.enabled,
        deleteCode: validInput.deleteCode,
        defaultResponseJson: validInput.defaultResponseJson,
        failureMode: validInput.failureMode,
        failureStatusCode: validInput.failureStatusCode,
        failureDelayMs: validInput.failureDelayMs,
        failureMessage: validInput.failureMessage,
        malformedResponseJson: validInput.malformedResponseJson,
        parameters: {
          create: validInput.parameters.map((parameter, position) => ({
            id: `${id}_param_${position}_${randomUUID()}`,
            position,
            name: parameter.name,
            label: parameter.label || null,
            description: parameter.description ?? "",
            type: parameter.type,
            required: parameter.required,
            defaultValueJson: parameter.defaultValueJson,
          })),
        },
        responseCases: {
          create: validInput.responseCases.map((responseCase) => ({
            id: `${id}_case_${randomUUID()}`,
            ...responseCase,
          })),
        },
      },
      include: endpointInclude,
    });
  });

  return toDetail(endpoint);
}

function deleteMethodFor(endpoint: EndpointRecord, input: EndpointDeleteInput) {
  const deleteCode = input.deleteCode?.trim() ?? "";
  const rootPassword = input.rootPassword ?? "";

  if (deleteCode && endpoint.deleteCode && deleteCode === endpoint.deleteCode) {
    return "delete_code";
  }
  if (verifyRootPassword(rootPassword)) {
    return "root_password";
  }
  return null;
}

export async function deleteEndpoint(
  id: string,
  input: EndpointDeleteInput,
  client: PrismaClient = createPrismaClient(),
) {
  const endpoint = await client.endpoint.findUnique({ where: { id }, include: endpointInclude });
  if (!endpoint) {
    throw new EndpointNotFoundError();
  }

  if (endpoint.protectedDefault) {
    await recordAuditEvent(
      {
        eventType: "endpoint.delete",
        subjectType: "endpoint",
        subjectId: endpoint.id,
        subjectName: endpoint.name,
        outcome: "failure",
        metadata: { reason: "protected_default" },
      },
      client,
    );
    throw new EndpointDeleteAuthorizationError("protected_default");
  }

  const method = deleteMethodFor(endpoint, input);
  if (!method) {
    await recordAuditEvent(
      {
        eventType: "endpoint.delete",
        subjectType: "endpoint",
        subjectId: endpoint.id,
        subjectName: endpoint.name,
        outcome: "failure",
        metadata: { reason: "invalid_confirmation" },
      },
      client,
    );
    throw new EndpointDeleteAuthorizationError(input.deleteCode || input.rootPassword ? "invalid_confirmation" : "missing_confirmation");
  }

  await client.$transaction(async (tx) => {
    await tx.endpoint.delete({ where: { id: endpoint.id } });
    await recordAuditEvent(
      {
        eventType: "endpoint.delete",
        subjectType: "endpoint",
        subjectId: endpoint.id,
        subjectName: endpoint.name,
        outcome: "success",
        metadata: { method },
      },
      tx,
    );
  });

  return toSummary(endpoint);
}
