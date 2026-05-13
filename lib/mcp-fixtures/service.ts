import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { createPrismaClient } from "@/lib/db/client";
import {
  validateMcpPromptInput,
  validateMcpResourceInput,
  validateMcpResourceTemplateInput,
} from "@/lib/mcp-fixtures/validation";
import { McpFixtureNotFoundError } from "@/lib/mcp-fixtures/types";
import type {
  McpFixtureListResult,
  McpPromptDetail,
  McpPromptInput,
  McpPromptSummary,
  McpResourceDetail,
  McpResourceInput,
  McpResourceSummary,
  McpResourceTemplateDetail,
  McpResourceTemplateInput,
  McpResourceTemplateSummary,
} from "@/lib/mcp-fixtures/types";

export const DEFAULT_MCP_RESOURCE_ID = "mcp_resource_default_status";
export const DEFAULT_MCP_RESOURCE_TEMPLATE_ID = "mcp_resource_template_default_customer";
export const DEFAULT_MCP_PROMPT_SUPPORT_ID = "mcp_prompt_default_support_reply";
export const DEFAULT_MCP_PROMPT_RELEASE_ID = "mcp_prompt_default_release_notes";

const resourceTemplateInclude = {
  arguments: { orderBy: { position: "asc" } },
  completionCandidates: { orderBy: [{ argumentName: "asc" }, { position: "asc" }, { value: "asc" }] },
} satisfies Prisma.McpResourceTemplateInclude;

const promptInclude = {
  arguments: { orderBy: { position: "asc" } },
  messages: { orderBy: { position: "asc" } },
  completionCandidates: { orderBy: [{ argumentName: "asc" }, { position: "asc" }, { value: "asc" }] },
} satisfies Prisma.McpPromptInclude;

type ResourceTemplateRecord = Prisma.McpResourceTemplateGetPayload<{ include: typeof resourceTemplateInclude }>;
type PromptRecord = Prisma.McpPromptGetPayload<{ include: typeof promptInclude }>;
type ResourceContentSnapshot = Pick<Prisma.McpResourceGetPayload<object>, "textContent" | "blobContentBase64">;

function toResourceSummary(resource: Prisma.McpResourceGetPayload<object>): McpResourceSummary {
  return {
    id: resource.id,
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
    enabled: resource.enabled,
    protectedDefault: resource.protectedDefault,
    updatedAt: resource.updatedAt.toISOString(),
  };
}

function toResourceDetail(resource: Prisma.McpResourceGetPayload<object>): McpResourceDetail {
  return {
    ...toResourceSummary(resource),
    textContent: resource.textContent,
    blobContentBase64: resource.blobContentBase64,
    annotationsJson: resource.annotationsJson,
  };
}

