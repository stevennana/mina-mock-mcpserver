import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
} from "@/lib/mcp/types";
import type { EndpointCallResult } from "@/lib/endpoints/runtime";
import type { JsonValue } from "@/lib/endpoints/types";
import type {
  McpJsonRpcId,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpInitializeResult,
  McpCompletionResult,
  McpPrompt,
  McpPromptGetResult,
  McpResource,
  McpResourceContent,
  McpResourceTemplate,
  McpTool,
  McpToolCallResult,
} from "@/lib/mcp/types";

export type McpProtocolResult =
  | {
      kind: "json";
      status: number;
      body: McpJsonRpcResponse;
    }
  | {
      kind: "raw";
      status: number;
      body: string;
      contentType: string | null;
      matchedCase?: string;
    }
  | {
      kind: "accepted";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function idFromMessage(message: unknown): McpJsonRpcId {
  if (!isRecord(message)) return null;
  return typeof message.id === "string" || typeof message.id === "number" || message.id === null ? message.id : null;
}

function errorResponse(
  id: McpJsonRpcId,
  code: number,
  message: string,
  status = 200,
  data?: Record<string, JsonValue>,
): McpProtocolResult {
  return {
    kind: "json",
    status,
    body: {
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data ? { data } : {}) },
    },
  };
}

function requestedProtocolVersion(params: unknown) {
  if (!isRecord(params) || typeof params.protocolVersion !== "string") {
    return DEFAULT_MCP_PROTOCOL_VERSION;
  }
  return SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(
    params.protocolVersion as (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number],
  )
    ? params.protocolVersion
    : DEFAULT_MCP_PROTOCOL_VERSION;
}

function isJsonRpcRequest(message: unknown): message is McpJsonRpcRequest {
  return isRecord(message) && message.jsonrpc === "2.0" && typeof message.method === "string";
}

function isToolCallParams(params: unknown): params is { name: string; arguments?: unknown } {
  return isRecord(params) && typeof params.name === "string" && (params.arguments === undefined || isRecord(params.arguments));
}

function isResourceReadParams(params: unknown): params is { uri: string } {
  return isRecord(params) && typeof params.uri === "string" && params.uri.trim().length > 0;
}

function isPromptGetParams(params: unknown): params is { name: string; arguments?: Record<string, unknown> } {
  return isRecord(params) && typeof params.name === "string" && (params.arguments === undefined || isRecord(params.arguments));
}

type McpCompletionRef = { type: "ref/prompt"; name: string } | { type: "ref/resource"; uri: string };

function isCompletionRef(ref: unknown): ref is McpCompletionRef {
  if (!isRecord(ref) || typeof ref.type !== "string") return false;
  if (ref.type === "ref/prompt") return typeof ref.name === "string" && ref.name.trim().length > 0;
  if (ref.type === "ref/resource") return typeof ref.uri === "string" && ref.uri.trim().length > 0;
  return false;
}

function isCompletionParams(params: unknown): params is {
  ref: McpCompletionRef;
  argument: { name: string; value?: string };
} {
  return (
    isRecord(params) &&
    isCompletionRef(params.ref) &&
    isRecord(params.argument) &&
    typeof params.argument.name === "string" &&
    params.argument.name.trim().length > 0 &&
    (params.argument.value === undefined || typeof params.argument.value === "string")
  );
}

function textForJson(value: JsonValue) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function structuredContentFor(value: JsonValue): Record<string, JsonValue> | undefined {
  return isRecord(value) ? (value as Record<string, JsonValue>) : undefined;
}

function isForbiddenResult(value: unknown): value is { kind: "forbidden"; message: string } {
  return isRecord(value) && value.kind === "forbidden" && typeof value.message === "string";
}

export function mcpToolResultFromEndpointCall(callResult: EndpointCallResult): McpToolCallResult {
  if (callResult.kind === "matched") {
    const structuredContent = structuredContentFor(callResult.body);
    return {
      content: [{ type: "text", text: textForJson(callResult.body) }],
      ...(structuredContent ? { structuredContent } : {}),
    };
  }

  if (callResult.kind === "case_error") {
    const fallbackBody = {
      error: "tool_error",
      message: callResult.message,
      matchedCase: callResult.matchedCase.name,
    };
    const body = callResult.body ?? fallbackBody;
    return {
      isError: true,
      content: [{ type: "text", text: textForJson(body) }],
      ...(structuredContentFor(body) ? { structuredContent: structuredContentFor(body) } : {}),
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: callResult.kind === "invalid_arguments" ? callResult.message : "Tool execution failed." }],
  };
}

