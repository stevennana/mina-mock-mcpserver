import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { parseBearerAuthorizationHeader, resolveOAuthBearerAuthorizationHeader } from "@/lib/auth/oauth";
import { callEndpointByName, callPermittedEndpointByName, listEnabledMcpTools } from "@/lib/endpoints/service";
import { publicCorsHeaders } from "@/lib/http/cors";
import {
  listEnabledMcpResources,
  listEnabledMcpPrompts,
  listEnabledMcpResourceTemplates,
  readEnabledMcpResource,
  matchResourceTemplateUri,
} from "@/lib/mcp-fixtures/service";
import { renderTemplateWithValues } from "@/lib/mcp-fixtures/template-render";
import type {
  McpCompletionCandidateInput,
  McpPromptDetail,
  McpResourceDetail,
  McpResourceRuntimeRead,
  McpResourceTemplateDetail,
} from "@/lib/mcp-fixtures/types";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";
import {
  cleanupLegacySseSession,
  enqueueSse,
  legacySseSessions,
  sseComment,
  sseEvent,
  subscribeLegacySseResource,
  unsubscribeLegacySseResource,
  type LegacySseMode,
  type LegacySseRuntime,
} from "@/lib/mcp/sse-notifications";
import type {
  McpCompletionResult,
  McpPrompt,
  McpPromptGetResult,
  McpResource,
  McpResourceContent,
  McpResourceTemplate,
} from "@/lib/mcp/types";
import { DEFAULT_MCP_PROTOCOL_VERSION, SUPPORTED_MCP_PROTOCOL_VERSIONS } from "@/lib/mcp/types";
import { oauthDiscoveryUrls } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export const dynamic = "force-dynamic";

function mcpResponseHeaders(headers: Record<string, string> = {}) {
  return publicCorsHeaders({
    "MCP-Protocol-Version": DEFAULT_MCP_PROTOCOL_VERSION,
    ...headers,
  });
}

function isSupportedMcpProtocolVersion(value: string) {
  return SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(value as (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number]);
}

function parseAnnotations(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
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

function isForbiddenResourceRead(
  value: McpResourceContent | null | { kind: "forbidden"; message: string },
): value is { kind: "forbidden"; message: string } {
  return Boolean(value && "kind" in value && value.kind === "forbidden");
}

async function mcpPromptGetFromDetail(
  prompt: McpPromptDetail,
  args: Record<string, unknown>,
  readResource: (uri: string) => Promise<McpResourceContent | null | { kind: "forbidden"; message: string }>,
): Promise<McpPromptGetResult | null | { kind: "forbidden"; message: string }> {
  const values = stringArguments(args);
  const missingRequired = prompt.arguments.some((argument) => argument.required && !values[argument.name]);
  if (missingRequired) return null;

  const messages = [];
  for (const message of prompt.messages) {
    if (message.textTemplate) {
      messages.push({
        role: message.role,
        content: {
          type: "text" as const,
          text: renderTemplateWithValues(message.textTemplate, values),
        },
      });
    }

    if (message.resourceUri) {
      const resource = await readResource(message.resourceUri);
      if (isForbiddenResourceRead(resource)) return resource;
      if (!resource) return null;
      messages.push({
        role: message.role,
        content: {
          type: "resource" as const,
          resource: {
            ...resource,
            ...(message.resourceMimeType ? { mimeType: message.resourceMimeType } : {}),
          },
        },
      });
    }
  }

  return {
    ...(prompt.description ? { description: prompt.description } : {}),
    messages,
  };
}

function completionFromCandidates(candidates: McpCompletionCandidateInput[], argumentName: string, value: string): McpCompletionResult {
  const matchingValues = candidates
    .filter((candidate) => candidate.argumentName === argumentName && candidate.value.startsWith(value))
    .map((candidate) => candidate.value);
  const values = matchingValues.slice(0, 100);
  return {
    completion: {
      values,
      total: matchingValues.length,
      hasMore: matchingValues.length > values.length,
    },
  };
}

async function validateMcpHttpRequest(request: Request) {
  const protocolVersion = request.headers.get("MCP-Protocol-Version");
  if (protocolVersion && !isSupportedMcpProtocolVersion(protocolVersion)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Unsupported MCP protocol version." },
      },
      { status: 400, headers: mcpResponseHeaders() },
    );
  }

  return null;
}

function unauthorizedBasicResponse(message = "Valid Basic credentials are required.") {
  return NextResponse.json(
    {
      error: "unauthorized",
      message,
    },
    {
      status: 401,
      headers: mcpResponseHeaders({
        "WWW-Authenticate": 'Basic realm="MCP Mock Server"',
      }),
    },
  );
}