function toResourceTemplateSummary(template: ResourceTemplateRecord): McpResourceTemplateSummary {
  return {
    id: template.id,
    uriTemplate: template.uriTemplate,
    name: template.name,
    title: template.title,
    description: template.description,
    mimeType: template.mimeType,
    enabled: template.enabled,
    protectedDefault: template.protectedDefault,
    argumentCount: template.arguments.length,
    completionCandidateCount: template.completionCandidates.length,
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toResourceTemplateDetail(template: ResourceTemplateRecord): McpResourceTemplateDetail {
  return {
    ...toResourceTemplateSummary(template),
    textTemplate: template.textTemplate,
    blobTemplateBase64: template.blobTemplateBase64,
    annotationsJson: template.annotationsJson,
    arguments: template.arguments.map((argument) => ({
      id: argument.id,
      position: argument.position,
      name: argument.name,
      description: argument.description,
      required: argument.required,
      sampleValueJson: argument.sampleValueJson,
    })),
    completionCandidates: template.completionCandidates.map((candidate) => ({
      id: candidate.id,
      position: candidate.position,
      argumentName: candidate.argumentName,
      value: candidate.value,
      label: candidate.label,
    })),
  };
}

function toPromptSummary(prompt: PromptRecord): McpPromptSummary {
  return {
    id: prompt.id,
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    enabled: prompt.enabled,
    protectedDefault: prompt.protectedDefault,
    argumentCount: prompt.arguments.length,
    messageCount: prompt.messages.length,
    completionCandidateCount: prompt.completionCandidates.length,
    updatedAt: prompt.updatedAt.toISOString(),
  };
}

function toPromptDetail(prompt: PromptRecord): McpPromptDetail {
  return {
    ...toPromptSummary(prompt),
    arguments: prompt.arguments.map((argument) => ({
      id: argument.id,
      position: argument.position,
      name: argument.name,
      title: argument.title,
      description: argument.description,
      required: argument.required,
    })),
    messages: prompt.messages.map((message) => ({
      id: message.id,
      position: message.position,
      role: message.role as "user" | "assistant",
      textTemplate: message.textTemplate,
      resourceUri: message.resourceUri,
      resourceMimeType: message.resourceMimeType,
    })),
    completionCandidates: prompt.completionCandidates.map((candidate) => ({
      id: candidate.id,
      position: candidate.position,
      argumentName: candidate.argumentName,
      value: candidate.value,
      label: candidate.label,
    })),
  };
}

export async function listMcpResources(
  client: PrismaClient = createPrismaClient(),
): Promise<McpFixtureListResult<McpResourceSummary>> {
  const resources = await client.mcpResource.findMany({ orderBy: [{ enabled: "desc" }, { uri: "asc" }] });
  return {
    total: resources.length,
    enabled: resources.filter((resource) => resource.enabled).length,
    disabled: resources.filter((resource) => !resource.enabled).length,
    items: resources.map(toResourceSummary),
  };
}

export async function listEnabledMcpResources(client: PrismaClient = createPrismaClient()): Promise<McpResourceDetail[]> {
  const resources = await client.mcpResource.findMany({ where: { enabled: true }, orderBy: [{ uri: "asc" }] });
  return resources.map(toResourceDetail);
}

export async function getMcpResource(id: string, client: PrismaClient = createPrismaClient()) {
  const resource = await client.mcpResource.findUnique({ where: { id } });
  return resource ? toResourceDetail(resource) : null;
}

export async function createMcpResource(input: McpResourceInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateMcpResourceInput(input);
  const resource = await client.mcpResource.create({
    data: {
      id: `mcp_resource_${randomUUID()}`,
      uri: validInput.uri,
      name: validInput.name,
      title: validInput.title ?? "",
      description: validInput.description ?? "",
      mimeType: validInput.mimeType,
      enabled: validInput.enabled,
      textContent: validInput.textContent ?? null,
      blobContentBase64: validInput.blobContentBase64 ?? null,
      annotationsJson: validInput.annotationsJson ?? null,
    },
  });
  await recordAuditEvent(
    {
      eventType: "mcp_resource.create",
      subjectType: "mcp_resource",
      subjectId: resource.id,
      subjectName: resource.name,
      outcome: "success",
      metadata: {
        uri: resource.uri,
        enabled: resource.enabled,
        mimeType: resource.mimeType,
        contentKind: resource.textContent === null ? "blob" : "text",
      },
    },
    client,
  );
  return toResourceDetail(resource);
}

export async function updateMcpResource(id: string, input: McpResourceInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateMcpResourceInput(input);
  const resource = await client.$transaction(async (tx) => {
    const previous = await tx.mcpResource.findUnique({
      where: { id },
      select: { textContent: true, blobContentBase64: true },
    });
    const updated = await tx.mcpResource.update({
      where: { id },
      data: {
        uri: validInput.uri,
        name: validInput.name,
        title: validInput.title ?? "",
        description: validInput.description ?? "",
        mimeType: validInput.mimeType,
        enabled: validInput.enabled,
        textContent: validInput.textContent ?? null,
        blobContentBase64: validInput.blobContentBase64 ?? null,
        annotationsJson: validInput.annotationsJson ?? null,
      },
    });
    await recordAuditEvent(
      {
        eventType: "mcp_resource.update",
        subjectType: "mcp_resource",
        subjectId: updated.id,
        subjectName: updated.name,
        outcome: "success",
        metadata: {
          uri: updated.uri,
          enabled: updated.enabled,
          mimeType: updated.mimeType,
          contentKind: updated.textContent === null ? "blob" : "text",
        },
      },
      tx,
    );
    if (previous && resourceContentChanged(previous, updated)) {
      await recordAuditEvent(
        {
          eventType: "mcp_resource.content.update",
          subjectType: "mcp_resource",
          subjectId: updated.id,
          subjectName: updated.name,
          outcome: "success",
          metadata: {
            uri: updated.uri,
            contentKind: updated.textContent === null ? "blob" : "text",
            textLength: updated.textContent?.length ?? null,
            blobLength: updated.blobContentBase64?.length ?? null,
          },
        },
        tx,
      );
    }
    return updated;
  });
  return toResourceDetail(resource);
}

function resourceContentChanged(previous: ResourceContentSnapshot, next: ResourceContentSnapshot) {
  return previous.textContent !== next.textContent || previous.blobContentBase64 !== next.blobContentBase64;
}

export async function deleteMcpResource(id: string, client: PrismaClient = createPrismaClient()) {
  const resource = await client.mcpResource.findUnique({ where: { id } });
  if (!resource) {
    throw new McpFixtureNotFoundError();
  }
  await client.$transaction(async (tx) => {
    await tx.mcpResource.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "mcp_resource.delete",
        subjectType: "mcp_resource",
        subjectId: resource.id,
        subjectName: resource.name,
        outcome: "success",
        metadata: { uri: resource.uri, enabled: resource.enabled },
      },
      tx,
    );
  });
  return toResourceSummary(resource);
}

