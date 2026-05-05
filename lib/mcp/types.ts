import type { EndpointMcpTool, JsonValue } from "@/lib/endpoints/types";

export const MCP_SERVER_INFO = {
  name: "mina-mock-mcpserver",
  version: "1.0.0",
} as const;

export const SUPPORTED_MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;
export const DEFAULT_MCP_PROTOCOL_VERSION = SUPPORTED_MCP_PROTOCOL_VERSIONS[0];

export type McpJsonRpcId = string | number | null;

export type McpJsonRpcRequest = {
  jsonrpc: "2.0";
  id?: McpJsonRpcId;
  method: string;
  params?: unknown;
};

export type McpTool = EndpointMcpTool;

export type McpInitializeResult = {
  protocolVersion: string;
  capabilities: {
    tools: {
      listChanged: false;
    };
  };
  serverInfo: typeof MCP_SERVER_INFO;
};

export type McpToolCallResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: Record<string, JsonValue>;
  isError?: true;
};

export type McpJsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: McpJsonRpcId;
      result: McpInitializeResult | { tools: McpTool[] } | McpToolCallResult;
    }
  | {
      jsonrpc: "2.0";
      id: McpJsonRpcId;
      error: {
        code: number;
        message: string;
        data?: Record<string, JsonValue>;
      };
    };
