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
      kind: "accepted";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function idFromMessage(message: unknown): McpJsonRpcId {
  if (!isRecord(message)) return null;
  return typeof message.id === "string" || typeof message.id === "number" || message.id === null ? message.id : null;
}

function errorResponse(id: McpJsonRpcId, code: number, message: string, status = 200): McpProtocolResult {
  return {
    kind: "json",
    status,
    body: {
      jsonrpc: "2.0",
      id,
      error: { code, message },
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

function textForJson(value: JsonValue) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function structuredContentFor(value: JsonValue): Record<string, JsonValue> | undefined {
  return isRecord(value) ? (value as Record<string, JsonValue>) : undefined;
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
    const bodyText = callResult.body ? textForJson(callResult.body) : callResult.message;
    return {
      isError: true,
      content: [{ type: "text", text: bodyText }],
      ...(callResult.body && structuredContentFor(callResult.body)
        ? { structuredContent: structuredContentFor(callResult.body) }
        : {}),
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
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: requestedProtocolVersion(message.params),
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
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
    if (callResult.kind === "invalid_arguments") {
      return errorResponse(message.id, -32602, callResult.message);
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

  return errorResponse(message.id, -32601, "Method not found");
}