export async function listMcpResourceTemplates(
  client: PrismaClient = createPrismaClient(),
): Promise<McpFixtureListResult<McpResourceTemplateSummary>> {
  const templates = await client.mcpResourceTemplate.findMany({
    include: resourceTemplateInclude,
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
  });
  return {
    total: templates.length,
    enabled: templates.filter((template) => template.enabled).length,
    disabled: templates.filter((template) => !template.enabled).length,
    items: templates.map(toResourceTemplateSummary),
  };
}

export async function listEnabledMcpResourceTemplates(
  client: PrismaClient = createPrismaClient(),
): Promise<McpResourceTemplateDetail[]> {
  const templates = await client.mcpResourceTemplate.findMany({
    where: { enabled: true },
    include: resourceTemplateInclude,
    orderBy: [{ name: "asc" }],
  });
  return templates.map(toResourceTemplateDetail);
}

export async function getMcpResourceTemplate(id: string, client: PrismaClient = createPrismaClient()) {
  const template = await client.mcpResourceTemplate.findUnique({ where: { id }, include: resourceTemplateInclude });
  return template ? toResourceTemplateDetail(template) : null;
}

function resourceTemplateCreateData(id: string, input: McpResourceTemplateInput) {
  return {
    id,
    uriTemplate: input.uriTemplate,
    name: input.name,
    title: input.title ?? "",
    description: input.description ?? "",
    mimeType: input.mimeType,
    enabled: input.enabled,
    textTemplate: input.textTemplate ?? null,
    blobTemplateBase64: input.blobTemplateBase64 ?? null,
    annotationsJson: input.annotationsJson ?? null,
    arguments: {
      create: input.arguments.map((argument, position) => ({
        id: `${id}_argument_${position}_${randomUUID()}`,
        position,
        name: argument.name,
        description: argument.description ?? "",
        required: argument.required ?? true,
        sampleValueJson: argument.sampleValueJson ?? null,
      })),
    },
    completionCandidates: {
      create: input.completionCandidates.map((candidate, position) => ({
        id: `${id}_candidate_${position}_${randomUUID()}`,
        ownerType: "resource_template",
        position,
        argumentName: candidate.argumentName,
        value: candidate.value,
        label: candidate.label ?? "",
      })),
    },
  };
}

export async function createMcpResourceTemplate(
  input: McpResourceTemplateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const validInput = validateMcpResourceTemplateInput(input);
  const id = `mcp_resource_template_${randomUUID()}`;
  const template = await client.mcpResourceTemplate.create({
    data: resourceTemplateCreateData(id, validInput),
    include: resourceTemplateInclude,
  });
  return toResourceTemplateDetail(template);
}

export async function updateMcpResourceTemplate(
  id: string,
  input: McpResourceTemplateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const validInput = validateMcpResourceTemplateInput(input);
  const template = await client.$transaction(async (tx) => {
    await tx.mcpCompletionCandidate.deleteMany({ where: { resourceTemplateId: id } });
    await tx.mcpResourceTemplateArgument.deleteMany({ where: { resourceTemplateId: id } });
    return tx.mcpResourceTemplate.update({
      where: { id },
      data: {
        uriTemplate: validInput.uriTemplate,
        name: validInput.name,
        title: validInput.title ?? "",
        description: validInput.description ?? "",
        mimeType: validInput.mimeType,
        enabled: validInput.enabled,
        textTemplate: validInput.textTemplate ?? null,
        blobTemplateBase64: validInput.blobTemplateBase64 ?? null,
        annotationsJson: validInput.annotationsJson ?? null,
        arguments: resourceTemplateCreateData(id, validInput).arguments,
        completionCandidates: resourceTemplateCreateData(id, validInput).completionCandidates,
      },
      include: resourceTemplateInclude,
    });
  });
  return toResourceTemplateDetail(template);
}

