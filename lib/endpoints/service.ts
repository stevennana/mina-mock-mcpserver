import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { createPrismaClient } from "@/lib/db/client";
import { applyEndpointCallDelay, executeEndpointDetail } from "@/lib/endpoints/runtime";
import { generateMcpInputSchema } from "@/lib/endpoints/schema";
import { EndpointDeleteAuthorizationError, EndpointNotFoundError } from "@/lib/endpoints/types";
import { validateEndpointInput } from "@/lib/endpoints/validation";
import { restToolFromEndpoint } from "@/lib/rest/tools";
import { verifyRootPassword } from "@/lib/security/root-password";
import type { EndpointCallResult } from "@/lib/endpoints/runtime";
import type {
  EndpointDeleteInput,
  EndpointDetail,
  EndpointInput,
  EndpointListResult,
  EndpointMcpTool,
  EndpointRestToolListResult,
  EndpointSummary,
} from "@/lib/endpoints/types";

const endpointInclude = {
  parameters: { orderBy: { position: "asc" } },
  responseCases: { orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { name: "asc" }] },
} satisfies Prisma.EndpointInclude;

type EndpointRecord = Prisma.EndpointGetPayload<{ include: typeof endpointInclude }>;

type FailureSimulationSnapshot = Pick<
  EndpointInput,
  "failureMode" | "failureStatusCode" | "failureDelayMs" | "failureMessage" | "malformedResponseJson"
>;

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

function failureSimulationSnapshot(input: FailureSimulationSnapshot) {
  return {
    failureMode: input.failureMode,
    failureStatusCode: input.failureStatusCode ?? null,
    failureDelayMs: input.failureDelayMs,
    failureMessage: input.failureMessage ?? null,
    malformedResponseJson: input.malformedResponseJson ?? null,
  };
}

function failureSimulationChanged(previous: FailureSimulationSnapshot, next: FailureSimulationSnapshot) {
  return JSON.stringify(failureSimulationSnapshot(previous)) !== JSON.stringify(failureSimulationSnapshot(next));
}

