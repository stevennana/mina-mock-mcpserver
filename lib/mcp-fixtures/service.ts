import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { createPrismaClient } from "@/lib/db/client";
import { renderTemplateWithValues } from "@/lib/mcp-fixtures/template-render";
import {
  validateMcpPromptInput,
  validateMcpResourceInput,
  validateMcpResourceTemplateInput,
} from "@/lib/mcp-fixtures/validation";
import { McpFixtureNotFoundError, McpFixtureProtectedDefaultError, McpFixtureValidationError } from "@/lib/mcp-fixtures/types";
import type {
  McpFixtureListResult,
  McpPromptDetail,
  McpPromptInput,
  McpPromptSummary,
  McpResourceDetail,
  McpResourceInput,
  McpResourceSummary,
  McpResourceRuntimeRead,
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
const uriTemplatePlaceholderPattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchResourceTemplateUri(
  uriTemplate: string,
  uri: string,
): Record<string, string> | null {
  const names: string[] = [];
  let pattern = "^";
  let lastIndex = 0;

  for (const match of uriTemplate.matchAll(uriTemplatePlaceholderPattern)) {
    const name = match[1];
    if (!name) return null;
    const index = match.index ?? 0;
    pattern += escapeRegex(uriTemplate.slice(lastIndex, index));
    pattern += "([^/?#]+)";
    names.push(name);
    lastIndex = index + match[0].length;
  }

  pattern += escapeRegex(uriTemplate.slice(lastIndex));
  pattern += "$";

  const match = new RegExp(pattern).exec(uri);
  if (!match) return null;

  return Object.fromEntries(
    names.map((name, index) => {
      const value = match[index + 1] ?? "";
      try {
        return [name, decodeURIComponent(value)];
      } catch {
        return [name, value];
      }
    }),
  );
}

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

export async function readEnabledMcpResource(
  uri: string,
  client: PrismaClient = createPrismaClient(),
): Promise<McpResourceRuntimeRead | null> {
  const directResource = await client.mcpResource.findUnique({ where: { uri } });
  if (directResource?.enabled) {
    return {
      uri: directResource.uri,
      mimeType: directResource.mimeType,
      textContent: directResource.textContent,
      blobContentBase64: directResource.blobContentBase64,
    };
  }

  const templates = await listEnabledMcpResourceTemplates(client);
  for (const template of templates) {
    const values = matchResourceTemplateUri(template.uriTemplate, uri);
    if (!values) continue;
    return {
      uri,
      mimeType: template.mimeType,
      textContent: template.textTemplate === null ? null : renderTemplateWithValues(template.textTemplate, values),
      blobContentBase64: template.blobTemplateBase64 === null ? null : renderTemplateWithValues(template.blobTemplateBase64, values),
    };
  }

  return null;
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
      select: { textContent: true, blobContentBase64: true, protectedDefault: true },
    });
    if (!previous) throw new McpFixtureNotFoundError();
    if (previous.protectedDefault) throw new McpFixtureProtectedDefaultError("resource", "update");
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
  if (resource.protectedDefault) {
    throw new McpFixtureProtectedDefaultError("resource", "delete");
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
  await recordAuditEvent(
    {
      eventType: "mcp_resource_template.create",
      subjectType: "mcp_resource_template",
      subjectId: template.id,
      subjectName: template.name,
      outcome: "success",
      metadata: {
        uriTemplate: template.uriTemplate,
        enabled: template.enabled,
        mimeType: template.mimeType,
        argumentCount: template.arguments.length,
        completionCandidateCount: template.completionCandidates.length,
      },
    },
    client,
  );
  return toResourceTemplateDetail(template);
}