async function bearerChallenge(request: Request, error?: string) {
  const { baseUrl } = await resolveBaseUrl(request);
  const challenge = [
    'Bearer realm="MCP Mock Server"',
    `resource_metadata="${oauthDiscoveryUrls(baseUrl).protectedResourceMetadata}"`,
  ];
  if (error) {
    challenge.push(`error="${error}"`);
  }
  return challenge.join(", ");
}

async function unauthorizedBearerResponse(request: Request, message = "Valid Bearer token is required.", error?: string) {
  return NextResponse.json(
    {
      error: "unauthorized",
      message,
    },
    {
      status: 401,
      headers: mcpResponseHeaders({
        "WWW-Authenticate": await bearerChallenge(request, error),
      }),
    },
  );
}

async function handleMcpJsonRpcPost(
  request: Request,
  runtime: {
    endpointIds?: string[];
    resourceIds?: string[];
    resourceTemplateIds?: string[];
    promptIds?: string[];
  } = {},
  sseSession?: {
    subscribeResource: (uri: string) => boolean;
    unsubscribeResource: (uri: string) => boolean;
  },
) {
  const invalidHttpRequest = await validateMcpHttpRequest(request);
  if (invalidHttpRequest) {
    return invalidHttpRequest;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400, headers: mcpResponseHeaders() },
    );
  }

  const resourcesRuntime = {
    loadResources: async () => {
      const resources = await listEnabledMcpResources();
      const allowed = runtime.resourceIds ? new Set(runtime.resourceIds) : null;
      return resources.filter((resource) => !allowed || allowed.has(resource.id)).map(mcpResourceFromDetail);
    },
    loadResourceTemplates: async () => {
      const templates = await listEnabledMcpResourceTemplates();
      const allowed = runtime.resourceTemplateIds ? new Set(runtime.resourceTemplateIds) : null;
      return templates.filter((template) => !allowed || allowed.has(template.id)).map(mcpResourceTemplateFromDetail);
    },
    readResource: async (uri: string) => {
      if (runtime.resourceIds || runtime.resourceTemplateIds) {
        const [resources, templates] = await Promise.all([listEnabledMcpResources(), listEnabledMcpResourceTemplates()]);
        const directResource = resources.find((resource) => resource.uri === uri);
        if (directResource) {
          if (runtime.resourceIds && !runtime.resourceIds.includes(directResource.id)) {
            return { kind: "forbidden" as const, message: "Bearer token does not grant permission for this resource." };
          }
        } else {
          const renderedTemplate = templates.find((template) => matchResourceTemplateUri(template.uriTemplate, uri));
          if (renderedTemplate && runtime.resourceTemplateIds && !runtime.resourceTemplateIds.includes(renderedTemplate.id)) {
            return { kind: "forbidden" as const, message: "Bearer token does not grant permission for this resource template." };
          }
          if (!renderedTemplate) {
            const renderedResource = await readEnabledMcpResource(uri);
            if (renderedResource) {
              return { kind: "forbidden" as const, message: "Bearer token does not grant permission for this resource." };
            }
            return null;
          }
        }
        if (!directResource && runtime.resourceIds && !runtime.resourceTemplateIds) {
          return { kind: "forbidden" as const, message: "Bearer token does not grant permission for this resource." };
        }
      }
      const resource = await readEnabledMcpResource(uri);
      return resource ? mcpResourceContentFromRead(resource) : null;
    },
    ...(sseSession
      ? {
          subscribeResource: async (uri: string) => sseSession.subscribeResource(uri),
          unsubscribeResource: async (uri: string) => sseSession.unsubscribeResource(uri),
        }
      : {}),
  };
  const promptsRuntime = {
    loadPrompts: async () => {
      const prompts = await listEnabledMcpPrompts();
      const allowed = runtime.promptIds ? new Set(runtime.promptIds) : null;
      return prompts.filter((prompt) => !allowed || allowed.has(prompt.id)).map(mcpPromptFromDetail);
    },
    getPrompt: async (name: string, args: Record<string, unknown>) => {
      const prompt = (await listEnabledMcpPrompts()).find((item) => item.name === name);
      if (!prompt) return null;
      if (runtime.promptIds && !runtime.promptIds.includes(prompt.id)) {
        return { kind: "forbidden" as const, message: "Bearer token does not grant permission for this prompt." };
      }
      return mcpPromptGetFromDetail(prompt, args, resourcesRuntime.readResource);
    },
    complete: async (
      ref: { type: "ref/prompt"; name: string } | { type: "ref/resource"; uri: string },
      argumentName: string,
      value: string,
    ) => {
      if (ref.type === "ref/prompt") {
        const prompt = (await listEnabledMcpPrompts()).find((item) => item.name === ref.name);
        if (!prompt || (runtime.promptIds && !runtime.promptIds.includes(prompt.id))) return null;
        return completionFromCandidates(prompt.completionCandidates, argumentName, value);
      }

      const template = (await listEnabledMcpResourceTemplates()).find((item) => item.uriTemplate === ref.uri);
      if (template && runtime.resourceTemplateIds && !runtime.resourceTemplateIds.includes(template.id)) return null;
      return template ? completionFromCandidates(template.completionCandidates, argumentName, value) : null;
    },
  };

  const result = await handleMcpJsonRpcMessage(
    body,
    () => listEnabledMcpTools(undefined, runtime.endpointIds ? { endpointIds: runtime.endpointIds } : undefined),
    runtime.endpointIds
      ? (name, rawArguments) => callPermittedEndpointByName(name, rawArguments, runtime.endpointIds ?? [])
      : callEndpointByName,
    resourcesRuntime,
    promptsRuntime,
  );
  if (result.kind === "accepted") {
    return new Response(null, { status: 202, headers: mcpResponseHeaders() });
  }
  if (result.kind === "raw") {
    return new Response(result.body, {
      status: result.status,
      headers: mcpResponseHeaders({
        ...(result.contentType ? { "content-type": result.contentType } : {}),
        ...(result.matchedCase ? { "X-MCP-Mock-Matched-Case": result.matchedCase } : {}),
      }),
    });
  }

  return NextResponse.json(result.body, { status: result.status, headers: mcpResponseHeaders() });
}

