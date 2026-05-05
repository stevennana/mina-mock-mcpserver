import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
} from "@/lib/mcp/types";
import type { McpJsonRpcId, McpJsonRpcRequest, McpJsonRpcResponse, McpTool } from "@/lib/mcp/types";

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

export async function handleMcpJsonRpcMessage(
  message: unknown,
  loadTools: () => Promise<McpTool[]>,
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

  return errorResponse(message.id, -32601, "Method not found");
}