export async function handleMcpJsonRpcMessage(
  message: unknown,
  loadTools: () => Promise<McpTool[]>,
  callTool?: (name: string, rawArguments: unknown) => Promise<EndpointCallResult>,
  resourcesRuntime: {
    loadResources?: () => Promise<McpResource[]>;
    loadResourceTemplates?: () => Promise<McpResourceTemplate[]>;
    readResource?: (uri: string) => Promise<McpResourceContent | null | { kind: "forbidden"; message: string }>;
    subscribeResource?: (uri: string) => Promise<boolean>;
    unsubscribeResource?: (uri: string) => Promise<boolean>;
  } = {},
  promptsRuntime: {
    loadPrompts?: () => Promise<McpPrompt[]>;
    getPrompt?: (name: string, args: Record<string, unknown>) => Promise<McpPromptGetResult | null | { kind: "forbidden"; message: string }>;
    complete?: (ref: McpCompletionRef, argumentName: string, value: string) => Promise<McpCompletionResult | null>;
  } = {},
): Promise<McpProtocolResult> {
  if (!isJsonRpcRequest(message)) {
    return errorResponse(idFromMessage(message), -32600, "Invalid Request", 400);
  }

  if (message.id === undefined) {
    if (message.method === "notifications/initialized") {
      return { kind: "accepted" };
    }
    return { kind: "accepted" };
  }

  if (message.method === "initialize") {
    const capabilities: McpInitializeResult["capabilities"] = {
      tools: {
        listChanged: false,
      },
      ...(resourcesRuntime.loadResources && resourcesRuntime.loadResourceTemplates && resourcesRuntime.readResource
        ? { resources: { subscribe: true, listChanged: true } }
        : {}),
      ...(promptsRuntime.loadPrompts && promptsRuntime.getPrompt && promptsRuntime.complete
        ? { prompts: { listChanged: true }, completions: {} }
        : {}),
    };
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: requestedProtocolVersion(message.params),
          capabilities,
          serverInfo: MCP_SERVER_INFO,
        },
      },
    };
  }

  if (message.method === "tools/list") {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: await loadTools(),
        },
      },
    };
  }

  if (message.method === "tools/call") {
    if (!callTool || !isToolCallParams(message.params)) {
      return errorResponse(message.id, -32602, "Invalid params");
    }

    const callResult = await callTool(message.params.name, message.params.arguments ?? {});
    if (callResult.kind === "not_found" || callResult.kind === "disabled") {
      return errorResponse(message.id, -32602, "Unknown tool");
    }
    if (callResult.kind === "forbidden") {
      return errorResponse(message.id, -32003, "Forbidden", 403, {
        error: "forbidden",
        message: callResult.message,
        tool: message.params.name,
      });
    }
    if (callResult.kind === "invalid_arguments") {
      return errorResponse(message.id, -32602, callResult.message);
    }
    if (callResult.kind === "protocol_error") {
      return errorResponse(message.id, -32000, callResult.message, 200, {
        error: "protocol_error",
        tool: message.params.name,
        matchedCase: callResult.matchedCase.name,
        ...(callResult.body ? { body: callResult.body } : {}),
      });
    }
    if (callResult.kind === "malformed") {
      return {
        kind: "raw",
        status: callResult.statusCode,
        body: callResult.body,
        contentType: callResult.contentType,
        matchedCase: callResult.matchedCase.name,
      };
    }

    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: mcpToolResultFromEndpointCall(callResult),
      },
    };
  }

  if (message.method === "resources/list") {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          resources: resourcesRuntime.loadResources ? await resourcesRuntime.loadResources() : [],
        },
      },
    };
  }

  if (message.method === "resources/templates/list") {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          resourceTemplates: resourcesRuntime.loadResourceTemplates ? await resourcesRuntime.loadResourceTemplates() : [],
        },
      },
    };
  }

  if (message.method === "resources/read") {
    if (!resourcesRuntime.readResource || !isResourceReadParams(message.params)) {
      return errorResponse(message.id, -32602, "Invalid params");
    }

    const resource = await resourcesRuntime.readResource(message.params.uri);
    if (isForbiddenResult(resource)) {
      return errorResponse(message.id, -32003, "Forbidden", 403, {
        error: "forbidden",
        message: resource.message,
        uri: message.params.uri,
      });
    }
    if (!resource) {
      return errorResponse(message.id, -32002, "Resource not found", 200, {
        error: "resource_not_found",
        uri: message.params.uri,
      });
    }

    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          contents: [resource],
        },
      },
    };
  }

  if (message.method === "resources/subscribe" || message.method === "resources/unsubscribe") {
    if (!isResourceReadParams(message.params)) {
      return errorResponse(message.id, -32602, "Invalid params");
    }

    if (!resourcesRuntime.readResource) {
      return errorResponse(message.id, -32601, "Method not found");
    }

    const resource = await resourcesRuntime.readResource(message.params.uri);
    if (isForbiddenResult(resource)) {
      return errorResponse(message.id, -32003, "Forbidden", 403, {
        error: "forbidden",
        message: resource.message,
        uri: message.params.uri,
      });
    }
    if (!resource) {
      return errorResponse(message.id, -32002, "Resource not found", 200, {
        error: "resource_not_found",
        uri: message.params.uri,
      });
    }

    const handler =
      message.method === "resources/subscribe" ? resourcesRuntime.subscribeResource : resourcesRuntime.unsubscribeResource;
    if (!handler || !(await handler(message.params.uri))) {
      return errorResponse(message.id, -32602, "Resource subscriptions require a live legacy SSE session");
    }

    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {},
      },
    };
  }

  if (message.method === "prompts/list") {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          prompts: promptsRuntime.loadPrompts ? await promptsRuntime.loadPrompts() : [],
        },
      },
    };
  }

  if (message.method === "prompts/get") {
    if (!promptsRuntime.getPrompt || !isPromptGetParams(message.params)) {
      return errorResponse(message.id, -32602, "Invalid params");
    }

    const prompt = await promptsRuntime.getPrompt(message.params.name, message.params.arguments ?? {});
    if (isForbiddenResult(prompt)) {
      return errorResponse(message.id, -32003, "Forbidden", 403, {
        error: "forbidden",
        message: prompt.message,
        prompt: message.params.name,
      });
    }
    if (!prompt) {
      return errorResponse(message.id, -32602, "Invalid prompt");
    }

    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: prompt,
      },
    };
  }

  if (message.method === "completion/complete") {
    if (!promptsRuntime.complete || !isCompletionParams(message.params)) {
      return errorResponse(message.id, -32602, "Invalid params");
    }

    const completion = await promptsRuntime.complete(
      message.params.ref,
      message.params.argument.name,
      message.params.argument.value ?? "",
    );
    if (!completion) {
      return errorResponse(message.id, -32602, "Invalid completion ref");
    }

    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: completion,
      },
    };
  }

  return errorResponse(message.id, -32601, "Method not found");
}
