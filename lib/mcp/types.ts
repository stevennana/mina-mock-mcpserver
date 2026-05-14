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
    resources?: {
      subscribe: true;
      listChanged: true;
    };
    prompts?: {
      listChanged: true;
    };
    completions?: Record<string, never>;
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

export type McpResource = {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  annotations?: JsonValue;
};

export type McpResourceTemplate = {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: JsonValue;
};

export type McpResourceContent = {
  uri: string;
  mimeType?: string;
} & ({ text: string } | { blob: string });

export type McpPrompt = {
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{
    name: string;
    title?: string;
    description?: string;
    required?: boolean;
  }>;
};

export type McpPromptMessage = {
  role: "user" | "assistant";
  content:
    | {
        type: "text";
        text: string;
      }
    | {
        type: "resource";
        resource: McpResourceContent;
      };
};

export type McpPromptGetResult = {
  description?: string;
  messages: McpPromptMessage[];
};

export type McpCompletionResult = {
  completion: {
    values: string[];
    total: number;
    hasMore: boolean;
  };
};

export type McpJsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: McpJsonRpcId;
      result:
        | McpInitializeResult
        | { tools: McpTool[] }
        | McpToolCallResult
        | { resources: McpResource[]; nextCursor?: string }
        | { resourceTemplates: McpResourceTemplate[]; nextCursor?: string }
        | { contents: McpResourceContent[] }
        | Record<string, never>
        | { prompts: McpPrompt[]; nextCursor?: string }
        | McpPromptGetResult
        | McpCompletionResult;
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
