import {
  callEndpointByName,
  callPermittedEndpointByName,
  listEnabledMcpTools,
} from "@/lib/endpoints/service";
import {
  listEnabledMcpPrompts,
  listEnabledMcpResources,
  listEnabledMcpResourceTemplates,
  matchResourceTemplateUri,
  readEnabledMcpResource,
} from "@/lib/mcp-fixtures/service";
import { renderTemplateWithValues } from "@/lib/mcp-fixtures/template-render";
import type { EndpointCallResult } from "@/lib/endpoints/runtime";
import type { JsonValue as EndpointJsonValue } from "@/lib/endpoints/types";
import type {
  McpCompletionCandidateInput,
  McpPromptDetail,
  McpResourceDetail,
  McpResourceRuntimeRead,
  McpResourceTemplateDetail,
} from "@/lib/mcp-fixtures/types";
import type {
  JsonValue,
  McpCompletionResult,
  McpListResult,
  McpPrompt,
  McpPromptGetResult,
  McpResource,
  McpResourceContent,
  McpResourceReadResult,
  McpResourceTemplate,
  McpRuntimeProvider,
  McpSubscribeResult,
  McpToolCallResult,
} from "@minasoft/mcp-runtime";

export const MOCK_MCP_SERVER_INFO = {
  name: "mina-mock-mcpserver",
  version: "1.0.0",
} as const;

export type MockServerRuntimePermissions = {
  endpointIds?: string[];
  resourceIds?: string[];
  resourceTemplateIds?: string[];
  promptIds?: string[];
};

export type MockServerRuntimeProviderOptions = MockServerRuntimePermissions & {
  sseSession?: {
    subscribeResource: (uri: string) => boolean;
    unsubscribeResource: (uri: string) => boolean;
  };
};

function parseAnnotations(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as McpResource["annotations"];
  } catch {
    return undefined;
  }
}

function contentSize(textContent: string | null, blobContentBase64: string | null) {
  if (textContent !== null) return new TextEncoder().encode(textContent).byteLength;
  if (blobContentBase64 !== null) return Buffer.from(blobContentBase64, "base64").byteLength;
  return undefined;
}

function mcpResourceFromDetail(resource: McpResourceDetail): McpResource {
  const annotations = parseAnnotations(resource.annotationsJson);
  const size = contentSize(resource.textContent, resource.blobContentBase64);
  return {
    uri: resource.uri,
    name: resource.name,
    ...(resource.title ? { title: resource.title } : {}),
    ...(resource.description ? { description: resource.description } : {}),
    mimeType: resource.mimeType,
    ...(size !== undefined ? { size } : {}),
    ...(annotations ? { annotations } : {}),
  };
}

function mcpResourceTemplateFromDetail(template: McpResourceTemplateDetail): McpResourceTemplate {
  const annotations = parseAnnotations(template.annotationsJson);
  return {
    uriTemplate: template.uriTemplate,
    name: template.name,
    ...(template.title ? { title: template.title } : {}),
    ...(template.description ? { description: template.description } : {}),
    mimeType: template.mimeType,
    ...(annotations ? { annotations } : {}),
  };
}

function mcpResourceContentFromRead(resource: McpResourceRuntimeRead): McpResourceContent {
  return {
    uri: resource.uri,
    mimeType: resource.mimeType,
    ...(resource.textContent !== null ? { text: resource.textContent } : { blob: resource.blobContentBase64 ?? "" }),
  };
}

function mcpPromptFromDetail(prompt: McpPromptDetail): McpPrompt {
  return {
    name: prompt.name,
    ...(prompt.title ? { title: prompt.title } : {}),
    ...(prompt.description ? { description: prompt.description } : {}),
    arguments: prompt.arguments.map((argument) => ({
      name: argument.name,
      ...(argument.title ? { title: argument.title } : {}),
      ...(argument.description ? { description: argument.description } : {}),
      required: argument.required,
    })),
  };
}

function stringArguments(args: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(args).map(([name, value]) => [
      name,
      typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "",
    ]),
  );
}

function textForJson(value: EndpointJsonValue) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function structuredContentFor(value: EndpointJsonValue): Record<string, JsonValue> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : undefined;
}