export async function updateMcpResourceTemplate(
  id: string,
  input: McpResourceTemplateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const validInput = validateMcpResourceTemplateInput(input);
  const template = await client.$transaction(async (tx) => {
    const previous = await tx.mcpResourceTemplate.findUnique({ where: { id }, select: { protectedDefault: true } });
    if (!previous) throw new McpFixtureNotFoundError();
    if (previous.protectedDefault) throw new McpFixtureProtectedDefaultError("resource_template", "update");
    await tx.mcpCompletionCandidate.deleteMany({ where: { resourceTemplateId: id } });
    await tx.mcpResourceTemplateArgument.deleteMany({ where: { resourceTemplateId: id } });
    const updated = await tx.mcpResourceTemplate.update({
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
    await recordAuditEvent(
      {
        eventType: "mcp_resource_template.update",
        subjectType: "mcp_resource_template",
        subjectId: updated.id,
        subjectName: updated.name,
        outcome: "success",
        metadata: {
          uriTemplate: updated.uriTemplate,
          enabled: updated.enabled,
          mimeType: updated.mimeType,
          argumentCount: updated.arguments.length,
          completionCandidateCount: updated.completionCandidates.length,
        },
      },
      tx,
    );
    return updated;
  });
  return toResourceTemplateDetail(template);
}

export async function deleteMcpResourceTemplate(id: string, client: PrismaClient = createPrismaClient()) {
  const template = await client.mcpResourceTemplate.findUnique({ where: { id }, include: resourceTemplateInclude });
  if (!template) {
    throw new McpFixtureNotFoundError();
  }
  if (template.protectedDefault) {
    throw new McpFixtureProtectedDefaultError("resource_template", "delete");
  }
  await client.$transaction(async (tx) => {
    await tx.mcpResourceTemplate.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "mcp_resource_template.delete",
        subjectType: "mcp_resource_template",
        subjectId: template.id,
        subjectName: template.name,
        outcome: "success",
        metadata: { uriTemplate: template.uriTemplate, enabled: template.enabled },
      },
      tx,
    );
  });
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

async function assertPromptEmbeddedResourcesEnabled(input: McpPromptInput, client: PrismaClient) {
  const resourceUris = [...new Set(input.messages.map((message) => message.resourceUri).filter((uri): uri is string => Boolean(uri)))];
  if (resourceUris.length === 0) return;

  const enabledResources = await client.mcpResource.findMany({
    where: { uri: { in: resourceUris }, enabled: true },
    select: { uri: true },
  });
  const enabledUris = new Set(enabledResources.map((resource) => resource.uri));
  const fieldErrors: Record<string, string> = {};
  input.messages.forEach((message, index) => {
    if (message.resourceUri && !enabledUris.has(message.resourceUri)) {
      fieldErrors[`messages.${index}.resourceUri`] = "Choose an enabled MCP resource.";
    }
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw new McpFixtureValidationError(fieldErrors);
  }
}

export async function createMcpPrompt(input: McpPromptInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateMcpPromptInput(input);
  await assertPromptEmbeddedResourcesEnabled(validInput, client);
  const id = `mcp_prompt_${randomUUID()}`;
  const prompt = await client.mcpPrompt.create({ data: promptCreateData(id, validInput), include: promptInclude });
  await recordAuditEvent(
    {
      eventType: "mcp_prompt.create",
      subjectType: "mcp_prompt",
      subjectId: prompt.id,
      subjectName: prompt.name,
      outcome: "success",
      metadata: {
        enabled: prompt.enabled,
        argumentCount: prompt.arguments.length,
        messageCount: prompt.messages.length,
        completionCandidateCount: prompt.completionCandidates.length,
      },
    },
    client,
  );
  return toPromptDetail(prompt);
}

export async function updateMcpPrompt(id: string, input: McpPromptInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateMcpPromptInput(input);
  await assertPromptEmbeddedResourcesEnabled(validInput, client);
  const prompt = await client.$transaction(async (tx) => {
    const previous = await tx.mcpPrompt.findUnique({ where: { id }, select: { protectedDefault: true } });
    if (!previous) throw new McpFixtureNotFoundError();
    if (previous.protectedDefault) throw new McpFixtureProtectedDefaultError("prompt", "update");
    await tx.mcpCompletionCandidate.deleteMany({ where: { promptId: id } });
    await tx.mcpPromptMessage.deleteMany({ where: { promptId: id } });
    await tx.mcpPromptArgument.deleteMany({ where: { promptId: id } });
    const updated = await tx.mcpPrompt.update({
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
    await recordAuditEvent(
      {
        eventType: "mcp_prompt.update",
        subjectType: "mcp_prompt",
        subjectId: updated.id,
        subjectName: updated.name,
        outcome: "success",
        metadata: {
          enabled: updated.enabled,
          argumentCount: updated.arguments.length,
          messageCount: updated.messages.length,
          completionCandidateCount: updated.completionCandidates.length,
        },
      },
      tx,
    );
    return updated;
  });
  return toPromptDetail(prompt);
}

export async function deleteMcpPrompt(id: string, client: PrismaClient = createPrismaClient()) {
  const prompt = await client.mcpPrompt.findUnique({ where: { id }, include: promptInclude });
  if (!prompt) {
    throw new McpFixtureNotFoundError();
  }
  if (prompt.protectedDefault) {
    throw new McpFixtureProtectedDefaultError("prompt", "delete");
  }
  await client.$transaction(async (tx) => {
    await tx.mcpPrompt.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "mcp_prompt.delete",
        subjectType: "mcp_prompt",
        subjectId: prompt.id,
        subjectName: prompt.name,
        outcome: "success",
        metadata: { enabled: prompt.enabled },
      },
      tx,
    );
  });
  return toPromptSummary(prompt);
}
