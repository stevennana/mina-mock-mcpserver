export const MCP_PROTOCOL_VERSION_2025_06_18 = "2025-06-18";
export const MCP_PROTOCOL_VERSION_2025_03_26 = "2025-03-26";

export const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSION_2025_06_18,
  MCP_PROTOCOL_VERSION_2025_03_26,
] as const;

export const DEFAULT_MCP_PROTOCOL_VERSION = MCP_PROTOCOL_VERSION_2025_06_18;

export type SupportedMcpProtocolVersion = (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type McpJsonRpcId = string | number | null;
export type McpProgressToken = string | number;

export type McpJsonRpcRequest = {
  jsonrpc: "2.0";
  id: McpJsonRpcId;
  method: string;
  params?: unknown;
};

export type McpJsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type McpJsonRpcMessage = McpJsonRpcRequest | McpJsonRpcNotification;

export type McpJsonRpcSuccessResponse<TResult = unknown> = {
  jsonrpc: "2.0";
  id: McpJsonRpcId;
  result: TResult;
};

export type McpJsonRpcError = {
  code: McpErrorCode | number;
  message: string;
  data?: JsonValue;
};

export type McpJsonRpcErrorResponse = {
  jsonrpc: "2.0";
  id: McpJsonRpcId;
  error: McpJsonRpcError;
};

export type McpJsonRpcResponse<TResult = unknown> = McpJsonRpcSuccessResponse<TResult> | McpJsonRpcErrorResponse;

export type McpErrorCode = -32700 | -32600 | -32601 | -32602 | -32603 | -32000 | -32002;

export type McpServerInfo = {
  name: string;
  version: string;
};

export type McpServerCapabilities = {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  completions?: Record<string, never>;
  logging?: Record<string, never>;
};

export type McpInitializeResult = {
  protocolVersion: SupportedMcpProtocolVersion | string;
  capabilities: McpServerCapabilities;
  serverInfo: McpServerInfo;
};

export type McpContentAnnotations = {
  audience?: Array<"user" | "assistant">;
  priority?: number;
  lastModified?: string;
  [key: string]: JsonValue | undefined;
};

export type McpJsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, McpJsonSchema>;
  required?: string[];
  items?: McpJsonSchema | McpJsonSchema[];
  enum?: JsonValue[];
  const?: JsonValue;
  default?: JsonValue;
  additionalProperties?: boolean | McpJsonSchema;
  [keyword: string]: JsonValue | McpJsonSchema | McpJsonSchema[] | Record<string, McpJsonSchema> | undefined;
};

export type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: McpJsonSchema;
  outputSchema?: McpJsonSchema;
  annotations?: Record<string, JsonValue>;
};

export type McpTextContent = {
  type: "text";
  text: string;
  annotations?: McpContentAnnotations;
};

export type McpImageContent = {
  type: "image";
  data: string;
  mimeType: string;
  annotations?: McpContentAnnotations;
};

export type McpAudioContent = {
  type: "audio";
  data: string;
  mimeType: string;
  annotations?: McpContentAnnotations;
};

export type McpEmbeddedResourceContent = {
  type: "resource";
  resource: McpResourceContent;
  annotations?: McpContentAnnotations;
};

export type McpToolContent = McpTextContent | McpImageContent | McpAudioContent | McpEmbeddedResourceContent;

export type McpResource = {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  annotations?: McpContentAnnotations;
};

export type McpResourceTemplate = {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: McpContentAnnotations;
};

export type McpResourceContent = {
  uri: string;
  mimeType?: string;
  annotations?: McpContentAnnotations;
} & ({ text: string } | { blob: string });

export type McpPromptArgument = {
  name: string;
  title?: string;
  description?: string;
  required?: boolean;
};

export type McpPrompt = {
  name: string;
  title?: string;
  description?: string;
  arguments?: McpPromptArgument[];
};

export type McpPromptMessage = {
  role: "user" | "assistant";
  content: McpToolContent;
};

export type McpRuntimeContext = {
  requestId?: string;
  principal?: unknown;
};

export type McpListInput = {
  cursor?: string;
  limit?: number;
  context: McpRuntimeContext;
};

export type McpListResult<TItem> = {
  items: TItem[];
  nextCursor?: string;
};

export type McpResourceReadInput = {
  uri: string;
  context: McpRuntimeContext;
};

export type McpToolCallInput = {
  name: string;
  arguments?: Record<string, JsonValue>;
  context: McpRuntimeContext;
};

export type McpPromptGetInput = {
  name: string;
  arguments?: Record<string, JsonValue>;
  context: McpRuntimeContext;
};

export type McpCompletionRef = { type: "ref/prompt"; name: string } | { type: "ref/resource"; uri: string };

export type McpCompletionInput = {
  ref: McpCompletionRef;
  argument: {
    name: string;
    value?: string;
  };
  context: McpRuntimeContext;
};

export type McpProviderError =
  | { kind: "not_found"; message?: string }
  | { kind: "forbidden"; message: string }
  | { kind: "invalid_params"; message: string; data?: Record<string, JsonValue> }
  | { kind: "protocol_error"; message: string; data?: Record<string, JsonValue> };

export type McpResourceReadResult = { kind: "success"; contents: McpResourceContent[] } | McpProviderError;

export type McpToolCallResult =
  | { kind: "success"; content: McpToolContent[]; structuredContent?: Record<string, JsonValue> }
  | { kind: "tool_error"; content: McpToolContent[]; structuredContent?: Record<string, JsonValue> }
  | {
      kind: "raw";
      status: number;
      body: string;
      contentType?: string | null;
      headers?: Record<string, string>;
    }
  | McpProviderError;

export type McpPromptGetResult = { kind: "success"; description?: string; messages: McpPromptMessage[] } | McpProviderError;

export type McpCompletionResult =
  | {
      kind: "success";
      values: string[];
      total?: number;
      hasMore?: boolean;
    }
  | McpProviderError;

export type McpSubscribeResult = { kind: "success" } | McpProviderError;

export type McpRuntimeProvider = {
  serverInfo?: McpServerInfo;
  resources: {
    list(input: McpListInput): Promise<McpListResult<McpResource>>;
    read(input: McpResourceReadInput): Promise<McpResourceReadResult>;
    templates?: {
      list(input: McpListInput): Promise<McpListResult<McpResourceTemplate>>;
    };
  };
  tools?: {
    list(input: McpListInput): Promise<McpListResult<McpTool>>;
    call(input: McpToolCallInput): Promise<McpToolCallResult>;
  };
  prompts?: {
    list(input: McpListInput): Promise<McpListResult<McpPrompt>>;
    get(input: McpPromptGetInput): Promise<McpPromptGetResult>;
    complete?: (input: McpCompletionInput) => Promise<McpCompletionResult>;
  };
  completion?: {
    complete(input: McpCompletionInput): Promise<McpCompletionResult>;
  };
  subscriptions?: {
    subscribe(input: McpResourceReadInput): Promise<McpSubscribeResult>;
    unsubscribe(input: McpResourceReadInput): Promise<McpSubscribeResult>;
  };
};

export type McpRuntimeOptions = {
  serverInfo?: McpServerInfo;
  supportedProtocolVersions?: readonly string[];
  defaultProtocolVersion?: string;
  pageSize?: number;
};