export function mcpToolResultFromEndpointCall(toolName: string, callResult: EndpointCallResult): McpToolCallResult {
  if (callResult.kind === "matched") {
    const structuredContent = structuredContentFor(callResult.body);
    return {
      kind: "success",
      content: [{ type: "text", text: textForJson(callResult.body) }],
      ...(structuredContent ? { structuredContent } : {}),
    };
  }

  if (callResult.kind === "not_found" || callResult.kind === "disabled") {
    return { kind: "invalid_params", message: "Unknown tool" };
  }

  if (callResult.kind === "forbidden") {
    return {
      kind: "forbidden",
      message: "Forbidden",
      data: {
        message: callResult.message,
        tool: toolName,
      },
    };
  }

  if (callResult.kind === "invalid_arguments") {
    return { kind: "invalid_params", message: callResult.message };
  }

  if (callResult.kind === "protocol_error") {
    return {
      kind: "protocol_error",
      message: callResult.message,
      data: {
        tool: toolName,
        matchedCase: callResult.matchedCase.name,
        ...(callResult.body ? { body: callResult.body as JsonValue } : {}),
      },
    };
  }

  if (callResult.kind === "malformed") {
    return {
      kind: "raw",
      status: callResult.statusCode,
      body: callResult.body,
      contentType: callResult.contentType,
      headers: { "X-MCP-Mock-Matched-Case": callResult.matchedCase.name },
    };
  }

  const fallbackBody = {
    error: "tool_error",
    message: callResult.message,
    matchedCase: callResult.matchedCase.name,
  };
  const body = callResult.body ?? fallbackBody;
  const structuredContent = structuredContentFor(body);
  return {
    kind: "tool_error",
    content: [{ type: "text", text: textForJson(body) }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function paginate<TItem>(items: TItem[], cursor: string | undefined, limit = 100): McpListResult<TItem> {
  const parsedCursor = cursor ? Number.parseInt(cursor, 10) : 0;
  const offset = Number.isInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;
  const page = items.slice(offset, offset + limit);
  const next = offset + page.length;
  return {
    items: page,
    ...(next < items.length ? { nextCursor: String(next) } : {}),
  };
}

async function readPermittedResource(uri: string, permissions: MockServerRuntimePermissions): Promise<McpResourceReadResult> {
  if (permissions.resourceIds || permissions.resourceTemplateIds) {
    const [resources, templates] = await Promise.all([listEnabledMcpResources(), listEnabledMcpResourceTemplates()]);
    const directResource = resources.find((resource) => resource.uri === uri);
    if (directResource) {
      if (permissions.resourceIds && !permissions.resourceIds.includes(directResource.id)) {
        return forbidden("Bearer token does not grant permission for this resource.", { uri });
      }
    } else {
      const renderedTemplate = templates.find((template) => matchResourceTemplateUri(template.uriTemplate, uri));
      if (
        renderedTemplate &&
        permissions.resourceTemplateIds &&
        !permissions.resourceTemplateIds.includes(renderedTemplate.id)
      ) {
        return forbidden("Bearer token does not grant permission for this resource template.", { uri });
      }
      if (!renderedTemplate) {
        const renderedResource = await readEnabledMcpResource(uri);
        if (renderedResource) {
          return forbidden("Bearer token does not grant permission for this resource.", { uri });
        }
        return resourceNotFound(uri);
      }
    }
    if (!directResource && permissions.resourceIds && !permissions.resourceTemplateIds) {
      return forbidden("Bearer token does not grant permission for this resource.", { uri });
    }
  }

  const resource = await readEnabledMcpResource(uri);
  return resource ? { kind: "success", contents: [mcpResourceContentFromRead(resource)] } : resourceNotFound(uri);
}

function resourceNotFound(uri: string): McpResourceReadResult {
  return {
    kind: "not_found",
    message: "Resource not found",
    data: { error: "resource_not_found", uri },
  };
}

function forbidden(message: string, data: Record<string, JsonValue>) {
  return {
    kind: "forbidden" as const,
    message: "Forbidden",
    data: {
      message,
      ...data,
    },
  };
}

async function promptGetFromDetail(
  prompt: McpPromptDetail,
  args: Record<string, unknown>,
  readResource: (uri: string) => Promise<McpResourceReadResult>,
): Promise<McpPromptGetResult> {
  const values = stringArguments(args);
  const missingRequired = prompt.arguments.some((argument) => argument.required && !values[argument.name]);
  if (missingRequired) return { kind: "invalid_params", message: "Invalid prompt" };

  const messages: Extract<McpPromptGetResult, { kind: "success" }>["messages"] = [];
  for (const message of prompt.messages) {
    if (message.textTemplate) {
      messages.push({
        role: message.role,
        content: {
          type: "text",
          text: renderTemplateWithValues(message.textTemplate, values),
        },
      });
    }

    if (message.resourceUri) {
      const resource = await readResource(message.resourceUri);
      if (resource.kind !== "success") return resource.kind === "not_found" ? { kind: "invalid_params", message: "Invalid prompt" } : resource;
      const content = resource.contents[0];
      if (!content) return { kind: "invalid_params", message: "Invalid prompt" };
      messages.push({
        role: message.role,
        content: {
          type: "resource",
          resource: {
            ...content,
            ...(message.resourceMimeType ? { mimeType: message.resourceMimeType } : {}),
          },
        },
      });
    }
  }

  return {
    kind: "success",
    ...(prompt.description ? { description: prompt.description } : {}),
    messages,
  };
}

function completionFromCandidates(
  candidates: McpCompletionCandidateInput[],
  argumentName: string,
  value: string,
): McpCompletionResult {
  const matchingValues = candidates
    .filter((candidate) => candidate.argumentName === argumentName && candidate.value.startsWith(value))
    .map((candidate) => candidate.value);
  const values = matchingValues.slice(0, 100);
  return {
    kind: "success",
    values,
    total: matchingValues.length,
    hasMore: matchingValues.length > values.length,
  };
}

export function createMockServerRuntimeProvider(
  options: MockServerRuntimeProviderOptions = {},
): McpRuntimeProvider {
  return {
    serverInfo: MOCK_MCP_SERVER_INFO,
    tools: {
      async list(input) {
        const tools = await listEnabledMcpTools(
          undefined,
          options.endpointIds ? { endpointIds: options.endpointIds } : undefined,
        );
        return paginate(tools, input.cursor, input.limit);
      },
      async call(input) {
        const callResult = options.endpointIds
          ? await callPermittedEndpointByName(input.name, input.arguments ?? {}, options.endpointIds)
          : await callEndpointByName(input.name, input.arguments ?? {});
        return mcpToolResultFromEndpointCall(input.name, callResult);
      },
    },
    resources: {
      async list(input) {
        const resources = await listEnabledMcpResources();
        const allowed = options.resourceIds ? new Set(options.resourceIds) : null;
        return paginate(
          resources.filter((resource) => !allowed || allowed.has(resource.id)).map(mcpResourceFromDetail),
          input.cursor,
          input.limit,
        );
      },
      async read(input) {
        return readPermittedResource(input.uri, options);
      },
      templates: {
        async list(input) {
          const templates = await listEnabledMcpResourceTemplates();
          const allowed = options.resourceTemplateIds ? new Set(options.resourceTemplateIds) : null;
          return paginate(
            templates.filter((template) => !allowed || allowed.has(template.id)).map(mcpResourceTemplateFromDetail),
            input.cursor,
            input.limit,
          );
        },
      },
    },
    prompts: {
      async list(input) {
        const prompts = await listEnabledMcpPrompts();
        const allowed = options.promptIds ? new Set(options.promptIds) : null;
        return paginate(
          prompts.filter((prompt) => !allowed || allowed.has(prompt.id)).map(mcpPromptFromDetail),
          input.cursor,
          input.limit,
        );
      },
      async get(input) {
        const prompt = (await listEnabledMcpPrompts()).find((item) => item.name === input.name);
        if (!prompt) return { kind: "invalid_params", message: "Invalid prompt" };
        if (options.promptIds && !options.promptIds.includes(prompt.id)) {
          return forbidden("Bearer token does not grant permission for this prompt.", { prompt: input.name });
        }
        return promptGetFromDetail(prompt, input.arguments ?? {}, (uri) => readPermittedResource(uri, options));
      },
      async complete(input) {
        const value = input.argument.value ?? "";
        const ref = input.ref;
        if (ref.type === "ref/prompt") {
          const prompt = (await listEnabledMcpPrompts()).find((item) => item.name === ref.name);
          if (!prompt || (options.promptIds && !options.promptIds.includes(prompt.id))) {
            return { kind: "invalid_params", message: "Invalid completion ref" };
          }
          return completionFromCandidates(prompt.completionCandidates, input.argument.name, value);
        }

        const template = (await listEnabledMcpResourceTemplates()).find((item) => item.uriTemplate === ref.uri);
        if (!template || (options.resourceTemplateIds && !options.resourceTemplateIds.includes(template.id))) {
          return { kind: "invalid_params", message: "Invalid completion ref" };
        }
        return completionFromCandidates(template.completionCandidates, input.argument.name, value);
      },
    },
    subscriptions: {
      async subscribe(input): Promise<McpSubscribeResult> {
        const resource = await readPermittedResource(input.uri, options);
        if (resource.kind !== "success") return resource;
        return options.sseSession?.subscribeResource(input.uri)
          ? { kind: "success" }
          : { kind: "invalid_params", message: "Resource subscriptions require a live legacy SSE session" };
      },
      async unsubscribe(input): Promise<McpSubscribeResult> {
        const resource = await readPermittedResource(input.uri, options);
        if (resource.kind !== "success") return resource;
        return options.sseSession?.unsubscribeResource(input.uri)
          ? { kind: "success" }
          : { kind: "invalid_params", message: "Resource subscriptions require a live legacy SSE session" };
      },
    },
  };
}