export async function deleteMcpResourceTemplate(id: string, client: PrismaClient = createPrismaClient()) {
  const template = await client.mcpResourceTemplate.findUnique({ where: { id }, include: resourceTemplateInclude });
  if (!template) {
    throw new McpFixtureNotFoundError();
  }
  await client.mcpResourceTemplate.delete({ where: { id } });
  return toResourceTemplateSummary(template);
}

export async function listMcpPrompts(
  client: PrismaClient = createPrismaClient(),
): Promise<McpFixtureListResult<McpPromptSummary>> {
  const prompts = await client.mcpPrompt.findMany({
    include: promptInclude,
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
  });
  return {
    total: prompts.length,
    enabled: prompts.filter((prompt) => prompt.enabled).length,
    disabled: prompts.filter((prompt) => !prompt.enabled).length,
    items: prompts.map(toPromptSummary),
  };
}

export async function listEnabledMcpPrompts(client: PrismaClient = createPrismaClient()): Promise<McpPromptDetail[]> {
  const prompts = await client.mcpPrompt.findMany({
    where: { enabled: true },
    include: promptInclude,
    orderBy: [{ name: "asc" }],
  });
  return prompts.map(toPromptDetail);
}

export async function getMcpPrompt(id: string, client: PrismaClient = createPrismaClient()) {
  const prompt = await client.mcpPrompt.findUnique({ where: { id }, include: promptInclude });
  return prompt ? toPromptDetail(prompt) : null;
}

function promptCreateData(id: string, input: McpPromptInput) {
  return {
    id,
    name: input.name,
    title: input.title ?? "",
    description: input.description ?? "",
    enabled: input.enabled,
    arguments: {
      create: input.arguments.map((argument, position) => ({
        id: `${id}_argument_${position}_${randomUUID()}`,
        position,
        name: argument.name,
        title: argument.title ?? "",
        description: argument.description ?? "",
        required: argument.required,
      })),
    },
    messages: {
      create: input.messages.map((message, position) => ({
        id: `${id}_message_${position}_${randomUUID()}`,
        position,
        role: message.role,
        textTemplate: message.textTemplate ?? null,
        resourceUri: message.resourceUri ?? null,
        resourceMimeType: message.resourceMimeType ?? null,
      })),
    },
    completionCandidates: {
      create: input.completionCandidates.map((candidate, position) => ({
        id: `${id}_candidate_${position}_${randomUUID()}`,
        ownerType: "prompt",
        position,
        argumentName: candidate.argumentName,
        value: candidate.value,
        label: candidate.label ?? "",
      })),
    },
  };
}

export async function createMcpPrompt(input: McpPromptInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateMcpPromptInput(input);
  const id = `mcp_prompt_${randomUUID()}`;
  const prompt = await client.mcpPrompt.create({ data: promptCreateData(id, validInput), include: promptInclude });
  return toPromptDetail(prompt);
}

export async function updateMcpPrompt(id: string, input: McpPromptInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateMcpPromptInput(input);
  const prompt = await client.$transaction(async (tx) => {
    await tx.mcpCompletionCandidate.deleteMany({ where: { promptId: id } });
    await tx.mcpPromptMessage.deleteMany({ where: { promptId: id } });
    await tx.mcpPromptArgument.deleteMany({ where: { promptId: id } });
    return tx.mcpPrompt.update({
      where: { id },
      data: {
        name: validInput.name,
        title: validInput.title ?? "",
        description: validInput.description ?? "",
        enabled: validInput.enabled,
        arguments: promptCreateData(id, validInput).arguments,
        messages: promptCreateData(id, validInput).messages,
        completionCandidates: promptCreateData(id, validInput).completionCandidates,
      },
      include: promptInclude,
    });
  });
  return toPromptDetail(prompt);
}

export async function deleteMcpPrompt(id: string, client: PrismaClient = createPrismaClient()) {
  const prompt = await client.mcpPrompt.findUnique({ where: { id }, include: promptInclude });
  if (!prompt) {
    throw new McpFixtureNotFoundError();
  }
  await client.mcpPrompt.delete({ where: { id } });
  return toPromptSummary(prompt);
}