export async function handleNoAuthMcpPost(request: Request) {
  return handleMcpJsonRpcPost(request);
}

export async function handleUnifiedMcpPost(request: Request) {
  const authorization = request.headers.get("Authorization");
  const bearer = parseBearerAuthorizationHeader(authorization);
  if (bearer.kind === "bearer" || bearer.kind === "invalid") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(authorization, request);
    if (resolution.kind !== "authenticated") {
      return unauthorizedBearerResponse(request, "Authorization header was invalid.", "invalid_token");
    }
    return handleMcpJsonRpcPost(request, {
      endpointIds: resolution.principal.endpointIds,
      resourceIds: resolution.principal.resourceIds,
      resourceTemplateIds: resolution.principal.resourceTemplateIds,
      promptIds: resolution.principal.promptIds,
    });
  }

  const resolution = await resolveBasicAuthorizationHeader(authorization);

  if (resolution.kind === "unauthorized") {
    return unauthorizedBasicResponse("Authorization header was invalid.");
  }
  if (resolution.kind === "authenticated" || resolution.kind === "missing") {
    return handleMcpJsonRpcPost(request);
  }

  return unauthorizedBasicResponse();
}

export async function handleStrictOAuthMcpPost(request: Request) {
  const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
  if (resolution.kind !== "authenticated") {
    return unauthorizedBearerResponse(request);
  }

  return handleMcpJsonRpcPost(request, {
    endpointIds: resolution.principal.endpointIds,
    resourceIds: resolution.principal.resourceIds,
    resourceTemplateIds: resolution.principal.resourceTemplateIds,
    promptIds: resolution.principal.promptIds,
  });
}

export async function handleStrictBasicMcpPost(request: Request) {
  const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (resolution.kind !== "authenticated") {
    return unauthorizedBasicResponse();
  }

  return handleMcpJsonRpcPost(request);
}

function sseStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    status: 200,
    headers: mcpResponseHeaders({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    }),
  });
}

function createMcpSseStream(label: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseComment(`${label} stream opened`)));
      controller.enqueue(encoder.encode(sseEvent("message", {
        jsonrpc: "2.0",
        method: "notifications/message",
        params: {
          level: "info",
          logger: "mcp-mock-server",
          data: `${label} SSE stream is open. This mock server sends request results on POST responses.`,
        },
      }, `${Date.now()}-open`)));
      controller.close();
    },
    cancel() {},
  });
}

export function handleNoAuthMcpGet() {
  return sseStreamResponse(createMcpSseStream("no-auth MCP"));
}

export function handleUnifiedMcpGet() {
  return sseStreamResponse(createMcpSseStream("unified MCP"));
}

export async function handleStrictBasicMcpGet(request: Request) {
  const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (resolution.kind !== "authenticated") {
    return unauthorizedBasicResponse();
  }

  return sseStreamResponse(createMcpSseStream("Basic MCP"));
}

export async function handleStrictOAuthMcpGet(request: Request) {
  const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
  if (resolution.kind !== "authenticated") {
    return unauthorizedBearerResponse(request);
  }

  return sseStreamResponse(createMcpSseStream("OAuth MCP"));
}

function legacyMessagePath(request: Request, mode: LegacySseMode, sessionId: string) {
  const url = new URL(request.url);
  const path = mode === "unified" ? "/sse/message" : `/sse/${mode}/message`;
  url.pathname = path;
  url.search = new URLSearchParams({ sessionId }).toString();
  return `${url.pathname}${url.search}`;
}