function failureSimulationAuditMetadata(
  action: "create" | "update",
  previous: FailureSimulationSnapshot | null,
  next: FailureSimulationSnapshot,
) {
  return {
    action,
    previousMode: previous?.failureMode ?? null,
    mode: next.failureMode,
    statusCode: next.failureStatusCode ?? null,
    delayMs: next.failureDelayMs,
    hasFailureMessage: Boolean(next.failureMessage),
    hasMalformedResponseBody: Boolean(next.malformedResponseJson),
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

type EndpointPermissionFilter = {
  endpointIds?: string[];
};

function enabledEndpointWhere(filter?: EndpointPermissionFilter): Prisma.EndpointWhereInput {
  return {
    enabled: true,
    ...(filter?.endpointIds ? { id: { in: filter.endpointIds } } : {}),
  };
}

export async function listEnabledMcpTools(
  client: PrismaClient = createPrismaClient(),
  filter?: EndpointPermissionFilter,
): Promise<EndpointMcpTool[]> {
  const endpoints = await client.endpoint.findMany({
    where: enabledEndpointWhere(filter),
    include: { parameters: { orderBy: { position: "asc" } } },
    orderBy: [{ name: "asc" }],
  });

  return endpoints.map((endpoint) => ({
    name: endpoint.name,
    description: endpoint.description || endpoint.title,
    inputSchema: generateMcpInputSchema({
      parameters: endpoint.parameters.map((parameter) => ({
        name: parameter.name,
        label: parameter.label ?? "",
        description: parameter.description ?? "",
        type: parameter.type as EndpointDetail["parameters"][number]["type"],
        required: parameter.required,
        defaultValueJson: parameter.defaultValueJson,
      })),
    }),
  }));
}

export async function listEnabledRestTools(
  client: PrismaClient = createPrismaClient(),
  filter?: EndpointPermissionFilter,
): Promise<EndpointRestToolListResult> {
  const endpoints = await client.endpoint.findMany({
    where: enabledEndpointWhere(filter),
    include: { parameters: { orderBy: { position: "asc" } } },
    orderBy: [{ name: "asc" }],
  });

  return {
    tools: endpoints.map((endpoint) =>
      restToolFromEndpoint({
        name: endpoint.name,
        title: endpoint.title,
        description: endpoint.description,
        parameters: endpoint.parameters.map((parameter) => ({
          name: parameter.name,
          label: parameter.label ?? "",
          description: parameter.description ?? "",
          type: parameter.type as EndpointDetail["parameters"][number]["type"],
          required: parameter.required,
          defaultValueJson: parameter.defaultValueJson,
        })),
      }),
    ),
  };
}

export async function getEndpoint(id: string, client: PrismaClient = createPrismaClient()) {
  const endpoint = await client.endpoint.findUnique({ where: { id }, include: endpointInclude });
  return endpoint ? toDetail(endpoint) : null;
}

export async function callEndpointByName(
  name: string,
  rawArguments: unknown,
  client: PrismaClient = createPrismaClient(),
): Promise<EndpointCallResult> {
  const endpoint = await client.endpoint.findUnique({ where: { name }, include: endpointInclude });
  return applyEndpointCallDelay(executeEndpointDetail(endpoint ? toDetail(endpoint) : null, rawArguments));
}

export async function resolvePermittedEndpointByName(
  name: string,
  endpointIds: string[],
  client: PrismaClient = createPrismaClient(),
): Promise<{ kind: "allowed" } | Extract<EndpointCallResult, { kind: "not_found" | "disabled" | "forbidden" }>> {
  const endpoint = await client.endpoint.findUnique({
    where: { name },
    select: { id: true, enabled: true },
  });
  if (!endpoint) {
    return { kind: "not_found" };
  }
  if (!endpoint.enabled) {
    return { kind: "disabled" };
  }
  if (!new Set(endpointIds).has(endpoint.id)) {
    return { kind: "forbidden", message: "Bearer token does not grant permission for this endpoint." };
  }

  return { kind: "allowed" };
}

export async function callPermittedEndpointByName(
  name: string,
  rawArguments: unknown,
  endpointIds: string[],
  client: PrismaClient = createPrismaClient(),
): Promise<EndpointCallResult> {
  const endpoint = await client.endpoint.findUnique({ where: { name }, include: endpointInclude });
  if (!endpoint) {
    return { kind: "not_found" };
  }
  if (!endpoint.enabled) {
    return { kind: "disabled" };
  }
  if (!new Set(endpointIds).has(endpoint.id)) {
    return { kind: "forbidden", message: "Bearer token does not grant permission for this endpoint." };
  }

  return applyEndpointCallDelay(executeEndpointDetail(toDetail(endpoint), rawArguments));
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

  if (validInput.failureMode !== "none" || validInput.failureDelayMs > 0 || validInput.failureStatusCode !== null) {
    await recordAuditEvent(
      {
        eventType: "endpoint.failure_simulation.update",
        subjectType: "endpoint",
        subjectId: endpoint.id,
        subjectName: endpoint.name,
        outcome: "success",
        metadata: failureSimulationAuditMetadata("create", null, validInput),
      },
      client,
    );
  }

  return toDetail(endpoint);
}

export async function updateEndpoint(
  id: string,
  input: EndpointInput,
  client: PrismaClient = createPrismaClient(),
) {
  const validInput = validateEndpointInput(input);

  const endpoint = await client.$transaction(async (tx) => {
    const previous = await tx.endpoint.findUnique({
      where: { id },
      select: {
        failureMode: true,
        failureStatusCode: true,
        failureDelayMs: true,
        failureMessage: true,
        malformedResponseJson: true,
      },
    });

    await tx.endpointParam.deleteMany({ where: { endpointId: id } });
    await tx.responseCase.deleteMany({ where: { endpointId: id } });

    const updated = await tx.endpoint.update({
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

    if (previous && failureSimulationChanged(previous as FailureSimulationSnapshot, validInput)) {
      await recordAuditEvent(
        {
          eventType: "endpoint.failure_simulation.update",
          subjectType: "endpoint",
          subjectId: updated.id,
          subjectName: updated.name,
          outcome: "success",
          metadata: failureSimulationAuditMetadata("update", previous as FailureSimulationSnapshot, validInput),
        },
        tx,
      );
    }

    return updated;
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