async function legacyRuntimeForRequest(mode: LegacySseMode, request: Request): Promise<
  | { response: Response }
  | {
      runtime: LegacySseRuntime;
    }
> {
  if (mode === "basic") {
    const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
    if (resolution.kind !== "authenticated") return { response: unauthorizedBasicResponse() };
    return { runtime: {} };
  }

  if (mode === "oauth") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
    if (resolution.kind !== "authenticated") return { response: await unauthorizedBearerResponse(request) };
    return {
      runtime: {
        endpointIds: resolution.principal.endpointIds,
        resourceIds: resolution.principal.resourceIds,
        resourceTemplateIds: resolution.principal.resourceTemplateIds,
        promptIds: resolution.principal.promptIds,
      },
    };
  }

  if (mode === "unified") {
    const authorization = request.headers.get("Authorization");
    const bearer = parseBearerAuthorizationHeader(authorization);
    if (bearer.kind === "bearer" || bearer.kind === "invalid") {
      const resolution = await resolveOAuthBearerAuthorizationHeader(authorization, request);
      if (resolution.kind !== "authenticated") {
        return { response: await unauthorizedBearerResponse(request, "Authorization header was invalid.", "invalid_token") };
      }
      return {
        runtime: {
          endpointIds: resolution.principal.endpointIds,
          resourceIds: resolution.principal.resourceIds,
          resourceTemplateIds: resolution.principal.resourceTemplateIds,
          promptIds: resolution.principal.promptIds,
        },
      };
    }

    const resolution = await resolveBasicAuthorizationHeader(authorization);
    if (resolution.kind === "unauthorized") {
      return { response: unauthorizedBasicResponse("Authorization header was invalid.") };
    }
  }

  return { runtime: {} };
}

export function handleLegacySseGet(mode: LegacySseMode = "unified") {
  return async (request: Request) => {
    const runtime = await legacyRuntimeForRequest(mode, request);
    if ("response" in runtime) {
      return runtime.response;
    }

    const encoder = new TextEncoder();
    const sessionId = crypto.randomUUID();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const heartbeat = setInterval(() => {
          const session = legacySseSessions.get(sessionId);
          if (session) enqueueSse(session, sseComment("legacy SSE heartbeat"));
        }, 15_000);
        legacySseSessions.set(sessionId, {
          mode,
          controller,
          encoder,
          runtime: runtime.runtime,
          heartbeat,
          subscribedResourceUris: new Set(),
        });
        controller.enqueue(encoder.encode(sseEvent("endpoint", legacyMessagePath(request, mode, sessionId))));
        controller.enqueue(encoder.encode(sseComment("legacy SSE compatibility stream")));
        request.signal.addEventListener("abort", () => cleanupLegacySseSession(sessionId), { once: true });
      },
      cancel() {
        cleanupLegacySseSession(sessionId);
      },
    });
    return sseStreamResponse(stream);
  };
}

export function handleLegacySseMessagePost(mode: LegacySseMode = "unified") {
  return async (request: Request) => {
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    const session = legacySseSessions.get(sessionId);
    if (!session || session.mode !== mode) {
      return NextResponse.json(
        { error: "sse_session_not_found", message: "Open the matching SSE endpoint before posting MCP messages." },
        { status: 404, headers: mcpResponseHeaders() },
      );
    }

    const response = await handleMcpJsonRpcPost(request, session.runtime, {
      subscribeResource: (uri) => subscribeLegacySseResource(sessionId, uri),
      unsubscribeResource: (uri) => unsubscribeLegacySseResource(sessionId, uri),
    });
    if (response.status !== 202) {
      enqueueSse(session, sseEvent("message", await response.text(), `${Date.now()}-${sessionId}`));
    }

    return new Response(null, { status: 202, headers: mcpResponseHeaders() });
  };
}

export function handleLegacySseDelete(mode: LegacySseMode = "unified") {
  return (request: Request) => {
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    const session = legacySseSessions.get(sessionId);
    if (session && session.mode === mode) {
      cleanupLegacySseSession(sessionId);
      try {
        session.controller.close();
      } catch {
        return new Response(null, { status: 204, headers: mcpResponseHeaders() });
      }
    }
    return new Response(null, { status: 204, headers: mcpResponseHeaders() });
  };
}

export function unsupportedStreamableHttpMethod() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "This MCP endpoint supports JSON-RPC POST plus lightweight SSE GET. Session termination is not implemented on Streamable HTTP routes.",
    },
    {
      status: 405,
      headers: mcpResponseHeaders({ Allow: "GET, POST, OPTIONS" }),
    },
  );
}

export function handleMcpOptions() {
  return new Response(null, {
    status: 204,
    headers: mcpResponseHeaders(),
  });
}
